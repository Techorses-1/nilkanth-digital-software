const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    unique: true,
    trim: true
  },
  productDescription: {
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

// Indexes
productSchema.index({ productName: 1 });
productSchema.index({ hsnCode: 1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
module.exports = Product;