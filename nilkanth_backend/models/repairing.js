const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const repairingSchema = new mongoose.Schema({
    repairingId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    repairingNumber: {
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

    // ===== PAYMENT STATUS =====
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Pending'],
        default: 'Paid',
        required: true
    },

    // ===== PAYMENT TYPE (Only when Paid) =====
    paymentType: {
        type: String,
        enum: ['Cash', 'Bank', 'UPI', 'Cheque', null],
        default: 'Cash',
        required: false
    },

    // ===== GST MODE =====
    isGstMode: {
        type: Boolean,
        default: true,
        required: true
    },

    // ===== REPAIRING DATE =====
    repairingDate: {
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
        }
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

    // ===== REPAIR NOTES (Replaces Notes) =====
    repairNotes: {
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
repairingSchema.index({ repairingNumber: 1 });
repairingSchema.index({ customerId: 1 });
repairingSchema.index({ customerName: 1 });
repairingSchema.index({ repairingDate: -1 });
repairingSchema.index({ storeType: 1 });

// ===== VIRTUALS =====
repairingSchema.virtual('totalItems').get(function () {
    return this.items ? this.items.length : 0;
});

repairingSchema.virtual('totalQuantity').get(function () {
    if (!this.items) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// ===== METHOD: Recalculate all totals =====
repairingSchema.methods.recalculateTotals = function () {
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

    // Non-GST → No tax
    if (!this.isGstMode) {
        this.totalTax = 0;
        this.taxBreakdown = { cgst: 0, sgst: 0, igst: 0, gst: 0 };
        this.grandTotal = this.subtotal - this.totalDiscount;
        return this;
    }

    // GST Mode
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

repairingSchema.set('toJSON', { virtuals: true });
repairingSchema.set('toObject', { virtuals: true });

const Repairing = mongoose.models.Repairing || mongoose.model('Repairing', repairingSchema);
module.exports = Repairing;