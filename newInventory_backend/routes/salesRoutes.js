const express = require("express");
const router = express.Router();
const Sales = require("../models/sales");
const GlobalCounter = require("../models/globalCounter");
const Product = require("../models/product");
const Customer = require("../models/customer");
const jwt = require("jsonwebtoken");

// ===== HELPER: Get user from token =====
const getUserFromToken = (req) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// ===== HELPER: Get user details =====
const getUserDetails = async (userId) => {
  const User = require("../models/user");
  const user = await User.findOne({ userId });
  return user;
};

// ===== HELPER: Generate invoice number =====
const generateInvoiceNumber = async () => {
  const counterId = "sales";
  let counter = await GlobalCounter.findOne({ id: counterId });

  if (!counter) {
    counter = new GlobalCounter({ id: counterId, count: 1 });
    await counter.save();
  } else {
    counter.count += 1;
    await counter.save();
  }

  const year = new Date().getFullYear();
  return `INV${year}${String(counter.count).padStart(4, '0')}`;
};

// ===== HELPER: Generate internal invoice number (Alphanumeric, 6 chars) =====
const generateInternalInvoiceNumber = async () => {
  const counterId = "internalNumber";
  let counter = await GlobalCounter.findOne({ id: counterId });

  if (!counter) {
    counter = new GlobalCounter({ id: counterId, count: 1000 });
    await counter.save();
  } else {
    counter.count += 1;
    await counter.save();
  }

  const num = counter.count;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter1 = letters[Math.floor((num / 10000) % 26)];
  const letter2 = letters[num % 26];
  const numberPart = String(num % 10000).padStart(4, '0');
  const result = `${letter1}${letter2}${numberPart}`;

  const existing = await Sales.findOne({ internalInvoiceNumber: result });
  if (existing) {
    return generateInternalInvoiceNumber();
  }

  return result;
};

// ===== HELPER: Determine tax type based on GSTIN =====
const determineTaxType = (gstin) => {
  if (!gstin || gstin.trim().length === 0) {
    return 'IGST';
  }

  if (gstin.trim().startsWith('24')) {
    return 'CGST_SGST';
  } else {
    return 'IGST';
  }
};

// =============================================
// POST /api/sales/create-sale - Create new sale
// =============================================
router.post("/create-sale", async (req, res) => {
  try {
    const {
      customerId,
      storeType,
      saleDate,
      items,
      taxSlab,
      notes,
      customerGstin,
      customerState,
      paymentType,
      isGstMode
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer is required"
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required"
      });
    }

    const decoded = getUserFromToken(req);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const user = await getUserDetails(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // ===== PROCESS ITEMS WITH UNIQUE NUMBERS =====
    const processedItems = [];
    const allUniqueNumbers = [];

    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      const discountPercent = Number(item.discountPercent) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const discountFactor = (100 - discountPercent) / 100;
      const discountedUnitPrice = unitPrice * discountFactor;
      const discountAmount = unitPrice - discountedUnitPrice;
      const finalPrice = discountedUnitPrice * quantity;

      // ✅ Process unique numbers for this product
      const uniqueNumbers = [];
      if (item.uniqueNumbers && Array.isArray(item.uniqueNumbers)) {
        for (const un of item.uniqueNumbers) {
          if (un.number && un.number.trim()) {
            // Check for duplicate across all products
            if (allUniqueNumbers.includes(un.number.trim())) {
              return res.status(400).json({
                success: false,
                message: `Duplicate unique number found: ${un.number}`
              });
            }
            allUniqueNumbers.push(un.number.trim());
            uniqueNumbers.push({
              number: un.number.trim(),
              isUsed: un.isUsed || false
            });
          }
        }
      }

      // ✅ If unique numbers count doesn't match quantity, auto-generate empty slots
      const currentUniqueCount = uniqueNumbers.length;
      if (currentUniqueCount < quantity) {
        const difference = quantity - currentUniqueCount;
        for (let i = 0; i < difference; i++) {
          uniqueNumbers.push({ number: '', isUsed: false });
        }
      } else if (currentUniqueCount > quantity) {
        // Keep only first 'quantity' numbers
        uniqueNumbers.splice(quantity);
      }

      processedItems.push({
        productId: product.productId,
        productName: product.productName,
        productDescription: product.productDescription || '',
        hsnCode: product.hsnCode,
        unitName: product.unitName || 'NOS',
        quantity: quantity,
        unitPrice: unitPrice,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        discountedUnitPrice: discountedUnitPrice,
        finalPrice: finalPrice,
        uniqueNumbers: uniqueNumbers
      });
    }

    const gstin = customerGstin || customer.gstNumber || '';
    const taxType = determineTaxType(gstin);
    const invoiceNumber = await generateInvoiceNumber();
    const internalInvoiceNumber = await generateInternalInvoiceNumber();

    const newSale = new Sales({
      invoiceNumber,
      internalInvoiceNumber,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerEmail: customer.email || '',
      customerPhone: customer.contactNumber || '',
      customerGstin: gstin,
      customerState: customerState || '',
      customerAddress: customer.address || '',
      storeType: storeType || 'Vadodara',
      paymentType: paymentType || 'Cash',
      isGstMode: isGstMode !== undefined ? isGstMode : true,
      saleDate: saleDate || new Date(),
      items: processedItems,
      taxSlab: isGstMode ? (Number(taxSlab) || 18) : 0,
      taxType: taxType,
      notes: notes || '',
      createdBy: user.name,
      createdById: user.userId,
      status: 'Completed'
    });

    newSale.recalculateTotals();
    const savedSale = await newSale.save();

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: savedSale,
      invoiceNumber: invoiceNumber,
      internalInvoiceNumber: internalInvoiceNumber
    });

  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/get-sales - Get all sales (with pagination)
// =============================================
router.get("/get-sales", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { internalInvoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { paymentType: { $regex: search, $options: 'i' } },
        { 'items.uniqueNumbers.number': { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Sales.countDocuments(filter);
    const sales = await Sales.find(filter)
      .sort({ saleDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: sales,
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
    console.error("Error fetching sales:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/export-sales - Export all sales (NO pagination)
// =============================================
router.get("/export-sales", async (req, res) => {
  try {
    const search = req.query.search || '';

    let filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { internalInvoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { paymentType: { $regex: search, $options: 'i' } }
      ];
    }

    const sales = await Sales.find(filter)
      .sort({ saleDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: sales,
      total: sales.length
    });
  } catch (error) {
    console.error("Error exporting sales:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export sales",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/get-sale/:id - Get sale by ID
// =============================================
router.get("/get-sale/:id", async (req, res) => {
  try {
    const sale = await Sales.findOne({
      saleId: req.params.id,
      isDeleted: false
    }).lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error("Error fetching sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/get-sale-by-invoice/:invoiceNumber - Get sale by invoice number
// =============================================
router.get("/get-sale-by-invoice/:invoiceNumber", async (req, res) => {
  try {
    const sale = await Sales.findOne({
      invoiceNumber: req.params.invoiceNumber,
      isDeleted: false
    }).lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error("Error fetching sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale",
      error: error.message
    });
  }
});

// =============================================
// PUT /api/sales/update-sale/:id - Update sale
// =============================================
router.put("/update-sale/:id", async (req, res) => {
  try {
    const { saleId, _id, createdAt, updatedAt, invoiceNumber, internalInvoiceNumber, ...updateData } = req.body;

    const decoded = getUserFromToken(req);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const existingSale = await Sales.findOne({ saleId: req.params.id, isDeleted: false });
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    // ===== PROCESS ITEMS WITH UNIQUE NUMBERS =====
    if (updateData.items && Array.isArray(updateData.items)) {
      const processedItems = [];
      const allUniqueNumbers = [];

      for (const item of updateData.items) {
        const product = await Product.findOne({ productId: item.productId });
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.productId}`
          });
        }

        const discountPercent = Number(item.discountPercent) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const quantity = Number(item.quantity) || 0;
        const discountFactor = (100 - discountPercent) / 100;
        const discountedUnitPrice = unitPrice * discountFactor;
        const discountAmount = unitPrice - discountedUnitPrice;
        const finalPrice = discountedUnitPrice * quantity;

        // ✅ Process unique numbers
        const uniqueNumbers = [];
        if (item.uniqueNumbers && Array.isArray(item.uniqueNumbers)) {
          for (const un of item.uniqueNumbers) {
            if (un.number && un.number.trim()) {
              if (allUniqueNumbers.includes(un.number.trim())) {
                return res.status(400).json({
                  success: false,
                  message: `Duplicate unique number found: ${un.number}`
                });
              }
              allUniqueNumbers.push(un.number.trim());
              uniqueNumbers.push({
                number: un.number.trim(),
                isUsed: un.isUsed || false
              });
            }
          }
        }

        // ✅ Sync unique numbers with quantity
        const currentUniqueCount = uniqueNumbers.length;
        if (currentUniqueCount < quantity) {
          const difference = quantity - currentUniqueCount;
          for (let i = 0; i < difference; i++) {
            uniqueNumbers.push({ number: '', isUsed: false });
          }
        } else if (currentUniqueCount > quantity) {
          uniqueNumbers.splice(quantity);
        }

        processedItems.push({
          productId: product.productId,
          productName: product.productName,
          productDescription: product.productDescription || '',
          hsnCode: product.hsnCode,
          unitName: product.unitName || 'NOS',
          quantity: quantity,
          unitPrice: unitPrice,
          discountPercent: discountPercent,
          discountAmount: discountAmount,
          discountedUnitPrice: discountedUnitPrice,
          finalPrice: finalPrice,
          uniqueNumbers: uniqueNumbers
        });
      }

      updateData.items = processedItems;
    }

    // Update GSTIN and tax type if changed
    if (updateData.customerGstin !== undefined) {
      const gstin = updateData.customerGstin || existingSale.customerGstin || '';
      updateData.taxType = determineTaxType(gstin);
    }

    if (updateData.isGstMode === false) {
      updateData.taxSlab = 0;
    }

    const tempSale = new Sales({
      ...existingSale.toObject(),
      ...updateData,
      saleId: existingSale.saleId,
      invoiceNumber: existingSale.invoiceNumber,
      internalInvoiceNumber: existingSale.internalInvoiceNumber
    });

    tempSale.recalculateTotals();

    const finalUpdateData = {
      ...updateData,
      items: tempSale.items,
      subtotal: tempSale.subtotal,
      totalDiscount: tempSale.totalDiscount,
      totalTax: tempSale.totalTax,
      grandTotal: tempSale.grandTotal,
      taxBreakdown: tempSale.taxBreakdown
    };

    const updatedSale = await Sales.findOneAndUpdate(
      { saleId: req.params.id },
      finalUpdateData,
      { new: true, runValidators: true }
    );

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale
    });

  } catch (error) {
    console.error("Error updating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sale",
      error: error.message
    });
  }
});

// =============================================
// DELETE /api/sales/delete-sale/:id - Soft delete sale
// =============================================
router.delete("/delete-sale/:id", async (req, res) => {
  try {
    const decoded = getUserFromToken(req);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const user = await getUserDetails(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const sale = await Sales.findOne({ saleId: req.params.id, isDeleted: false });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    sale.isDeleted = true;
    sale.deletedBy = user.name;
    sale.deletedAt = new Date();
    await sale.save();

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sale",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/get-customer-sales/:customerId - Get sales by customer
// =============================================
router.get("/get-customer-sales/:customerId", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      customerId: req.params.customerId,
      isDeleted: false
    };

    const total = await Sales.countDocuments(filter);
    const sales = await Sales.find(filter)
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: sales,
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
    console.error("Error fetching customer sales:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer sales",
      error: error.message
    });
  }
});

module.exports = router;