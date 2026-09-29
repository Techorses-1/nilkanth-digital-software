const express = require("express");
const router = express.Router();
const AMC = require("../models/amc");
const DeletedAmc = require("../models/deletedAmc");
const Product = require("../models/product");
const Customer = require("../models/customer");
const Sales = require("../models/sales");
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

    // Apply filterType
    if (filterType === 'Active') {
        filter.status = 'Active';
    } else if (filterType === 'Expired') {
        filter.status = 'Expired';
    } else if (filterType === 'GST') {
        filter.isGstMode = true;
    } else if (filterType === 'Non-GST') {
        filter.isGstMode = false;
    }
    // 'All' or undefined → no additional filter

    // Apply search
    if (search) {
        filter.$or = [
            { amcNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
            { customerPhone: { $regex: search, $options: 'i' } },
            { linkedInvoiceNumber: { $regex: search, $options: 'i' } },
            { 'products.productName': { $regex: search, $options: 'i' } }
        ];
    }

    return filter;
};

// ===== HELPER: Generate AMC Number =====
// GST → AMC20260001 ; Non-GST → NAMC20260001
const generateAmcNumber = async (isGstMode = true) => {
    const year = new Date().getFullYear();
    const prefix = isGstMode ? 'AMC' : 'NAMC';
    const fullPrefix = `${prefix}${year}`;

    // Active AMCs for this series
    const activeAmcs = await AMC.find({
        amcNumber: { $regex: `^${fullPrefix}` }
    }).select('amcNumber').lean();

    // Deleted AMCs for this series
    const deletedAmcs = await DeletedAmc.find({
        amcNumber: { $regex: `^${fullPrefix}` }
    }).select('amcNumber').lean();

    const allNumbers = [
        ...activeAmcs.map(a => parseInt(a.amcNumber.replace(fullPrefix, '')) || 0),
        ...deletedAmcs.map(a => parseInt(a.amcNumber.replace(fullPrefix, '')) || 0)
    ].filter(n => n > 0);

    let nextNumber;

    if (allNumbers.length === 0) {
        nextNumber = 1;
    } else {
        const activeNumbers = activeAmcs
            .map(a => parseInt(a.amcNumber.replace(fullPrefix, '')) || 0)
            .filter(n => n > 0);

        const maxAllNumber = Math.max(...allNumbers);
        const maxActiveNumber = activeNumbers.length > 0 ? Math.max(...activeNumbers) : 0;

        if (maxAllNumber > maxActiveNumber) {
            // Latest number was deleted → reuse it
            nextNumber = maxAllNumber;
        } else {
            // Latest is active → increment
            nextNumber = maxActiveNumber + 1;
        }
    }

    return `${fullPrefix}${String(nextNumber).padStart(4, '0')}`;
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

// ===== HELPER: Process products array =====
const processProducts = async (products) => {
    const processed = [];

    for (const item of products) {
        const product = await Product.findOne({ productId: item.productId });
        if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
        }

        const discountPercent = Number(item.discountPercent) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const quantity = Number(item.quantity) || 0;
        const discountFactor = (100 - discountPercent) / 100;
        const discountedUnitPrice = unitPrice * discountFactor;
        const discountAmount = unitPrice - discountedUnitPrice;
        const finalPrice = discountedUnitPrice * quantity;

        processed.push({
            productId: product.productId,
            productName: product.productName,
            productDescription: product.productDescription || '',
            invoiceDescription: item.invoiceDescription || '',
            hsnCode: item.hsnCode || product.hsnCode || '',
            capacity: item.capacity || '',
            quantity: quantity,
            unitPrice: unitPrice,
            discountPercent: discountPercent,
            discountAmount: discountAmount,
            discountedUnitPrice: discountedUnitPrice,
            finalPrice: finalPrice
        });
    }

    return processed;
};

// =============================================
// POST /api/amc/create-amc - Create new AMC
// =============================================
router.post("/create-amc", async (req, res) => {
    try {
        console.log("🚀 ===== CREATE AMC START =====");

        const {
            customerId,
            storeType,
            startDate,
            durationYears,
            products,
            notes,
            customerGstin,
            customerState,
            paymentType,
            paymentStatus,
            isGstMode,
            taxSlab,
            linkedSaleId,
            linkedInvoiceNumber
        } = req.body;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer is required"
            });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one product is required"
            });
        }

        if (!durationYears || ![1, 2, 3, 5].includes(Number(durationYears))) {
            return res.status(400).json({
                success: false,
                message: "Duration must be 1, 2, 3, or 5 years"
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

        // ===== PROCESS PRODUCTS =====
        let processedProducts;
        try {
            processedProducts = await processProducts(products);
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: err.message
            });
        }

        const gstin = customerGstin || customer.gstNumber || '';
        const taxType = determineTaxType(gstin);
        const finalGstMode = isGstMode !== undefined ? isGstMode : true;

        // ===== GENERATE AMC NUMBER =====
        const amcNumber = await generateAmcNumber(finalGstMode);

        // ===== DETERMINE STATUS & START DATE =====
        // Check if this customer already has an Active AMC (only if linked to a sale product? No — for renewal we'll have separate route)
        // For normal create, status = Active and startDate = today (or provided)
        const finalStartDate = startDate || new Date();

        const finalPaymentType = paymentStatus === 'Pending' ? null : (paymentType || 'Cash');

        const newAmc = new AMC({
            amcNumber,
            renewalOf: null,
            linkedSaleId: linkedSaleId || null,
            linkedInvoiceNumber: linkedInvoiceNumber || null,
            customerId: customer.customerId,
            customerName: customer.customerName,
            customerEmail: customer.email || '',
            customerPhone: customer.contactNumber || '',
            customerGstin: gstin,
            customerState: customerState || '',
            customerAddress: customer.address || '',
            storeType: storeType || 'Vadodara',
            products: processedProducts,
            durationYears: Number(durationYears),
            startDate: finalStartDate,
            status: 'Active',
            paymentStatus: paymentStatus || 'Paid',
            paymentType: finalPaymentType,
            isGstMode: finalGstMode,
            taxSlab: finalGstMode ? (Number(taxSlab) || 18) : 0,
            taxType: taxType,
            notes: notes || '',
            createdBy: user.name,
            createdById: user.userId
        });

        // Calculate endDate
        newAmc.calculateEndDate();
        newAmc.recalculateTotals();

        const savedAmc = await newAmc.save();

        console.log("✅ AMC SAVED:", savedAmc.amcNumber);

        res.status(201).json({
            success: true,
            message: "AMC created successfully",
            data: savedAmc,
            amcNumber: amcNumber
        });

    } catch (error) {
        console.error("❌ ERROR creating AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create AMC",
            error: error.message
        });
    }
});

// =============================================
// POST /api/amc/renew-amc/:id - Renew AMC
// Creates a NEW AMC with renewalOf = old AMC id
// Products come from request body (user can add/remove/edit)
// =============================================
router.post("/renew-amc/:id", async (req, res) => {
    try {
        console.log("🚀 ===== RENEW AMC START =====");

        const { durationYears, startDate, notes, products, paymentStatus, paymentType } = req.body;

        if (!durationYears || ![1, 2, 3, 5].includes(Number(durationYears))) {
            return res.status(400).json({
                success: false,
                message: "Duration must be 1, 2, 3, or 5 years"
            });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one product is required for renewal"
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

        const existingAmc = await AMC.findOne({ amcId: req.params.id });
        if (!existingAmc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        // ===== CHECK: Only ONE pending renewal allowed =====
        const existingPending = await AMC.findOne({
            renewalOf: existingAmc.amcId,
            renewalOfNumber: existingAmc.amcNumber,
            status: 'Pending'
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: "A pending renewal already exists for this AMC. Please update that pending AMC instead."
            });
        }

        // ===== PROCESS PRODUCTS (from request body) =====
        let processedProducts;
        try {
            processedProducts = await processProducts(products);
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: err.message
            });
        }

        // ===== NEW AMC NUMBER =====
        const amcNumber = await generateAmcNumber(existingAmc.isGstMode);

        // ===== DETERMINE START DATE & STATUS =====
        let newStartDate;
        let newStatus;

        const now = new Date();
        const isCurrentActive = existingAmc.status === 'Active' && existingAmc.endDate >= now;

        if (isCurrentActive) {
            // Active exists → status = Pending
            // Use user-provided startDate if given, else default to old endDate + 1
            if (startDate) {
                newStartDate = new Date(startDate);
            } else {
                newStartDate = new Date(existingAmc.endDate);
                newStartDate.setDate(newStartDate.getDate() + 1);
            }
            newStatus = 'Pending';
        } else {
            // No active AMC → status = Active, use user-provided startDate or now
            newStartDate = startDate ? new Date(startDate) : now;
            newStatus = 'Active';
        }

        // ===== PAYMENT (allow override from body, else inherit) =====
        const finalPaymentStatus = paymentStatus !== undefined ? paymentStatus : existingAmc.paymentStatus;
        const finalPaymentType = finalPaymentStatus === 'Pending'
            ? null
            : (paymentType !== undefined ? paymentType : existingAmc.paymentType);

        const newAmc = new AMC({
            amcNumber,
            renewalOf: existingAmc.amcId,
            linkedSaleId: existingAmc.linkedSaleId || null,
            linkedInvoiceNumber: existingAmc.linkedInvoiceNumber || null,
            customerId: existingAmc.customerId,
            customerName: existingAmc.customerName,
            customerEmail: existingAmc.customerEmail || '',
            customerPhone: existingAmc.customerPhone || '',
            customerGstin: existingAmc.customerGstin || '',
            customerState: existingAmc.customerState || '',
            customerAddress: existingAmc.customerAddress || '',
            storeType: existingAmc.storeType || 'Vadodara',
            products: processedProducts,
            durationYears: Number(durationYears),
            startDate: newStartDate,
            status: newStatus,
            paymentStatus: finalPaymentStatus,
            paymentType: finalPaymentType,
            isGstMode: existingAmc.isGstMode,
            taxSlab: existingAmc.taxSlab,
            taxType: existingAmc.taxType,
            notes: notes || '',
            createdBy: user.name,
            createdById: user.userId
        });

        newAmc.calculateEndDate();
        newAmc.recalculateTotals();

        const savedAmc = await newAmc.save();

        console.log("✅ RENEWAL AMC SAVED:", savedAmc.amcNumber, "| Status:", savedAmc.status);

        res.status(201).json({
            success: true,
            message: `AMC renewed successfully. New AMC status: ${newStatus}`,
            data: savedAmc,
            amcNumber: amcNumber
        });

    } catch (error) {
        console.error("❌ ERROR renewing AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to renew AMC",
            error: error.message
        });
    }
});

// =============================================
// PUT /api/amc/update-amc/:id - Update AMC
// Active / Pending: EVERYTHING editable
//   (startDate, durationYears, notes, paymentStatus, paymentType, products)
// Expired / Cancelled: NOT editable
// Status is NEVER touched here (cron handles status changes)
// =============================================
router.put("/update-amc/:id", async (req, res) => {
    try {
        const {
            amcId,
            _id,
            createdAt,
            updatedAt,
            amcNumber,
            renewalOf,
            status,
            ...updateData
        } = req.body;

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

        const existingAmc = await AMC.findOne({ amcId: req.params.id });
        if (!existingAmc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        // ===== RULE: Cannot edit Expired or Cancelled AMC =====
        if (existingAmc.status === 'Expired' || existingAmc.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: "Cannot edit expired or cancelled AMC. Please create a new renewal instead."
            });
        }

        // ===== BUILD ALLOWED CHANGES =====
        const allowedChanges = {};

        // Duration
        if (updateData.durationYears !== undefined) {
            const dur = Number(updateData.durationYears);
            if (![1, 2, 3, 5].includes(dur)) {
                return res.status(400).json({
                    success: false,
                    message: "Duration must be 1, 2, 3, or 5 years"
                });
            }
            allowedChanges.durationYears = dur;
        }

        // Start Date
        if (updateData.startDate !== undefined && updateData.startDate !== '') {
            allowedChanges.startDate = new Date(updateData.startDate);
        }

        // Notes
        if (updateData.notes !== undefined) {
            allowedChanges.notes = updateData.notes;
        }

        // Payment Status / Type
        if (updateData.paymentStatus !== undefined) {
            allowedChanges.paymentStatus = updateData.paymentStatus;
            if (updateData.paymentStatus === 'Pending') {
                allowedChanges.paymentType = null;
            } else if (updateData.paymentType !== undefined) {
                allowedChanges.paymentType = updateData.paymentType;
            }
        } else if (updateData.paymentType !== undefined) {
            allowedChanges.paymentType = updateData.paymentType;
        }

        // Products — reprocess if sent
        if (updateData.products !== undefined) {
            if (!Array.isArray(updateData.products) || updateData.products.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one product is required"
                });
            }

            let processedProducts;
            try {
                processedProducts = await processProducts(updateData.products);
            } catch (err) {
                return res.status(404).json({
                    success: false,
                    message: err.message
                });
            }
            allowedChanges.products = processedProducts;
        }

        // ===== BUILD TEMP DOC TO RECALC endDate + totals =====
        const tempAmc = new AMC({
            ...existingAmc.toObject(),
            ...allowedChanges,
            amcId: existingAmc.amcId,
            amcNumber: existingAmc.amcNumber
        });

        // Recalc endDate if startDate OR durationYears changed
        if (allowedChanges.startDate !== undefined || allowedChanges.durationYears !== undefined) {
            tempAmc.calculateEndDate();
        }

        // Recalc totals if products changed
        if (allowedChanges.products !== undefined) {
            tempAmc.recalculateTotals();
        }

        // ===== BUILD FINAL UPDATE =====
        const finalUpdate = {
            ...allowedChanges,
            updatedBy: user.name,
            updatedById: user.userId
        };

        if (allowedChanges.startDate !== undefined || allowedChanges.durationYears !== undefined) {
            finalUpdate.endDate = tempAmc.endDate;
        }

        if (allowedChanges.products !== undefined) {
            finalUpdate.products = tempAmc.products;
            finalUpdate.subtotal = tempAmc.subtotal;
            finalUpdate.totalDiscount = tempAmc.totalDiscount;
            finalUpdate.totalTax = tempAmc.totalTax;
            finalUpdate.grandTotal = tempAmc.grandTotal;
            finalUpdate.taxBreakdown = tempAmc.taxBreakdown;
        }

        const updatedAmc = await AMC.findOneAndUpdate(
            { amcId: req.params.id },
            finalUpdate,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "AMC updated successfully",
            data: updatedAmc
        });

    } catch (error) {
        console.error("❌ ERROR updating AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update AMC",
            error: error.message
        });
    }
});

// =============================================
// POST /api/amc/add-service/:id - Add service entry
// =============================================
router.post("/add-service/:id", async (req, res) => {
    try {
        const { productId, serviceDate, quantity, storeType, notes } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product is required"
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

        const amc = await AMC.findOne({ amcId: req.params.id });
        if (!amc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        // ===== RULE: Only products listed in the AMC =====
        const amcProduct = amc.products.find(p => p.productId === productId);
        if (!amcProduct) {
            return res.status(400).json({
                success: false,
                message: "This product is not part of this AMC"
            });
        }

        // ===== RULE: AMC must be Active =====
        if (amc.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: `Cannot add service. AMC status is ${amc.status}.`
            });
        }

        const serviceEntry = {
            productId: amcProduct.productId,
            productName: amcProduct.productName,
            serviceDate: serviceDate || new Date(),
            quantity: Number(quantity) || 1,
            storeType: storeType || amc.storeType || 'Vadodara',
            notes: notes || '',
            servicedBy: user.name,
            servicedById: user.userId
        };

        amc.serviceHistory.push(serviceEntry);
        await amc.save();

        res.status(200).json({
            success: true,
            message: "Service entry added successfully",
            data: amc
        });

    } catch (error) {
        console.error("❌ ERROR adding service entry:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add service entry",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-amcs - Get all AMCs (paginated + search + filter)
// =============================================
router.get("/get-amcs", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';
        const skip = (page - 1) * limit;

        const filter = buildFilter(search, filterType);

        const total = await AMC.countDocuments(filter);
        const amcs = await AMC.find(filter)
            .sort({ startDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: amcs,
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
        console.error("Error fetching AMCs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch AMCs",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/export-amcs - Export all AMCs (with filter + search)
// =============================================
router.get("/export-amcs", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const amcs = await AMC.find(filter)
            .sort({ startDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: amcs,
            total: amcs.length
        });
    } catch (error) {
        console.error("Error exporting AMCs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export AMCs",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-all-filtered - Get ALL filtered AMCs (for PDF export)
// =============================================
router.get("/get-all-filtered", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const amcs = await AMC.find(filter)
            .sort({ startDate: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: amcs,
            total: amcs.length
        });
    } catch (error) {
        console.error("Error fetching all filtered AMCs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch filtered AMCs",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-amc/:id - Get AMC by ID
// =============================================
router.get("/get-amc/:id", async (req, res) => {
    try {
        const amc = await AMC.findOne({ amcId: req.params.id }).lean();

        if (!amc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        res.status(200).json({
            success: true,
            data: amc
        });
    } catch (error) {
        console.error("Error fetching AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch AMC",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-amc-by-number/:amcNumber
// =============================================
router.get("/get-amc-by-number/:amcNumber", async (req, res) => {
    try {
        const amc = await AMC.findOne({
            amcNumber: req.params.amcNumber
        }).lean();

        if (!amc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        res.status(200).json({
            success: true,
            data: amc
        });
    } catch (error) {
        console.error("Error fetching AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch AMC",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-sale-products/:saleId - Get products from a sale
// (for pre-filling AMC from sale)
// =============================================
router.get("/get-sale-products/:saleId", async (req, res) => {
    try {
        const sale = await Sales.findOne({ saleId: req.params.saleId }).lean();

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: "Sale not found"
            });
        }

        // Return products from that sale (with product info)
        const products = sale.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productDescription: item.productDescription || '',
            invoiceDescription: item.invoiceDescription || '',
            hsnCode: item.hsnCode || '',
            capacity: item.capacity || '',
            quantity: item.quantity,
            unitPrice: 0,  // User enters manually
            discountPercent: 0
        }));

        res.status(200).json({
            success: true,
            data: {
                saleId: sale.saleId,
                invoiceNumber: sale.invoiceNumber,
                customerId: sale.customerId,
                customerName: sale.customerName,
                customerEmail: sale.customerEmail,
                customerPhone: sale.customerPhone,
                customerGstin: sale.customerGstin,
                customerAddress: sale.customerAddress,
                customerState: sale.customerState,
                storeType: sale.storeType,
                isGstMode: sale.isGstMode,
                taxSlab: sale.taxSlab,
                taxType: sale.taxType,
                products: products
            }
        });
    } catch (error) {
        console.error("Error fetching sale products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sale products",
            error: error.message
        });
    }
});

// =============================================
// GET /api/amc/get-customer-amcs/:customerId - Get AMCs for a customer
// =============================================
router.get("/get-customer-amcs/:customerId", async (req, res) => {
    try {
        const amcs = await AMC.find({ customerId: req.params.customerId })
            .sort({ startDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: amcs,
            total: amcs.length
        });
    } catch (error) {
        console.error("Error fetching customer AMCs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer AMCs",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/amc/delete-amc/:id - HARD DELETE + Move to DeletedAmc
// =============================================
router.delete("/delete-amc/:id", async (req, res) => {
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

        const amc = await AMC.findOne({ amcId: req.params.id });
        if (!amc) {
            return res.status(404).json({
                success: false,
                message: "AMC not found"
            });
        }

        // ===== Check: if this AMC has a pending renewal, don't delete =====
        const pendingRenewal = await AMC.findOne({
            renewalOf: amc.amcId,
            status: 'Pending'
        });

        if (pendingRenewal) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete. This AMC has a pending renewal linked to it."
            });
        }

        const deletedAmc = new DeletedAmc({
            originalAmcId: amc.amcId,
            amcNumber: amc.amcNumber,
            renewalOf: amc.renewalOf,
            linkedSaleId: amc.linkedSaleId,
            linkedInvoiceNumber: amc.linkedInvoiceNumber,
            customerId: amc.customerId,
            customerName: amc.customerName,
            customerEmail: amc.customerEmail,
            customerPhone: amc.customerPhone,
            customerGstin: amc.customerGstin,
            customerState: amc.customerState,
            customerAddress: amc.customerAddress,
            storeType: amc.storeType,
            products: amc.products,
            durationYears: amc.durationYears,
            startDate: amc.startDate,
            endDate: amc.endDate,
            status: amc.status,
            serviceHistory: amc.serviceHistory,
            paymentStatus: amc.paymentStatus,
            paymentType: amc.paymentType,
            isGstMode: amc.isGstMode,
            taxSlab: amc.taxSlab,
            taxType: amc.taxType,
            subtotal: amc.subtotal,
            totalDiscount: amc.totalDiscount,
            totalTax: amc.totalTax,
            grandTotal: amc.grandTotal,
            taxBreakdown: amc.taxBreakdown,
            notes: amc.notes,
            createdBy: amc.createdBy,
            createdById: amc.createdById,
            updatedBy: amc.updatedBy,
            updatedById: amc.updatedById,
            deletedBy: user.name,
            deletedById: user.userId,
            deletedAt: new Date(),
            deletedReason: req.body?.deletedReason || ''
        });

        await deletedAmc.save();

        await AMC.findOneAndDelete({ amcId: req.params.id });

        res.status(200).json({
            success: true,
            message: "AMC deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting AMC:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete AMC",
            error: error.message
        });
    }
});

module.exports = router;