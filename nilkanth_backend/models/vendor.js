const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  vendorId: {
    type: String,
    unique: true,
    default: () => require("uuid").v4(),
  },
  vendorName: {
    type: String,
    required: [true, 'Contact Person name is required']
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required']
  },
  email: {
    type: String,
    // Optional - no required validation
  },
  contactNumber: {
    type: String,
    // Optional - no required validation
  },
  gstNumber: {
    type: String,
    // Optional - no required validation
  },
  address: {
    type: String,
    // Optional - no required validation
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Create indexes for better query performance
vendorSchema.index({ email: 1 });
vendorSchema.index({ contactNumber: 1 });
vendorSchema.index({ gstNumber: 1 });

const Vendor = mongoose.model('Vendor', vendorSchema);

module.exports = Vendor;