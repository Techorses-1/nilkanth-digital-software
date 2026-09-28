const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const deletedStampingSchema = new mongoose.Schema({
    // ===== ORIGINAL STAMPING DATA =====
    originalStampingId: {
        type: String,
        required: true,
    },
    stampingId: {
        type: String,
        default: () => uuidv4(),
    },
    stampingNumber: {
        type: String,
        required: true,
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
        finalPrice: Number,
        uniqueNumbers: [{
            number: String,
            isUsed: Boolean
        }]
    }],

    stampDate: Date,

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

    paymentStatus: String,
    paymentType: String,
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
deletedStampingSchema.index({ stampingNumber: 1 });
deletedStampingSchema.index({ customerId: 1 });
deletedStampingSchema.index({ deletedAt: -1 });

const DeletedStamping = mongoose.models.DeletedStamping || mongoose.model('DeletedStamping', deletedStampingSchema);
module.exports = DeletedStamping;