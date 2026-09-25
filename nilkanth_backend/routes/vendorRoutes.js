const express = require("express");
const router = express.Router();
const Vendor = require("../models/vendor");

// POST create-vendor - Create new vendor
router.post("/create-vendors", async (req, res) => {
  try {
    const { email } = req.body;

    // Only check for existing vendor if email is provided
    if (email) {
      const existingVendor = await Vendor.findOne({ email });

      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor with this email already exists",
          field: "email"
        });
      }
    }

    const vendor = new Vendor(req.body);
    const savedVendor = await vendor.save();

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: savedVendor.toObject()
    });

  } catch (error) {
    console.error("Error creating vendor:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create vendor",
      error: error.message
    });
  }
});

// GET get-vendors - Get all vendors (with pagination)
router.get("/get-vendors", async (req, res) => {
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
          { vendorName: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
          { gstNumber: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get total count for pagination
    const total = await Vendor.countDocuments(filter);

    // Get paginated data
    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: vendors,
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
    console.error("Error fetching vendors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
      error: error.message
    });
  }
});

// GET export-vendors - Export all vendors (NO pagination)
router.get("/export-vendors", async (req, res) => {
  try {
    const search = req.query.search || '';

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { vendorName: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
          { gstNumber: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: vendors,
      total: vendors.length
    });
  } catch (error) {
    console.error("Error exporting vendors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export vendors",
      error: error.message
    });
  }
});

// PUT update-vendor/:id - Update vendor
router.put("/update-vendor/:id", async (req, res) => {
  try {
    const { vendorId, _id, createdAt, updatedAt, ...updateData } = req.body;

    // Check if email already exists (excluding current)
    if (updateData.email) {
      const existingVendor = await Vendor.findOne({
        email: updateData.email,
        vendorId: { $ne: req.params.id }
      });
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor with this email already exists",
          field: "email"
        });
      }
    }

    const updatedVendor = await Vendor.findOneAndUpdate(
      { vendorId: req.params.id },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedVendor.toObject()
    });
  } catch (error) {
    console.error("Error updating vendor:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update vendor",
      error: error.message
    });
  }
});

// DELETE delete-vendor/:id - Delete vendor
router.delete("/delete-vendor/:id", async (req, res) => {
  try {
    const deletedVendor = await Vendor.findOneAndDelete({
      vendorId: req.params.id
    });

    if (!deletedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete vendor",
      error: error.message
    });
  }
});

// GET get-vendor/:id - Get vendor by ID
router.get("/get-vendor/:id", async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ vendorId: req.params.id });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    res.status(200).json({
      success: true,
      data: vendor.toObject()
    });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor",
      error: error.message
    });
  }
});

// POST bulk-create-vendors - Create multiple vendors from Excel
router.post("/bulk-create-vendors", async (req, res) => {
  try {
    const { vendors } = req.body;

    if (!vendors || !Array.isArray(vendors) || vendors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No vendor data provided"
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const vendorData of vendors) {
      try {
        const { email, vendorName, companyName } = vendorData;

        if (!vendorName || !companyName) {
          results.failed.push({
            vendor: vendorData,
            error: "Contact Person name and Company name are required"
          });
          continue;
        }

        if (email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
          results.failed.push({
            vendor: vendorData,
            error: "Invalid email format"
          });
          continue;
        }

        if (vendorData.contactNumber && !/^[0-9]{10}$/.test(vendorData.contactNumber)) {
          results.failed.push({
            vendor: vendorData,
            error: "Contact number must be exactly 10 digits"
          });
          continue;
        }

        if (vendorData.gstNumber && !/^[0-9A-Z]{15}$/.test(vendorData.gstNumber)) {
          results.failed.push({
            vendor: vendorData,
            error: "GST number must be 15 characters (digits and uppercase letters only)"
          });
          continue;
        }

        if (email) {
          const existingVendor = await Vendor.findOne({ email });
          if (existingVendor) {
            results.failed.push({
              vendor: vendorData,
              error: "Vendor with this email already exists"
            });
            continue;
          }
        }

        const vendor = new Vendor(vendorData);
        const savedVendor = await vendor.save();
        results.successful.push(savedVendor.toObject());

      } catch (error) {
        results.failed.push({
          vendor: vendorData,
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
    console.error("Error in bulk vendor creation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk vendor import",
      error: error.message
    });
  }
});

module.exports = router;