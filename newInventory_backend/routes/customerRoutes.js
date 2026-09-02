const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");

// POST create-customer - Create new customer
router.post("/create-customer", async (req, res) => {
  try {
    const { email, contactNumber } = req.body;

    // Only check for existing customer if email is provided
    if (email) {
      const existingCustomer = await Customer.findOne({ email });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: "Customer with this email already exists",
          field: "email"
        });
      }
    }

    // Check for existing customer by mobile number
    if (contactNumber) {
      const existingByMobile = await Customer.findOne({ contactNumber });
      if (existingByMobile) {
        return res.status(400).json({
          success: false,
          message: "Customer with this mobile number already exists",
          field: "contactNumber"
        });
      }
    }

    const customer = new Customer(req.body);
    const savedCustomer = await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: savedCustomer.toObject()
    });

  } catch (error) {
    console.error("Error creating customer:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message
    });
  }
});

// GET get-customers - Get all customers (with pagination)
router.get("/get-customers", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search filter
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
          { gstNumber: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get total count for pagination
    const total = await Customer.countDocuments(filter);

    // Get paginated data
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message
    });
  }
});

// GET export-customers - Export all customers (NO pagination)
router.get("/export-customers", async (req, res) => {
  try {
    const search = req.query.search || '';

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
          { gstNumber: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: customers,
      total: customers.length
    });
  } catch (error) {
    console.error("Error exporting customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export customers",
      error: error.message
    });
  }
});

// PUT update-customer/:id - Update customer
router.put("/update-customer/:id", async (req, res) => {
  try {
    const { customerId, _id, createdAt, updatedAt, ...updateData } = req.body;

    // Check if email already exists (excluding current)
    if (updateData.email) {
      const existingCustomer = await Customer.findOne({
        email: updateData.email,
        customerId: { $ne: req.params.id }
      });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: "Customer with this email already exists",
          field: "email"
        });
      }
    }

    // Check if mobile number already exists (excluding current)
    if (updateData.contactNumber) {
      const existingByMobile = await Customer.findOne({
        contactNumber: updateData.contactNumber,
        customerId: { $ne: req.params.id }
      });
      if (existingByMobile) {
        return res.status(400).json({
          success: false,
          message: "Customer with this mobile number already exists",
          field: "contactNumber"
        });
      }
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      { customerId: req.params.id },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer.toObject()
    });
  } catch (error) {
    console.error("Error updating customer:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message
    });
  }
});

// DELETE delete-customer/:id - Delete customer
router.delete("/delete-customer/:id", async (req, res) => {
  try {
    const deletedCustomer = await Customer.findOneAndDelete({
      customerId: req.params.id
    });

    if (!deletedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message
    });
  }
});

// GET get-customer/:id - Get customer by ID
router.get("/get-customer/:id", async (req, res) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.id });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      data: customer.toObject()
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message
    });
  }
});

// POST bulk-create-customers - Create multiple customers from Excel
router.post("/bulk-create-customers", async (req, res) => {
  try {
    const { customers } = req.body;

    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customer data provided"
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const customerData of customers) {
      try {
        const { email, contactNumber, customerName, gstNumber, address } = customerData;

        // Validate required fields
        if (!customerName || !contactNumber) {
          results.failed.push({
            customer: customerData,
            error: "Customer name and mobile number are required"
          });
          continue;
        }

        // Validate mobile number format
        if (!/^[0-9]{10}$/.test(contactNumber)) {
          results.failed.push({
            customer: customerData,
            error: "Mobile number must be exactly 10 digits"
          });
          continue;
        }

        // Validate email format if provided
        if (email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
          results.failed.push({
            customer: customerData,
            error: "Invalid email format"
          });
          continue;
        }

        // Validate GST number format if provided (15 characters, uppercase letters and digits)
        if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) {
          results.failed.push({
            customer: customerData,
            error: "GST number must be 15 characters (digits and uppercase letters only)"
          });
          continue;
        }

        // Check for existing customer by email (if email provided)
        if (email) {
          const existingCustomer = await Customer.findOne({ email });
          if (existingCustomer) {
            results.failed.push({
              customer: customerData,
              error: "Customer with this email already exists"
            });
            continue;
          }
        }

        // Check for existing customer by mobile number
        const existingByMobile = await Customer.findOne({ contactNumber });
        if (existingByMobile) {
          results.failed.push({
            customer: customerData,
            error: "Customer with this mobile number already exists"
          });
          continue;
        }

        // Create new customer
        const customer = new Customer(customerData);
        const savedCustomer = await customer.save();
        results.successful.push(savedCustomer.toObject());

      } catch (error) {
        results.failed.push({
          customer: customerData,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results
    });

  } catch (error) {
    console.error("Error in bulk customer creation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk customer import",
      error: error.message
    });
  }
});

module.exports = router;