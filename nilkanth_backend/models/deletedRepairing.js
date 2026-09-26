const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const deletedRepairingSchema = new mongoose.Schema({
    // ===== ORIGINAL REPAIRING DATA =====
    originalRepairingId: {
        type: String,
        required: true,
    },
    repairingId: {
        type: String,
        default: () => uuidv4(),
    },
    repairingNumber: {
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
    paymentStatus: String,
    paymentType: String,
    isGstMode: Boolean,
    repairingDate: Date,
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
        discountedUnitPrice: Number
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
    repairNotes: String,
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
deletedRepairingSchema.index({ repairingNumber: 1 });
deletedRepairingSchema.index({ customerId: 1 });
deletedRepairingSchema.index({ deletedAt: -1 });

const DeletedRepairing = mongoose.models.DeletedRepairing || mongoose.model('DeletedRepairing', deletedRepairingSchema);
module.exports = DeletedRepairing;