const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const inventorySchema = new mongoose.Schema({
  inventoryId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  productId: {
    type: String,
    required: true,
    ref: 'Product',
  },
  productName: {
    type: String,
    required: true,
  },
  productDescription: {
    type: String,
    required: true,
  },
  minimumQty: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  hsnCode: {
    type: String,
    required: true,
  },
  units: {
    type: String,
    required: true,
    enum: ['NOS', 'METERS', 'KG', 'GRAM', 'LITRE', 'ML']
  },
  // PRICE HISTORY - for inward/purchases
  priceHistory: [{
    price: {
      type: Number,
      required: true,
      min: 0.01
    },
    quantityAdded: {
      type: Number,
      required: true,
      min: 1
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    purchaseDate: {
      type: Date,
      required: false,
    }
  }],

  // OUTWARD HISTORY - UPDATED WITH PRICE (REQUIRED)
  outwardHistory: [{
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {                    // NEW FIELD - ADDED
      type: Number,
      required: true,           // REQUIRED as you said
      min: 0.01
    },
    outwardDate: {
      type: Date,
      default: Date.now,
    },
    issuedTo: {
      type: String,
      required: false,
      trim: true
    },
    issueDate: {
      type: Date,
      required: false,
    }
  }],

  // Total quantity calculated from priceHistory - outwardHistory
  totalQuantity: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for average purchase price
inventorySchema.virtual('averagePrice').get(function () {
  if (!this.priceHistory || this.priceHistory.length === 0) return 0;

  const totalCost = this.priceHistory.reduce((sum, entry) => {
    return sum + (entry.price * entry.quantityAdded);
  }, 0);

  const totalPurchasedQuantity = this.priceHistory.reduce((sum, entry) => {
    return sum + entry.quantityAdded;
  }, 0);

  return totalCost / totalPurchasedQuantity;
});

// Virtual for average selling price (NEW)
inventorySchema.virtual('averageSellingPrice').get(function () {
  if (!this.outwardHistory || this.outwardHistory.length === 0) return 0;

  const totalRevenue = this.outwardHistory.reduce((sum, entry) => {
    return sum + (entry.price * entry.quantity);
  }, 0);

  const totalSoldQuantity = this.outwardHistory.reduce((sum, entry) => {
    return sum + entry.quantity;
  }, 0);

  return totalRevenue / totalSoldQuantity;
});

// Virtual for total outward quantity
inventorySchema.virtual('totalOutward').get(function () {
  if (!this.outwardHistory || this.outwardHistory.length === 0) return 0;
  return this.outwardHistory.reduce((sum, entry) => sum + entry.quantity, 0);
});

// Virtual for total outward value (NEW)
inventorySchema.virtual('totalOutwardValue').get(function () {
  if (!this.outwardHistory || this.outwardHistory.length === 0) return 0;
  return this.outwardHistory.reduce((sum, entry) => sum + (entry.price * entry.quantity), 0);
});

// Update totalQuantity before saving
inventorySchema.pre('save', function (next) {
  const totalInward = this.priceHistory.reduce((total, entry) => total + entry.quantityAdded, 0);
  const totalOutward = this.outwardHistory.reduce((total, entry) => total + entry.quantity, 0);
  this.totalQuantity = totalInward - totalOutward;
  next();
});

// Create indexes
inventorySchema.index({ productId: 1 });
inventorySchema.index({ productName: 1 });
inventorySchema.index({ units: 1 });
inventorySchema.index({ hsnCode: 1 });

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;