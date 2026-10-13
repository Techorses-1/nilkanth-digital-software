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
        // ✅ NEW: Subtotal excluding GST (flat amount for this entry)
        subtotalExclGst: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        // ✅ NEW: GST amount (flat, decimals allowed)
        gst: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        // ✅ NEW: Total with GST = subtotalExclGst + gst
        totalWithGst: {
            type: Number,
            required: true,
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
        entryStoreType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            required: true,
            default: 'Vadodara'
        },
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
        entryStoreType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            required: true,
            default: 'Vadodara'
        },
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
    }]

}, {
    timestamps: true,
});

// ===== INDEXES =====
itemInventorySchema.index({ itemId: 1, storeType: 1 }, { unique: true });
itemInventorySchema.index({ storeType: 1 });
itemInventorySchema.index({ itemName: 1 });
itemInventorySchema.index({ 'addHistory.date': -1 });
itemInventorySchema.index({ 'removeHistory.date': -1 });

// ===== PRE-SAVE HOOK (only total quantity calc now) =====
itemInventorySchema.pre('save', function (next) {
    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    next();
});

// ===== VIRTUALS =====
itemInventorySchema.virtual('activeAddHistory').get(function () {
    return this.addHistory.filter(entry => !entry.isDeleted);
});

itemInventorySchema.virtual('activeRemoveHistory').get(function () {
    return this.removeHistory.filter(entry => !entry.isDeleted);
});

// ===== METHOD: Add quantity =====
itemInventorySchema.methods.addQuantity = function (
    quantity,
    subtotalExclGst,
    gst,
    addedBy,
    addedById,
    date,
    notes
) {
    const subtotal = Number(subtotalExclGst) || 0;
    const gstAmount = Number(gst) || 0;
    const totalWithGst = subtotal + gstAmount;

    this.addHistory.push({
        quantity: Number(quantity),
        subtotalExclGst: subtotal,
        gst: gstAmount,
        totalWithGst: totalWithGst,
        date: date || new Date(),
        addedBy: addedBy,
        addedById: addedById,
        notes: notes || '',
        entryStoreType: this.storeType
    });

    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== METHOD: Remove quantity =====
itemInventorySchema.methods.removeQuantity = function (quantity, removedBy, removedById, date, reason) {
    if (this.totalQuantity < quantity) {
        throw new Error(`Insufficient quantity. Available: ${this.totalQuantity}, Requested: ${quantity}`);
    }

    this.removeHistory.push({
        quantity: Number(quantity),
        date: date || new Date(),
        removedBy: removedBy,
        removedById: removedById,
        reason: reason || '',
        entryStoreType: this.storeType
    });

    const totalAdded = this.addHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(entry => !entry.isDeleted)
        .reduce((sum, entry) => sum + entry.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== METHOD: Delete add entry =====
itemInventorySchema.methods.deleteAddEntry = function (entryId, deletedBy) {
    const entry = this.addHistory.find(e => e.entryId === entryId);
    if (!entry) throw new Error('Add entry not found');
    if (entry.isDeleted) throw new Error('Entry already deleted');

    entry.isDeleted = true;
    entry.deletedBy = deletedBy;
    entry.deletedAt = new Date();

    const totalAdded = this.addHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

// ===== METHOD: Delete remove entry =====
itemInventorySchema.methods.deleteRemoveEntry = function (entryId, deletedBy) {
    const entry = this.removeHistory.find(e => e.entryId === entryId);
    if (!entry) throw new Error('Remove entry not found');
    if (entry.isDeleted) throw new Error('Entry already deleted');

    entry.isDeleted = true;
    entry.deletedBy = deletedBy;
    entry.deletedAt = new Date();

    const totalAdded = this.addHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    const totalRemoved = this.removeHistory
        .filter(e => !e.isDeleted)
        .reduce((sum, e) => sum + e.quantity, 0);

    this.totalQuantity = totalAdded - totalRemoved;

    return this.save();
};

itemInventorySchema.set('toJSON', { virtuals: true });
itemInventorySchema.set('toObject', { virtuals: true });

const ItemInventory = mongoose.models.ItemInventory || mongoose.model('ItemInventory', itemInventorySchema);
module.exports = ItemInventory;