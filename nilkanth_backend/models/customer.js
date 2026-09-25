const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    // Optional - no required validation
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    // Optional - no required validation
    // GST Number format: 15 characters (digits and uppercase letters)
  },
  address: {
    type: String,
    trim: true,
    // Optional - no required validation
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
customerSchema.index({ email: 1 });
customerSchema.index({ contactNumber: 1 });
customerSchema.index({ gstNumber: 1 });

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
module.exports = Customer;