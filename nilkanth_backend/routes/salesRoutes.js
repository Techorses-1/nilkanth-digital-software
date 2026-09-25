const express = require("express");
const router = express.Router();
const Sales = require("../models/sales");
const DeletedInvoice = require("../models/deletedInvoice");
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

// ===== HELPER: Build filter based on search + filterType =====
const buildFilter = (search, filterType) => {
  let filter = {};

  // ✅ Apply filterType
  if (filterType === 'Challan') {
    filter.isChallan = true;
  } else if (filterType === 'GST') {
    filter.isChallan = false;
    filter.isGstMode = true;
  } else if (filterType === 'Non-GST') {
    filter.isChallan = false;
    filter.isGstMode = false;
  }
  // 'All' or undefined → no additional filter

  // ✅ Apply search
  if (search) {
    filter.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { internalInvoiceNumber: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerEmail: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
      { paymentType: { $regex: search, $options: 'i' } },
      { paymentStatus: { $regex: search, $options: 'i' } },
      { 'items.uniqueNumbers.number': { $regex: search, $options: 'i' } }
    ];
  }

  return filter;
};

// ===== HELPER: Generate Invoice Number (No gaps, reuse latest deleted) =====
const generateInvoiceNumber = async (isChallan = false) => {
  const year = new Date().getFullYear();
  const prefix = isChallan ? 'CHALLAN' : 'INV';
  const fullPrefix = `${prefix}${year}`;

  const activeSales = await Sales.find({
    invoiceNumber: { $regex: `^${fullPrefix}` }
  }).select('invoiceNumber').lean();

  const deletedInvoices = await DeletedInvoice.find({
    invoiceNumber: { $regex: `^${fullPrefix}` }
  }).select('invoiceNumber').lean();

  const allNumbers = [
    ...activeSales.map(s => parseInt(s.invoiceNumber.replace(fullPrefix, '')) || 0),
    ...deletedInvoices.map(s => parseInt(s.invoiceNumber.replace(fullPrefix, '')) || 0)
  ].filter(n => n > 0);

  let nextNumber;

  if (allNumbers.length === 0) {
    nextNumber = 1;
  } else {
    const activeNumbers = activeSales
      .map(s => parseInt(s.invoiceNumber.replace(fullPrefix, '')) || 0)
      .filter(n => n > 0);

    const maxAllNumber = Math.max(...allNumbers);
    const maxActiveNumber = activeNumbers.length > 0 ? Math.max(...activeNumbers) : 0;

    if (maxAllNumber > maxActiveNumber) {
      nextNumber = maxAllNumber;
    } else {
      nextNumber = maxActiveNumber + 1;
    }
  }

  return `${fullPrefix}${String(nextNumber).padStart(4, '0')}`;
};

// ===== HELPER: Generate internal invoice number (Alphanumeric, 6 chars) =====
const generateInternalInvoiceNumber = async () => {
  const allInternalNumbers = await Sales.find({
    internalInvoiceNumber: { $regex: `^[A-Z]{2}` }
  }).select('internalInvoiceNumber').lean();

  const deletedInternalNumbers = await DeletedInvoice.find({
    internalInvoiceNumber: { $regex: `^[A-Z]{2}` }
  }).select('internalInvoiceNumber').lean();

  let counter = 1000;
  const allExisting = [
    ...allInternalNumbers.map(s => s.internalInvoiceNumber),
    ...deletedInternalNumbers.map(s => s.internalInvoiceNumber)
  ];

  while (true) {
    counter += 1;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter1 = letters[Math.floor((counter / 10000) % 26)];
    const letter2 = letters[counter % 26];
    const numberPart = String(counter % 10000).padStart(4, '0');
    const result = `${letter1}${letter2}${numberPart}`;

    if (!allExisting.includes(result)) {
      return result;
    }
  }
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
      paymentStatus,
      isGstMode,
      isChallan
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

    // ===== PROCESS ITEMS =====
    const processedItems = [];

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

      const uniqueNumbers = [];
      if (item.uniqueNumbers && Array.isArray(item.uniqueNumbers)) {
        for (const un of item.uniqueNumbers) {
          uniqueNumbers.push({
            number: un.number ? un.number.trim() : '',
            isUsed: un.isUsed || false
          });
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

      const hsnCode = item.hsnCode || product.hsnCode || '';
      const unitName = item.unitName || 'NOS';
      const capacity = item.capacity || '';
      const invoiceDescription = item.invoiceDescription || '';

      processedItems.push({
        productId: product.productId,
        productName: product.productName,
        productDescription: product.productDescription || '',
        invoiceDescription: invoiceDescription,
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

    const gstin = customerGstin || customer.gstNumber || '';
    const taxType = determineTaxType(gstin);
    const invoiceNumber = await generateInvoiceNumber(isChallan || false);
    const internalInvoiceNumber = await generateInternalInvoiceNumber();

    const finalPaymentType = paymentStatus === 'Pending' ? null : (paymentType || 'Cash');

    const newSale = new Sales({
      invoiceNumber,
      internalInvoiceNumber,
      isChallan: isChallan || false,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerEmail: customer.email || '',
      customerPhone: customer.contactNumber || '',
      customerGstin: gstin,
      customerState: customerState || '',
      customerAddress: customer.address || '',
      storeType: storeType || 'Vadodara',
      paymentStatus: paymentStatus || 'Paid',
      paymentType: finalPaymentType,
      isGstMode: isChallan ? false : (isGstMode !== undefined ? isGstMode : true),
      saleDate: saleDate || new Date(),
      items: processedItems,
      taxSlab: (isChallan || !isGstMode) ? 0 : (Number(taxSlab) || 18),
      taxType: taxType,
      notes: notes || '',
      createdBy: user.name,
      createdById: user.userId,
      status: 'Completed'
    });

    newSale.recalculateTotals();
    const savedSale = await newSale.save();

    console.log("✅ SALE SAVED:", savedSale.invoiceNumber);

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
    const { saleId, _id, createdAt, updatedAt, invoiceNumber, internalInvoiceNumber, ...updateData } = req.body;

    const decoded = getUserFromToken(req);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const existingSale = await Sales.findOne({ saleId: req.params.id });
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    if (updateData.items && Array.isArray(updateData.items)) {
      const processedItems = [];

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

        const uniqueNumbers = [];
        if (item.uniqueNumbers && Array.isArray(item.uniqueNumbers)) {
          for (const un of item.uniqueNumbers) {
            uniqueNumbers.push({
              number: un.number ? un.number.trim() : '',
              isUsed: un.isUsed || false
            });
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

        const hsnCode = item.hsnCode || product.hsnCode || '';
        const unitName = item.unitName || 'NOS';
        const capacity = item.capacity || '';
        const invoiceDescription = item.invoiceDescription || '';

        processedItems.push({
          productId: product.productId,
          productName: product.productName,
          productDescription: product.productDescription || '',
          invoiceDescription: invoiceDescription,
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
    }

    if (!updateData.customerGstin || updateData.customerGstin.trim() === '') {
      updateData.customerGstin = existingSale.customerGstin || '';
    }
    updateData.taxType = determineTaxType(updateData.customerGstin || '');

    if (updateData.paymentStatus === 'Pending') {
      updateData.paymentType = null;
    }

    if (updateData.isChallan) {
      updateData.isGstMode = false;
      updateData.taxSlab = 0;
    } else if (updateData.isGstMode === false) {
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
// GET /api/sales/get-sales - Get all sales (with pagination + filter + search)
// =============================================
router.get("/get-sales", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;  // ✅ Default 20
    const search = req.query.search || '';
    const filterType = req.query.filterType || 'All';
    const skip = (page - 1) * limit;

    const filter = buildFilter(search, filterType);

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
// GET /api/sales/export-sales - Export all sales (with filter + search)
// =============================================
router.get("/export-sales", async (req, res) => {
  try {
    const search = req.query.search || '';
    const filterType = req.query.filterType || 'All';

    const filter = buildFilter(search, filterType);

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
// GET /api/sales/get-all-filtered - Get ALL filtered sales (for PDF export)
// =============================================
router.get("/get-all-filtered", async (req, res) => {
  try {
    const search = req.query.search || '';
    const filterType = req.query.filterType || 'All';

    const filter = buildFilter(search, filterType);

    const sales = await Sales.find(filter)
      .sort({ saleDate: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: sales,
      total: sales.length
    });
  } catch (error) {
    console.error("Error fetching all filtered sales:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch filtered sales",
      error: error.message
    });
  }
});

// =============================================
// GET /api/sales/get-sale/:id - Get sale by ID
// =============================================
router.get("/get-sale/:id", async (req, res) => {
  try {
    const sale = await Sales.findOne({ saleId: req.params.id }).lean();

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
// GET /api/sales/get-sale-by-invoice/:invoiceNumber
// =============================================
router.get("/get-sale-by-invoice/:invoiceNumber", async (req, res) => {
  try {
    const sale = await Sales.findOne({
      invoiceNumber: req.params.invoiceNumber
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
// DELETE /api/sales/delete-sale/:id - HARD DELETE + Move to DeletedInvoices
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

    const sale = await Sales.findOne({ saleId: req.params.id });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    const deletedInvoice = new DeletedInvoice({
      originalSaleId: sale.saleId,
      invoiceNumber: sale.invoiceNumber,
      internalInvoiceNumber: sale.internalInvoiceNumber,
      isChallan: sale.isChallan || false,
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      customerPhone: sale.customerPhone,
      customerGstin: sale.customerGstin,
      customerState: sale.customerState,
      customerAddress: sale.customerAddress,
      storeType: sale.storeType,
      paymentStatus: sale.paymentStatus,
      paymentType: sale.paymentType,
      isGstMode: sale.isGstMode,
      saleDate: sale.saleDate,
      items: sale.items,
      taxSlab: sale.taxSlab,
      taxType: sale.taxType,
      subtotal: sale.subtotal,
      totalDiscount: sale.totalDiscount,
      totalTax: sale.totalTax,
      grandTotal: sale.grandTotal,
      taxBreakdown: sale.taxBreakdown,
      notes: sale.notes,
      createdBy: sale.createdBy,
      createdById: sale.createdById,
      status: sale.status,
      deletedBy: user.name,
      deletedById: user.userId,
      deletedAt: new Date(),
      deletedReason: req.body?.deletedReason || ''
    });

    await deletedInvoice.save();

    await Sales.findOneAndDelete({ saleId: req.params.id });

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
// GET /api/sales/get-customer-sales/:customerId
// =============================================
router.get("/get-customer-sales/:customerId", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      customerId: req.params.customerId
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