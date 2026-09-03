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
    console.log("🚀 ===== CREATE SALE START =====");
    console.log("📦 REQUEST BODY:", JSON.stringify(req.body, null, 2));

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
      isGstMode,
      invoiceType,
      repairingDescription
    } = req.body;

    console.log("🔍 EXTRACTED VALUES:");
    console.log("  - customerId:", customerId);
    console.log("  - customerGstin FROM REQUEST:", customerGstin);
    console.log("  - customerState:", customerState);
    console.log("  - storeType:", storeType);
    console.log("  - paymentType:", paymentType);
    console.log("  - isGstMode:", isGstMode);
    console.log("  - taxSlab:", taxSlab);
    console.log("  - invoiceType:", invoiceType);
    console.log("  - repairingDescription:", repairingDescription);
    console.log("  - notes:", notes);
    console.log("  - items count:", items?.length || 0);

    if (!customerId) {
      console.log("❌ ERROR: No customerId provided");
      return res.status(400).json({
        success: false,
        message: "Customer is required"
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ ERROR: No items provided");
      return res.status(400).json({
        success: false,
        message: "At least one product is required"
      });
    }

    const decoded = getUserFromToken(req);
    if (!decoded) {
      console.log("❌ ERROR: Unauthorized - no valid token");
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }
    console.log("✅ User decoded:", decoded);

    const user = await getUserDetails(decoded.userId);
    if (!user) {
      console.log("❌ ERROR: User not found in DB");
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }
    console.log("✅ User found:", user.name, user.userId);

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      console.log("❌ ERROR: Customer not found:", customerId);
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    console.log("✅ Customer found:", customer.customerName);

    // ===== PROCESS ITEMS =====
    const processedItems = [];
    const allUniqueNumbers = [];

    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        console.log("❌ ERROR: Product not found:", item.productId);
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
              console.log("❌ ERROR: Duplicate unique number:", un.number);
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

      const currentUniqueCount = uniqueNumbers.length;
      if (currentUniqueCount < quantity) {
        const difference = quantity - currentUniqueCount;
        for (let i = 0; i < difference; i++) {
          uniqueNumbers.push({ number: '', isUsed: false });
        }
      } else if (currentUniqueCount > quantity) {
        uniqueNumbers.splice(quantity);
      }

      // ✅ Use HSN from frontend, fallback to product
      const hsnCode = item.hsnCode || product.hsnCode || '';
      const unitName = item.unitName || product.unitName || 'NOS';
      const capacity = item.capacity || '';

      console.log(`  - Product: ${product.productName}, HSN: ${hsnCode}, Unit: ${unitName}, Capacity: ${capacity}`);

      processedItems.push({
        productId: product.productId,
        productName: product.productName,
        productDescription: product.productDescription || '',
        hsnCode: hsnCode,
        unitName: unitName,
        capacity: capacity,
        quantity: quantity,
        unitPrice: unitPrice,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        discountedUnitPrice: discountedUnitPrice,
        finalPrice: finalPrice,
        uniqueNumbers: uniqueNumbers
      });
    }

    // ✅ GSTIN LOGIC
    const gstin = customerGstin || customer.gstNumber || '';
    const taxType = determineTaxType(gstin);
    const invoiceNumber = await generateInvoiceNumber();
    const internalInvoiceNumber = await generateInternalInvoiceNumber();

    const newSale = new Sales({
      invoiceNumber,
      internalInvoiceNumber,
      invoiceType: invoiceType || 'Sales',
      repairingDescription: repairingDescription || '',
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

    console.log("📝 SALE OBJECT BEFORE SAVE:");
    console.log("  - customerGstin:", newSale.customerGstin);
    console.log("  - taxType:", newSale.taxType);
    console.log("  - isGstMode:", newSale.isGstMode);
    console.log("  - invoiceType:", newSale.invoiceType);
    console.log("  - repairingDescription:", newSale.repairingDescription);

    newSale.recalculateTotals();
    const savedSale = await newSale.save();

    console.log("✅ SALE SAVED SUCCESSFULLY!");
    console.log("  - Sale ID:", savedSale.saleId);
    console.log("  - Invoice:", savedSale.invoiceNumber);

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: savedSale,
      invoiceNumber: invoiceNumber,
      internalInvoiceNumber: internalInvoiceNumber
    });

  } catch (error) {
    console.error("❌ ERROR creating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message
    });
  }
});


// =============================================
// PUT /api/sales/update-sale/:id - Update sale
// =============================================
router.put("/update-sale/:id", async (req, res) => {
  try {
    console.log("🚀 ===== UPDATE SALE START =====");
    console.log("📦 UPDATE REQUEST BODY:", JSON.stringify(req.body, null, 2));
    console.log("📦 UPDATE PARAMS ID:", req.params.id);

    const { saleId, _id, createdAt, updatedAt, invoiceNumber, internalInvoiceNumber, ...updateData } = req.body;

    console.log("🔍 EXTRACTED updateData:", JSON.stringify(updateData, null, 2));
    console.log("🔍 customerGstin IN updateData:", updateData.customerGstin);
    console.log("🔍 invoiceType IN updateData:", updateData.invoiceType);
    console.log("🔍 repairingDescription IN updateData:", updateData.repairingDescription);

    const decoded = getUserFromToken(req);
    if (!decoded) {
      console.log("❌ ERROR: Unauthorized - no valid token");
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }
    console.log("✅ User decoded:", decoded);

    const existingSale = await Sales.findOne({ saleId: req.params.id, isDeleted: false });
    if (!existingSale) {
      console.log("❌ ERROR: Sale not found:", req.params.id);
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }
    console.log("✅ Existing sale found:");
    console.log("  - Sale ID:", existingSale.saleId);
    console.log("  - Invoice:", existingSale.invoiceNumber);
    console.log("  - invoiceType (EXISTING):", existingSale.invoiceType);
    console.log("  - repairingDescription (EXISTING):", existingSale.repairingDescription);

    // ===== PROCESS ITEMS =====
    if (updateData.items && Array.isArray(updateData.items)) {
      console.log("🔄 Processing items...");
      const processedItems = [];
      const allUniqueNumbers = [];

      for (const item of updateData.items) {
        const product = await Product.findOne({ productId: item.productId });
        if (!product) {
          console.log("❌ ERROR: Product not found:", item.productId);
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
                console.log("❌ ERROR: Duplicate unique number:", un.number);
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

        const currentUniqueCount = uniqueNumbers.length;
        if (currentUniqueCount < quantity) {
          const difference = quantity - currentUniqueCount;
          for (let i = 0; i < difference; i++) {
            uniqueNumbers.push({ number: '', isUsed: false });
          }
        } else if (currentUniqueCount > quantity) {
          uniqueNumbers.splice(quantity);
        }

        // ✅ Use HSN from frontend, fallback to product
        const hsnCode = item.hsnCode || product.hsnCode || '';
        const unitName = item.unitName || product.unitName || 'NOS';
        const capacity = item.capacity || '';

        console.log(`  - Product: ${product.productName}, HSN: ${hsnCode}, Unit: ${unitName}, Capacity: ${capacity}`);

        processedItems.push({
          productId: product.productId,
          productName: product.productName,
          productDescription: product.productDescription || '',
          hsnCode: hsnCode,
          unitName: unitName,
          capacity: capacity,
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
      console.log("✅ Items processed successfully");
    }

    // ✅ GSTIN PROCESSING
    if (!updateData.customerGstin || updateData.customerGstin.trim() === '') {
      updateData.customerGstin = existingSale.customerGstin || '';
      console.log("  - ✅ Keeping EXISTING GSTIN:", updateData.customerGstin);
    } else {
      console.log("  - ✅ Using NEW GSTIN from request:", updateData.customerGstin);
    }

    updateData.taxType = determineTaxType(updateData.customerGstin || '');

    // ✅ Invoice Type - keep existing if not provided
    if (!updateData.invoiceType) {
      updateData.invoiceType = existingSale.invoiceType || 'Sales';
    }

    // ✅ Repairing Description - keep existing if not provided
    if (updateData.repairingDescription === undefined) {
      updateData.repairingDescription = existingSale.repairingDescription || '';
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

    console.log("📝 FINAL UPDATE DATA BEFORE SAVE:");
    console.log("  - invoiceType:", finalUpdateData.invoiceType);
    console.log("  - repairingDescription:", finalUpdateData.repairingDescription);

    const updatedSale = await Sales.findOneAndUpdate(
      { saleId: req.params.id },
      finalUpdateData,
      { new: true, runValidators: true }
    );

    if (!updatedSale) {
      console.log("❌ ERROR: Sale not found after update");
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    console.log("✅ SALE UPDATED SUCCESSFULLY!");
    console.log("  - Sale ID:", updatedSale.saleId);
    console.log("  - Invoice:", updatedSale.invoiceNumber);
    console.log("  - invoiceType SAVED:", updatedSale.invoiceType);
    console.log("  - repairingDescription SAVED:", updatedSale.repairingDescription);

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale
    });

  } catch (error) {
    console.error("❌ ERROR updating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sale",
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
        { invoiceType: { $regex: search, $options: 'i' } },
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
        { paymentType: { $regex: search, $options: 'i' } },
        { invoiceType: { $regex: search, $options: 'i' } }
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