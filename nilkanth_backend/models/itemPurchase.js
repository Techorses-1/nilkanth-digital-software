const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const itemPurchaseSchema = new mongoose.Schema({
    purchaseId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    productType: {
        type: String,
        default: 'item',
        enum: ['item']
    },

    // ===== STORE TYPE =====
    storeType: {
        type: String,
        enum: ['Vadodara', 'Padra'],
        required: true,
        default: 'Vadodara'
    },

    // ===== ITEM FIELDS =====
    itemId: {
        type: String,
        required: true,
        ref: 'Item'
    },
    itemName: {
        type: String,
        required: true,
        trim: true
    },
    itemDescription: {
        type: String,
        trim: true,
        default: ''
    },
    itemHsnCode: {
        type: String,
        required: true,
        trim: true
    },
    itemUnitId: {
        type: String,
        ref: 'Unit'
    },
    itemUnitName: {
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
itemPurchaseSchema.index({ storeType: 1 });
itemPurchaseSchema.index({ itemId: 1 });
itemPurchaseSchema.index({ itemName: 1 });
itemPurchaseSchema.index({ 'purchaseHistory.vendorId': 1 });
itemPurchaseSchema.index({ 'purchaseHistory.addedAt': -1 });
itemPurchaseSchema.index({ createdAt: -1 });

// ===== PRE-SAVE HOOK: Calculate total quantity and average price =====
itemPurchaseSchema.pre('save', function (next) {
    const activeEntries = this.purchaseHistory.filter(entry => !entry.isDeleted);

    // Calculate total quantity
    this.totalQuantity = activeEntries.reduce((sum, entry) => sum + entry.quantity, 0);

    // Calculate average purchase price (only from entries with price > 0)
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
itemPurchaseSchema.virtual('activeHistory').get(function () {
    return this.purchaseHistory.filter(entry => !entry.isDeleted);
});

// ===== VIRTUAL: Get deleted entries =====
itemPurchaseSchema.virtual('deletedHistory').get(function () {
    return this.purchaseHistory.filter(entry => entry.isDeleted);
});

// ===== METHOD: Add new purchase entry =====
itemPurchaseSchema.methods.addPurchaseEntry = function (vendorId, vendorName, quantity, purchasePrice, addedBy, addedById) {
    this.purchaseHistory.push({
        vendorId,
        vendorName,
        quantity,
        purchasePrice: purchasePrice || 0,
        addedBy,
        addedById,
        addedAt: new Date()
    });

    // Recalculate totals
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
itemPurchaseSchema.methods.deleteEntry = function (entryId, deletedBy) {
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

    // Recalculate totals
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
itemPurchaseSchema.set('toJSON', { virtuals: true });
itemPurchaseSchema.set('toObject', { virtuals: true });

const ItemPurchase = mongoose.models.ItemPurchase || mongoose.model('ItemPurchase', itemPurchaseSchema);
module.exports = ItemPurchase;