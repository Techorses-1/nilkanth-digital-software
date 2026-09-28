const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const deletedAmcSchema = new mongoose.Schema({
    // ===== ORIGINAL AMC DATA (copy all) =====
    originalAmcId: {
        type: String,
        required: true,
    },
    amcId: {
        type: String,
        default: () => uuidv4(),
    },
    amcNumber: {
        type: String,
        required: true,
    },
    renewalOf: {
        type: String,
        default: null,
    },
    linkedSaleId: {
        type: String,
        default: null,
    },
    linkedInvoiceNumber: {
        type: String,
        default: null,
    },
    customerId: String,
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    customerGstin: String,
    customerState: String,
    customerAddress: String,
    storeType: String,
    products: [{
        productId: String,
        productName: String,
        productDescription: String,
        invoiceDescription: String,
        hsnCode: String,
        capacity: String,
        quantity: Number,
        unitPrice: Number,
        discountPercent: Number,
        discountAmount: Number,
        discountedUnitPrice: Number,
        finalPrice: Number
    }],
    durationYears: Number,
    startDate: Date,
    endDate: Date,
    status: String,
    serviceHistory: [{
        serviceId: String,
        productId: String,
        productName: String,
        serviceDate: Date,
        quantity: Number,
        storeType: String,
        notes: String,
        servicedBy: String,
        servicedById: String,
        createdAt: Date
    }],
    paymentStatus: String,
    paymentType: String,
    isGstMode: Boolean,
    taxSlab: Number,
    taxType: String,
    subtotal: Number,
    totalDiscount: Number,
    totalTax: Number,
    grandTotal: Number,
    taxBreakdown: {
        cgst: Number,
        sgst: Number,
        igst: Number,
        gst: Number
    },
    notes: String,
    createdBy: String,
    createdById: String,
    updatedBy: String,
    updatedById: String,

    // ===== DELETION INFO =====
    deletedBy: {
        type: String,
        required: true,
        trim: true
    },
    deletedById: {
        type: String,
        required: true
    },
    deletedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    deletedReason: {
        type: String,
        trim: true,
        default: ''
    }

}, {
    timestamps: true,
});

// ===== INDEXES =====
deletedAmcSchema.index({ amcNumber: 1 });
deletedAmcSchema.index({ customerId: 1 });
deletedAmcSchema.index({ deletedAt: -1 });

const DeletedAmc = mongoose.models.DeletedAmc || mongoose.model('DeletedAmc', deletedAmcSchema);
module.exports = DeletedAmc;