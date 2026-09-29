const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const itemInventorySchema = new mongoose.Schema({
    inventoryId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },

    // ===== STORE TYPE =====
    storeType: {
        type: String,
        enum: ['Vadodara', 'Padra'],
        required: true,
        default: 'Vadodara'
    },

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
    hsnCode: {
        type: String,
        required: true,
        trim: true
    },
    unitId: {
        type: String,
        required: true,
        ref: 'Unit'
    },
    unitName: {
        type: String,
        required: true,
        trim: true
    },

    // ===== TOTAL QUANTITY (calculated) =====
    totalQuantity: {
        type: Number,
        default: 0,
        min: 0
    },

    // ===== ADD HISTORY (Inward/Purchase) =====
    addHistory: [{
        entryId: {
            type: String,
            default: () => uuidv4(),
        },
        quantity: {
            type: Number,
            required: true,
            min: 0.01
        },
        purchasePrice: {
            type: Number,
            default: 0,
            min: 0
        },
        date: {
            type: Date,
            default: Date.now
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
        notes: {
            type: String,
            trim: true,
            default: ''
        },
        // Store type for this specific entry (for audit)
        entryStoreType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            required: true,
            default: 'Vadodara'
        },
        // Soft delete for audit
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

    // ===== REMOVE HISTORY (Outward/Issue) =====
    removeHistory: [{
        entryId: {
            type: String,
            default: () => uuidv4(),
        },
        quantity: {
            type: Number,
            required: true,
            min: 0.01
        },
        date: {
            type: Date,
            default: Date.now
        },
        removedBy: {
            type: String,
            required: true,
            trim: true
        },
        removedById: {
            type: String,
            required: true
        },
        reason: {
            type: String,
            trim: true,
            default: ''
        },
        // Store type for this specific entry (for audit)
        entryStoreType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            required: true,
            default: 'Vadodara'
        },
        // Soft delete for audit
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
// ✅ Unique combination: itemId + storeType
itemInventorySchema.index({ itemId: 1, storeType: 1 }, { unique: true });
itemInventorySchema.index({ storeType: 1 });
itemInventorySchema.index({ itemName: 1 });
itemInventorySchema.index({ 'addHistory.date': -1 });
itemInventorySchema.index({ 'removeHistory.date': -1 });

// ===== PRE-SAVE HOOK: Calculate total quantity and average price =====
itemInventorySchema.pre('save', function (next) {
    // Calculate total quantity from active entries only
    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    // Calculate average purchase price from active add entries with price > 0
    const addEntriesWithPrice = this.addHistory
        .filter(entry => !entry.isDeleted && entry.purchasePrice > 0);

    if (addEntriesWithPrice.length > 0) {
        const totalCost = addEntriesWithPrice.reduce(
            (sum, entry) => sum + (entry.purchasePrice * entry.quantity), 0
        );
        const totalQty = addEntriesWithPrice.reduce(
            (sum, entry) => sum + entry.quantity, 0
        );
        this.averagePurchasePrice = totalCost / totalQty;
    } else {
        this.averagePurchasePrice = 0;
    }

    next();
});

// ===== VIRTUAL: Get all active add entries =====
itemInventorySchema.virtual('activeAddHistory').get(function () {
    return this.addHistory.filter(entry => !entry.isDeleted);
});

// ===== VIRTUAL: Get all active remove entries =====
itemInventorySchema.virtual('activeRemoveHistory').get(function () {
    return this.removeHistory.filter(entry => !entry.isDeleted);
});

// ===== METHOD: Add quantity =====
itemInventorySchema.methods.addQuantity = function (quantity, purchasePrice, addedBy, addedById, date, notes) {
    this.addHistory.push({
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice) || 0,
        date: date || new Date(),
        addedBy: addedBy,
        addedById: addedById,
        notes: notes || '',
        entryStoreType: this.storeType // ✅ Store the store type in history
    });

    // Recalculate totals
    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    // Recalculate average price
    const addEntriesWithPrice = this.addHistory
        .filter(entry => !entry.isDeleted && entry.purchasePrice > 0);

    if (addEntriesWithPrice.length > 0) {
        const totalCost = addEntriesWithPrice.reduce(
            (sum, entry) => sum + (entry.purchasePrice * entry.quantity), 0
        );
        const totalQty = addEntriesWithPrice.reduce(
            (sum, entry) => sum + entry.quantity, 0
        );
        this.averagePurchasePrice = totalCost / totalQty;
    }

    return this.save();
};

// ===== METHOD: Remove quantity =====
itemInventorySchema.methods.removeQuantity = function (quantity, removedBy, removedById, date, reason) {
    // Check if enough quantity is available
    if (this.totalQuantity < quantity) {
        throw new Error(`Insufficient quantity. Available: ${this.totalQuantity}, Requested: ${quantity}`);
    }

    this.removeHistory.push({
        quantity: Number(quantity),
        date: date || new Date(),
        removedBy: removedBy,
        removedById: removedById,
        reason: reason || '',
        entryStoreType: this.storeType // ✅ Store the store type in history
    });

    // Recalculate total
    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== METHOD: Soft delete an add entry =====
itemInventorySchema.methods.deleteAddEntry = function (entryId, deletedBy) {
    const entry = this.addHistory.find(e => e.entryId === entryId);
    if (!entry) {
        throw new Error('Add entry not found');
    }
    if (entry.isDeleted) {
        throw new Error('Entry already deleted');
    }

    entry.isDeleted = true;
    entry.deletedBy = deletedBy;
    entry.deletedAt = new Date();

    // Recalculate totals
    const totalAdded = this.addHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== METHOD: Soft delete a remove entry =====
itemInventorySchema.methods.deleteRemoveEntry = function (entryId, deletedBy) {
    const entry = this.removeHistory.find(e => e.entryId === entryId);
    if (!entry) {
        throw new Error('Remove entry not found');
    }
    if (entry.isDeleted) {
        throw new Error('Entry already deleted');
    }

    entry.isDeleted = true;
    entry.deletedBy = deletedBy;
    entry.deletedAt = new Date();

    // Recalculate totals
    const totalAdded = this.addHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== Ensure virtuals are included in JSON =====
itemInventorySchema.set('toJSON', { virtuals: true });
itemInventorySchema.set('toObject', { virtuals: true });

const ItemInventory = mongoose.models.ItemInventory || mongoose.model('ItemInventory', itemInventorySchema);
module.exports = ItemInventory;