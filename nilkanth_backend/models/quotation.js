const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const quotationSchema = new mongoose.Schema({
    quotationId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    quotationNumber: {
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

    // ===== QUOTATION DATE =====
    quotationDate: {
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
        invoiceDescription: {
            type: String,
            trim: true,
            default: ''
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
        capacity: {
            type: String,
            trim: true,
            default: ''
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
        uniqueNumbers: [{
            number: {
                type: String,
                trim: true,
                default: ''
            },
            isUsed: {
                type: Boolean,
                default: false
            }
        }]
    }],

    // ===== CALCULATIONS (NO TAX) =====
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
    grandTotal: {
        type: Number,
        required: true,
        min: 0,
        default: 0
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
quotationSchema.index({ quotationNumber: 1 });
quotationSchema.index({ customerId: 1 });
quotationSchema.index({ customerName: 1 });
quotationSchema.index({ quotationDate: -1 });
quotationSchema.index({ storeType: 1 });
quotationSchema.index({ 'items.uniqueNumbers.number': 1 });

// ===== VIRTUALS =====
quotationSchema.virtual('totalItems').get(function () {
    return this.items ? this.items.length : 0;
});

quotationSchema.virtual('totalQuantity').get(function () {
    if (!this.items) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// ===== METHOD: Recalculate totals (NO TAX) =====
quotationSchema.methods.recalculateTotals = function () {
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
    this.grandTotal = subtotal - totalDiscount;  // NO TAX

    return this;
};

quotationSchema.set('toJSON', { virtuals: true });
quotationSchema.set('toObject', { virtuals: true });

const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
module.exports = Quotation;