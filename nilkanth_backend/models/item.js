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
    default: ''
  },
  hsnCode: {
    type: String,
    required: [true, 'HSN Code is required'],
    trim: true,
    default: '8423'
  }
}, {
  timestamps: true,
});

// ✅ Removed duplicate itemName index — unique:true already creates it
// HSN index kept (not unique, so no duplicate warning)
itemSchema.index({ hsnCode: 1 });

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
module.exports = Item;