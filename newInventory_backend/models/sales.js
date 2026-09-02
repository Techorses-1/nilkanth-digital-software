const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const salesSchema = new mongoose.Schema({
    saleId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    invoiceNumber: {
        type: String,
        unique: true,
        required: true,
    },

    // ===== INTERNAL INVOICE NUMBER (Unique Alphanumeric) =====
    internalInvoiceNumber: {
        type: String,
        unique: true,
        required: true,
    },

    // ===== CUSTOMER INFO =====
    customerId: {
        type: String,
        required: true,
        ref: 'Customer'
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    customerEmail: {
        type: String,
        trim: true
    },
    customerPhone: {
        type: String,
        trim: true
    },
    customerGstin: {
        type: String,
        trim: true,
        uppercase: true
    },
    customerState: {
        type: String,
        trim: true
    },
    customerAddress: {
        type: String,
        trim: true
    },

    // ===== STORE TYPE =====
    storeType: {
        type: String,
        enum: ['Vadodara', 'Padra'],
        default: 'Vadodara',
        required: true
    },

    // ===== PAYMENT TYPE =====
    paymentType: {
        type: String,
        enum: ['Cash', 'Bank', 'UPI', 'Cheque'],
        default: 'Cash',
        required: true
    },

    // ===== GST MODE =====
    isGstMode: {
        type: Boolean,
        default: true,
        required: true
    },

    // ===== SALE DATE =====
    saleDate: {
        type: Date,
        default: Date.now,
        required: true
    },

    // ===== ITEMS =====
    items: [{
        productId: {
            type: String,
            required: true,
            ref: 'Product'
        },
        productName: {
            type: String,
            required: true,
            trim: true
        },
        productDescription: {
            type: String,
            trim: true
        },
        hsnCode: {
            type: String,
            required: true,
            trim: true
        },
        unitName: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0.01
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        finalPrice: {
            type: Number,
            required: true,
            min: 0
        },
        discountedUnitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        // ===== UNIQUE NUMBERS FOR EACH UNIT =====
        uniqueNumbers: [{
            number: {
                type: String,
                required: true,
                trim: true
            },
            isUsed: {
                type: Boolean,
                default: false
            }
        }]
    }],

    // ===== TAX INFO =====
    taxSlab: {
        type: Number,
        required: true,
        enum: [0, 5, 12, 18, 28],
        default: 18
    },
    taxType: {
        type: String,
        enum: ['GST', 'IGST', 'CGST_SGST'],
        required: true,
        default: 'GST'
    },

    // ===== CALCULATIONS =====
    subtotal: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    totalDiscount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    totalTax: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },

    // ===== TAX BREAKDOWN =====
    taxBreakdown: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
        gst: { type: Number, default: 0 }
    },

    // ===== NOTES =====
    notes: {
        type: String,
        trim: true,
        default: ''
    },

    // ===== CREATED BY =====
    createdBy: {
        type: String,
        required: true,
        trim: true
    },
    createdById: {
        type: String,
        required: true
    },

    // ===== DELETION TRACKING =====
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: String,
        trim: true
    },
    deletedAt: {
        type: Date
    },

    // ===== STATUS =====
    status: {
        type: String,
        enum: ['Draft', 'Completed', 'Cancelled'],
        default: 'Completed'
    }

}, {
    timestamps: true,
});

// ===== INDEXES =====
salesSchema.index({ invoiceNumber: 1 });
salesSchema.index({ internalInvoiceNumber: 1 });
salesSchema.index({ customerId: 1 });
salesSchema.index({ customerName: 1 });
salesSchema.index({ saleDate: -1 });
salesSchema.index({ storeType: 1 });
salesSchema.index({ isDeleted: 1 });
salesSchema.index({ 'items.uniqueNumbers.number': 1 });

// ===== VIRTUALS =====
salesSchema.virtual('totalItems').get(function () {
    return this.items ? this.items.length : 0;
});

salesSchema.virtual('totalQuantity').get(function () {
    if (!this.items) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// ===== METHOD: Recalculate all totals =====
salesSchema.methods.recalculateTotals = function () {
    let subtotal = 0;
    let totalDiscount = 0;

    this.items.forEach(item => {
        const discountFactor = (100 - item.discountPercent) / 100;
        item.discountedUnitPrice = item.unitPrice * discountFactor;
        item.discountAmount = item.unitPrice - item.discountedUnitPrice;
        item.finalPrice = item.discountedUnitPrice * item.quantity;

        subtotal += item.unitPrice * item.quantity;
        totalDiscount += item.discountAmount * item.quantity;
    });

    this.subtotal = subtotal;
    this.totalDiscount = totalDiscount;

    // ✅ If Non-GST mode, NO tax calculation
    if (!this.isGstMode) {
        this.totalTax = 0;
        this.taxBreakdown = { cgst: 0, sgst: 0, igst: 0, gst: 0 };
        this.grandTotal = this.subtotal - this.totalDiscount;
        return this;
    }

    // ✅ GST Mode - Calculate tax
    const taxableAmount = this.subtotal - this.totalDiscount;
    const taxRate = this.taxSlab / 100;

    if (this.taxType === 'IGST' || this.taxType === 'GST') {
        this.totalTax = taxableAmount * taxRate;
        this.taxBreakdown = {
            igst: this.taxType === 'IGST' ? this.totalTax : 0,
            gst: this.taxType === 'GST' ? this.totalTax : 0,
            cgst: 0,
            sgst: 0
        };
    } else if (this.taxType === 'CGST_SGST') {
        const halfTax = (taxableAmount * taxRate) / 2;
        this.totalTax = taxableAmount * taxRate;
        this.taxBreakdown = {
            cgst: halfTax,
            sgst: halfTax,
            igst: 0,
            gst: 0
        };
    }

    this.grandTotal = this.subtotal - this.totalDiscount + this.totalTax;
    return this;
};

// ===== METHOD: Validate unique numbers =====
salesSchema.methods.validateUniqueNumbers = function () {
    const allNumbers = [];

    for (const item of this.items) {
        if (item.uniqueNumbers && item.uniqueNumbers.length > 0) {
            for (const un of item.uniqueNumbers) {
                if (un.number) {
                    // Check if number already exists in the list
                    if (allNumbers.includes(un.number)) {
                        throw new Error(`Duplicate unique number found: ${un.number}`);
                    }
                    allNumbers.push(un.number);
                }
            }
        }
    }

    return true;
};

// ===== METHOD: Add unique number to a product =====
salesSchema.methods.addUniqueNumber = function (productIndex, number) {
    if (!this.items[productIndex]) {
        throw new Error('Product not found');
    }

    // Check if number already exists in the invoice
    const allNumbers = [];
    for (const item of this.items) {
        for (const un of item.uniqueNumbers) {
            if (un.number) {
                allNumbers.push(un.number);
            }
        }
    }

    if (allNumbers.includes(number)) {
        throw new Error(`Number "${number}" already exists in this invoice`);
    }

    this.items[productIndex].uniqueNumbers.push({ number, isUsed: false });
    return this;
};

// ===== METHOD: Remove unique number from a product =====
salesSchema.methods.removeUniqueNumber = function (productIndex, numberIndex) {
    if (!this.items[productIndex]) {
        throw new Error('Product not found');
    }

    if (!this.items[productIndex].uniqueNumbers[numberIndex]) {
        throw new Error('Unique number not found');
    }

    this.items[productIndex].uniqueNumbers.splice(numberIndex, 1);
    return this;
};

// ===== METHOD: Update unique numbers for a product (sync with quantity) =====
salesSchema.methods.syncUniqueNumbersWithQuantity = function (productIndex) {
    const item = this.items[productIndex];
    if (!item) {
        throw new Error('Product not found');
    }

    const currentQty = item.quantity;
    const currentUniqueNumbers = item.uniqueNumbers || [];

    // If quantity is less than unique numbers count, remove extras
    if (currentUniqueNumbers.length > currentQty) {
        // Keep only the first 'qty' numbers
        item.uniqueNumbers = currentUniqueNumbers.slice(0, currentQty);
    }
    // If quantity is more, add empty slots
    else if (currentUniqueNumbers.length < currentQty) {
        const difference = currentQty - currentUniqueNumbers.length;
        for (let i = 0; i < difference; i++) {
            item.uniqueNumbers.push({ number: '', isUsed: false });
        }
    }

    return this;
};

salesSchema.set('toJSON', { virtuals: true });
salesSchema.set('toObject', { virtuals: true });

const Sales = mongoose.models.Sales || mongoose.model('Sales', salesSchema);
module.exports = Sales;