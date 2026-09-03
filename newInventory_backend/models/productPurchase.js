const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productPurchaseSchema = new mongoose.Schema({
    purchaseId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    productType: {
        type: String,
        default: 'product',
        enum: ['product']
    },

    // ===== STORE TYPE =====
    storeType: {
        type: String,
        enum: ['Vadodara', 'Padra'],
        required: true,
        default: 'Vadodara'
    },

    // ===== PRODUCT FIELDS =====
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
        trim: true,
        default: ''
    },
    productHsnCode: {
        type: String,
        required: true,
        trim: true
    },

    // ===== PURCHASE HISTORY ARRAY =====
    purchaseHistory: [{
        entryId: {
            type: String,
            default: () => uuidv4(),
        },
        vendorId: {
            type: String,
            required: true,
            ref: 'Vendor'
        },
        vendorName: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        purchasePrice: {
            type: Number,
            default: 0,
            min: 0
        },
        addedBy: {
            type: String,
            required: true,
            trim: true
        },
        addedById: {
            type: String,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        // Deletion tracking per entry
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
        }
    }],

    // ===== TOTAL QUANTITY (calculated) =====
    totalQuantity: {
        type: Number,
        default: 0,
        min: 0
    },

    // ===== AVERAGE PURCHASE PRICE (calculated) =====
    averagePurchasePrice: {
        type: Number,
        default: 0,
        min: 0
    }

}, {
    timestamps: true,
});

// ===== INDEXES =====
productPurchaseSchema.index({ storeType: 1 });
productPurchaseSchema.index({ productId: 1 });
productPurchaseSchema.index({ productName: 1 });
productPurchaseSchema.index({ 'purchaseHistory.vendorId': 1 });
productPurchaseSchema.index({ 'purchaseHistory.addedAt': -1 });
productPurchaseSchema.index({ createdAt: -1 });

// ===== PRE-SAVE HOOK: Calculate total quantity and average price =====
productPurchaseSchema.pre('save', function (next) {
    const activeEntries = this.purchaseHistory.filter(entry => !entry.isDeleted);

    this.totalQuantity = activeEntries.reduce((sum, entry) => sum + entry.quantity, 0);

    const entriesWithPrice = activeEntries.filter(entry => entry.purchasePrice > 0);
    if (entriesWithPrice.length > 0) {
        const totalCost = entriesWithPrice.reduce((sum, entry) => sum + (entry.purchasePrice * entry.quantity), 0);
        const totalQty = entriesWithPrice.reduce((sum, entry) => sum + entry.quantity, 0);
        this.averagePurchasePrice = totalCost / totalQty;
    } else {
        this.averagePurchasePrice = 0;
    }

    next();
});

// ===== VIRTUAL: Get only active (non-deleted) entries =====
productPurchaseSchema.virtual('activeHistory').get(function () {
    return this.purchaseHistory.filter(entry => !entry.isDeleted);
});

// ===== VIRTUAL: Get deleted entries =====
productPurchaseSchema.virtual('deletedHistory').get(function () {
    return this.purchaseHistory.filter(entry => entry.isDeleted);
});

// ===== METHOD: Add new purchase entry =====
productPurchaseSchema.methods.addPurchaseEntry = function (vendorId, vendorName, quantity, purchasePrice, addedBy, addedById) {
    this.purchaseHistory.push({
        vendorId,
        vendorName,
        quantity,
        purchasePrice: purchasePrice || 0,
        addedBy,
        addedById,
        addedAt: new Date()
    });

    const activeEntries = this.purchaseHistory.filter(entry => !entry.isDeleted);
    this.totalQuantity = activeEntries.reduce((sum, entry) => sum + entry.quantity, 0);

    const entriesWithPrice = activeEntries.filter(entry => entry.purchasePrice > 0);
    if (entriesWithPrice.length > 0) {
        const totalCost = entriesWithPrice.reduce((sum, entry) => sum + (entry.purchasePrice * entry.quantity), 0);
        const totalQty = entriesWithPrice.reduce((sum, entry) => sum + entry.quantity, 0);
        this.averagePurchasePrice = totalCost / totalQty;
    }

    return this.save();
};

// ===== METHOD: Soft delete an entry =====
productPurchaseSchema.methods.deleteEntry = function (entryId, deletedBy) {
    const entry = this.purchaseHistory.find(e => e.entryId === entryId);

    if (!entry) {
        throw new Error('Purchase entry not found');
    }

    if (entry.isDeleted) {
        throw new Error('Entry already deleted');
    }

    entry.isDeleted = true;
    entry.deletedBy = deletedBy;
    entry.deletedAt = new Date();

    const activeEntries = this.purchaseHistory.filter(e => !e.isDeleted);
    this.totalQuantity = activeEntries.reduce((sum, e) => sum + e.quantity, 0);

    const entriesWithPrice = activeEntries.filter(e => e.purchasePrice > 0);
    if (entriesWithPrice.length > 0) {
        const totalCost = entriesWithPrice.reduce((sum, e) => sum + (e.purchasePrice * e.quantity), 0);
        const totalQty = entriesWithPrice.reduce((sum, e) => sum + e.quantity, 0);
        this.averagePurchasePrice = totalCost / totalQty;
    }

    return this.save();
};

// ===== Ensure virtuals are included in JSON =====
productPurchaseSchema.set('toJSON', { virtuals: true });
productPurchaseSchema.set('toObject', { virtuals: true });

const ProductPurchase = mongoose.models.ProductPurchase || mongoose.model('ProductPurchase', productPurchaseSchema);
module.exports = ProductPurchase;