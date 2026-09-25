const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productInventorySchema = new mongoose.Schema({
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

  productId: {
    type: String,
    required: true,
    ref: 'Product',
    unique: true
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
  hsnCode: {
    type: String,
    required: true,
    trim: true
  },
  // ❌ REMOVED unitId
  // ❌ REMOVED unitName

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
productInventorySchema.index({ productId: 1, storeType: 1 }, { unique: true });
productInventorySchema.index({ storeType: 1 });
productInventorySchema.index({ productName: 1 });
productInventorySchema.index({ 'addHistory.date': -1 });
productInventorySchema.index({ 'removeHistory.date': -1 });

// ===== PRE-SAVE HOOK =====
productInventorySchema.pre('save', function (next) {
  const totalAdded = this.addHistory
    .filter(entry => !entry.isDeleted)
    .reduce((sum, entry) => sum + entry.quantity, 0);

  const totalRemoved = this.removeHistory
    .filter(entry => !entry.isDeleted)
    .reduce((sum, entry) => sum + entry.quantity, 0);

  this.totalQuantity = totalAdded - totalRemoved;

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

// ===== VIRTUALS =====
productInventorySchema.virtual('activeAddHistory').get(function () {
  return this.addHistory.filter(entry => !entry.isDeleted);
});

productInventorySchema.virtual('activeRemoveHistory').get(function () {
  return this.removeHistory.filter(entry => !entry.isDeleted);
});

// ===== METHOD: Add quantity =====
productInventorySchema.methods.addQuantity = function (quantity, purchasePrice, addedBy, addedById, date, notes) {
  this.addHistory.push({
    quantity: Number(quantity),
    purchasePrice: Number(purchasePrice) || 0,
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
productInventorySchema.methods.removeQuantity = function (quantity, removedBy, removedById, date, reason) {
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
productInventorySchema.methods.deleteAddEntry = function (entryId, deletedBy) {
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
productInventorySchema.methods.deleteRemoveEntry = function (entryId, deletedBy) {
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

  const totalAdded = this.addHistory
    .filter(e => !e.isDeleted)
    .reduce((sum, e) => sum + e.quantity, 0);

  const totalRemoved = this.removeHistory
    .filter(e => !e.isDeleted)
    .reduce((sum, e) => sum + e.quantity, 0);

  this.totalQuantity = totalAdded - totalRemoved;

  return this.save();
};

productInventorySchema.set('toJSON', { virtuals: true });
productInventorySchema.set('toObject', { virtuals: true });

const ProductInventory = mongoose.models.ProductInventory || mongoose.model('ProductInventory', productInventorySchema);
module.exports = ProductInventory;