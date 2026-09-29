const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const amcSchema = new mongoose.Schema({
    amcId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    amcNumber: {
        type: String,
        unique: true,
        required: true,
    },

    // ===== RENEWAL LINK =====
    renewalOf: {
        type: String,
        default: null,  // amcId of previous AMC (null if first AMC)
    },

    renewalOfNumber: {        // ← NEW
        type: String,
        default: null,
    },

    // ===== LINKED SALE (optional) =====
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
        }
    }],

    // ===== DURATION & DATES =====
    durationYears: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 5],
        default: 1
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },

    // ===== STATUS =====
    status: {
        type: String,
        enum: ['Active', 'Pending', 'Expired', 'Cancelled'],
        default: 'Active',
        required: true
    },

    // ===== SERVICE HISTORY (array of visits) =====
    serviceHistory: [{
        serviceId: {
            type: String,
            default: () => uuidv4()
        },
        productId: {
            type: String,
            required: true
        },
        productName: {
            type: String,
            required: true,
            trim: true
        },
        serviceDate: {
            type: Date,
            default: Date.now,
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 0.01
        },
        storeType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            default: 'Vadodara'
        },
        notes: {
            type: String,
            trim: true,
            default: ''
        },
        servicedBy: {
            type: String,
            trim: true
        },
        servicedById: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

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
amcSchema.index({ amcNumber: 1 });
amcSchema.index({ renewalOf: 1 });
amcSchema.index({ customerId: 1 });
amcSchema.index({ customerName: 1 });
amcSchema.index({ startDate: -1 });
amcSchema.index({ endDate: 1 });
amcSchema.index({ status: 1 });
amcSchema.index({ storeType: 1 });
amcSchema.index({ linkedSaleId: 1 });

// ===== VIRTUALS =====
amcSchema.virtual('totalProducts').get(function () {
    return this.products ? this.products.length : 0;
});

amcSchema.virtual('totalQuantity').get(function () {
    if (!this.products) return 0;
    return this.products.reduce((sum, p) => sum + p.quantity, 0);
});

amcSchema.virtual('totalServiceVisits').get(function () {
    return this.serviceHistory ? this.serviceHistory.length : 0;
});

// ===== METHOD: Recalculate all totals =====
amcSchema.methods.recalculateTotals = function () {
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

// ===== METHOD: Calculate endDate from startDate + durationYears =====
amcSchema.methods.calculateEndDate = function () {
    if (!this.startDate || !this.durationYears) return this.endDate;
    const end = new Date(this.startDate);
    end.setFullYear(end.getFullYear() + this.durationYears);
    // Subtract 1 day so 1 Jan 2026 → 31 Dec 2026 (not 1 Jan 2027)
    end.setDate(end.getDate() - 1);
    this.endDate = end;
    return this;
};

amcSchema.set('toJSON', { virtuals: true });
amcSchema.set('toObject', { virtuals: true });

const AMC = mongoose.models.AMC || mongoose.model('AMC', amcSchema);
module.exports = AMC;