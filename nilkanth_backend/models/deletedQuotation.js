const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const deletedQuotationSchema = new mongoose.Schema({
    // ===== ORIGINAL QUOTATION DATA =====
    originalQuotationId: {
        type: String,
        required: true,
    },
    quotationId: {
        type: String,
        default: () => uuidv4(),
    },
    quotationNumber: {
        type: String,
        required: true,
    },
    customerId: String,
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    customerGstin: String,
    customerState: String,
    customerAddress: String,
    storeType: String,
    quotationDate: Date,
    items: [{
        productId: String,
        productName: String,
        productDescription: String,
        invoiceDescription: String,
        hsnCode: String,
        unitName: String,
        capacity: String,
        quantity: Number,
        unitPrice: Number,
        discountPercent: Number,
        discountAmount: Number,
        finalPrice: Number,
        discountedUnitPrice: Number,
        uniqueNumbers: [{
            number: String,
            isUsed: Boolean
        }]
    }],
    subtotal: Number,
    totalDiscount: Number,
    grandTotal: Number,
    notes: String,
    createdBy: String,
    createdById: String,
    status: String,

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
deletedQuotationSchema.index({ quotationNumber: 1 });
deletedQuotationSchema.index({ customerId: 1 });
deletedQuotationSchema.index({ deletedAt: -1 });

const DeletedQuotation = mongoose.models.DeletedQuotation || mongoose.model('DeletedQuotation', deletedQuotationSchema);
module.exports = DeletedQuotation;