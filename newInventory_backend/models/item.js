const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const itemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    unique: true,
    trim: true
  },
  itemDescription: {
    type: String,
    trim: true,
    default: '' // Optional - not required
  },
  hsnCode: {
    type: String,
    required: [true, 'HSN Code is required'],
    trim: true
  },
  unitId: {
    type: String,
    required: [true, 'Unit is required'],
    ref: 'Unit'
  },
  unitName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
});

// Indexes
itemSchema.index({ itemName: 1 });
itemSchema.index({ hsnCode: 1 });
itemSchema.index({ unitId: 1 });

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
module.exports = Item;