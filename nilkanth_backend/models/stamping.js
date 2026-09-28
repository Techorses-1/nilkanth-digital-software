const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stampingSchema = new mongoose.Schema({
    stampingId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    stampingNumber: {
        type: String,
        unique: true,
        required: true,
    },

    // ===== LINKED SALE (optional — only when created from Sale) =====
    linkedSaleId: {
        type: String,
        default: null,
    },
    linkedInvoiceNumber: {
        type: String,
        default: null,
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

    // ===== PRODUCTS =====
    products: [{
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
        discountedUnitPrice: {
            type: Number,
            default: 0,
            min: 0
        },
        finalPrice: {
            type: Number,
            required: true,
            min: 0
        },

        // ===== UNIQUE NUMBERS (required here — one per unit) =====
        uniqueNumbers: [{
            number: {
                type: String,
                trim: true,
                default: ''
            },
            isUsed: {
                type: Boolean,
                default: true
            }
        }]
    }],

    // ===== STAMP DATE =====
    stampDate: {
        type: Date,
        required: true,
        default: Date.now
    },

    // ===== GST =====
    isGstMode: {
        type: Boolean,
        default: true,
        required: true
    },
    taxSlab: {
        type: Number,
        enum: [0, 5, 12, 18, 28],
        default: 18
    },
    taxType: {
        type: String,
        enum: ['GST', 'IGST', 'CGST_SGST'],
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

    // ===== PAYMENT =====
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Pending'],
        default: 'Paid',
        required: true
    },
    paymentType: {
        type: String,
        enum: ['Cash', 'Bank', 'UPI', 'Cheque', null],
        default: 'Cash',
        required: false
    },

    // ===== NOTES =====
    notes: {
        type: String,
        trim: true,
        default: ''
    },

    // ===== AUDIT =====
    createdBy: {
        type: String,
        required: true,
        trim: true
    },
    createdById: {
        type: String,
        required: true
    },
    updatedBy: {
        type: String,
        default: null
    },
    updatedById: {
        type: String,
        default: null
    }

}, {
    timestamps: true,
});

// ===== INDEXES =====
stampingSchema.index({ stampingNumber: 1 });
stampingSchema.index({ customerId: 1 });
stampingSchema.index({ customerName: 1 });
stampingSchema.index({ stampDate: -1 });
stampingSchema.index({ storeType: 1 });
stampingSchema.index({ linkedSaleId: 1 });
stampingSchema.index({ 'products.uniqueNumbers.number': 1 });

// ===== VIRTUALS =====
stampingSchema.virtual('totalProducts').get(function () {
    return this.products ? this.products.length : 0;
});

stampingSchema.virtual('totalQuantity').get(function () {
    if (!this.products) return 0;
    return this.products.reduce((sum, p) => sum + p.quantity, 0);
});

// ===== METHOD: Recalculate all totals =====
stampingSchema.methods.recalculateTotals = function () {
    let subtotal = 0;
    let totalDiscount = 0;

    this.products.forEach(product => {
        const discountFactor = (100 - product.discountPercent) / 100;
        product.discountedUnitPrice = product.unitPrice * discountFactor;
        product.discountAmount = product.unitPrice - product.discountedUnitPrice;
        product.finalPrice = product.discountedUnitPrice * product.quantity;

        subtotal += product.unitPrice * product.quantity;
        totalDiscount += product.discountAmount * product.quantity;
    });

    this.subtotal = subtotal;
    this.totalDiscount = totalDiscount;

    // If Non-GST mode, no tax
    if (!this.isGstMode) {
        this.totalTax = 0;
        this.taxBreakdown = { cgst: 0, sgst: 0, igst: 0, gst: 0 };
        this.grandTotal = this.subtotal - this.totalDiscount;
        return this;
    }

    // GST Mode - Calculate tax
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

stampingSchema.set('toJSON', { virtuals: true });
stampingSchema.set('toObject', { virtuals: true });

const Stamping = mongoose.models.Stamping || mongoose.model('Stamping', stampingSchema);
module.exports = Stamping;