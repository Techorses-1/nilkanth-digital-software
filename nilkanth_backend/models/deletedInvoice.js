const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const deletedInvoiceSchema = new mongoose.Schema({
    // ===== ORIGINAL SALE DATA (copy all) =====
    originalSaleId: {
        type: String,
        required: true,
    },
    saleId: {
        type: String,
        default: () => uuidv4(),
    },
    invoiceNumber: {
        type: String,
        required: true,
    },
    internalInvoiceNumber: {
        type: String,
        required: true,
    },
    isChallan: {
        type: Boolean,
        default: false
    },
    // ✅ NEW: Track GST mode for series identification
    isGstMode: {
        type: Boolean,
        default: true
    },
    customerId: String,
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    customerGstin: String,
    customerState: String,
    customerAddress: String,
    storeType: String,
    paymentStatus: String,
    paymentType: String,
    saleDate: Date,
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
deletedInvoiceSchema.index({ invoiceNumber: 1 });
deletedInvoiceSchema.index({ internalInvoiceNumber: 1 });
deletedInvoiceSchema.index({ customerId: 1 });
deletedInvoiceSchema.index({ deletedAt: -1 });
deletedInvoiceSchema.index({ isChallan: 1 });
// ✅ NEW: Index for isGstMode
deletedInvoiceSchema.index({ isGstMode: 1 });

const DeletedInvoice = mongoose.models.DeletedInvoice || mongoose.model('DeletedInvoice', deletedInvoiceSchema);
module.exports = DeletedInvoice;