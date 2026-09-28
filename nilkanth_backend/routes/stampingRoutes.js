const express = require("express");
const router = express.Router();
const Stamping = require("../models/stamping");
const StampingUnit = require("../models/stampingUnit");
const DeletedStamping = require("../models/deletedStamping");
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

// ===== HELPER: Build filter =====
const buildFilter = (search, filterType) => {
    let filter = {};

    if (filterType === 'GST') {
        filter.isGstMode = true;
    } else if (filterType === 'Non-GST') {
        filter.isGstMode = false;
    }

    if (search) {
        filter.$or = [
            { stampingNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
            { customerPhone: { $regex: search, $options: 'i' } },
            { linkedInvoiceNumber: { $regex: search, $options: 'i' } },
            { 'products.productName': { $regex: search, $options: 'i' } },
            { 'products.uniqueNumbers.number': { $regex: search, $options: 'i' } }
        ];
    }

    return filter;
};

// ===== HELPER: Generate Stamping Number =====
// GST → STP20260001 ; Non-GST → NSTP20260001
const generateStampingNumber = async (isGstMode = true) => {
    const year = new Date().getFullYear();
    const prefix = isGstMode ? 'STP' : 'NSTP';
    const fullPrefix = `${prefix}${year}`;

    const activeStampings = await Stamping.find({
        stampingNumber: { $regex: `^${fullPrefix}` }
    }).select('stampingNumber').lean();

    const deletedStampings = await DeletedStamping.find({
        stampingNumber: { $regex: `^${fullPrefix}` }
    }).select('stampingNumber').lean();

    const allNumbers = [
        ...activeStampings.map(s => parseInt(s.stampingNumber.replace(fullPrefix, '')) || 0),
        ...deletedStampings.map(s => parseInt(s.stampingNumber.replace(fullPrefix, '')) || 0)
    ].filter(n => n > 0);

    let nextNumber;

    if (allNumbers.length === 0) {
        nextNumber = 1;
    } else {
        const activeNumbers = activeStampings
            .map(s => parseInt(s.stampingNumber.replace(fullPrefix, '')) || 0)
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

// ===== HELPER: Determine tax type =====
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

// ===== HELPER: Process products =====
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

        // ===== UNIQUE NUMBERS =====
        const uniqueNumbers = [];
        if (item.uniqueNumbers && Array.isArray(item.uniqueNumbers)) {
            for (const un of item.uniqueNumbers) {
                uniqueNumbers.push({
                    number: un.number ? un.number.trim() : '',
                    isUsed: true
                });
            }
        }

        // Pad with empty entries if fewer than qty
        const currentCount = uniqueNumbers.length;
        if (currentCount < quantity) {
            const diff = quantity - currentCount;
            for (let i = 0; i < diff; i++) {
                uniqueNumbers.push({ number: '', isUsed: true });
            }
        } else if (currentCount > quantity) {
            uniqueNumbers.splice(quantity);
        }

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
            finalPrice: finalPrice,
            uniqueNumbers: uniqueNumbers
        });
    }

    return processed;
};

// ===== HELPER: Upsert StampingUnit for each product + uniqueNumber =====
const upsertStampingUnits = async (stamping, user) => {
    const unitsUpdated = [];

    for (const product of stamping.products) {
        const usedNumbers = (product.uniqueNumbers || [])
            .map(u => (u.number || '').trim())
            .filter(n => n.length > 0);

        for (const uniqueNumber of usedNumbers) {
            try {
                const filter = {
                    customerId: stamping.customerId,
                    productId: product.productId,
                    uniqueNumber: uniqueNumber
                };

                // Compute nextDueDate = stampDate + 1 year
                const nextDue = new Date(stamping.stampDate);
                nextDue.setFullYear(nextDue.getFullYear() + 1);

                const existing = await StampingUnit.findOne(filter);

                if (existing) {
                    // Push new entry to history + update caches
                    existing.stampHistory.push({
                        stampingId: stamping.stampingId,
                        stampingNumber: stamping.stampingNumber,
                        stampDate: stamping.stampDate,
                        storeType: stamping.storeType,
                        stampedBy: user.name,
                        stampedById: user.userId
                    });
                    existing.lastStampDate = stamping.stampDate;
                    existing.nextDueDate = nextDue;
                    existing.lastStampingNumber = stamping.stampingNumber;
                    existing.lastStampingId = stamping.stampingId;
                    existing.totalStamps = existing.stampHistory.length;
                    // Refresh meta from latest
                    existing.productName = product.productName;
                    existing.hsnCode = product.hsnCode || existing.hsnCode;
                    existing.capacity = product.capacity || existing.capacity;
                    existing.customerName = stamping.customerName;
                    existing.storeType = stamping.storeType;

                    await existing.save();
                    unitsUpdated.push({ uniqueNumber, action: 'updated', unitId: existing.unitId });
                } else {
                    // Create new unit
                    const newUnit = new StampingUnit({
                        customerId: stamping.customerId,
                        customerName: stamping.customerName,
                        productId: product.productId,
                        productName: product.productName,
                        uniqueNumber: uniqueNumber,
                        hsnCode: product.hsnCode || '',
                        capacity: product.capacity || '',
                        storeType: stamping.storeType,
                        lastStampDate: stamping.stampDate,
                        nextDueDate: nextDue,
                        lastStampingNumber: stamping.stampingNumber,
                        lastStampingId: stamping.stampingId,
                        totalStamps: 1,
                        stampHistory: [{
                            stampingId: stamping.stampingId,
                            stampingNumber: stamping.stampingNumber,
                            stampDate: stamping.stampDate,
                            storeType: stamping.storeType,
                            stampedBy: user.name,
                            stampedById: user.userId
                        }]
                    });

                    await newUnit.save();
                    unitsUpdated.push({ uniqueNumber, action: 'created', unitId: newUnit.unitId });
                }
            } catch (err) {
                console.error(`Error upserting unit ${uniqueNumber}:`, err.message);
                unitsUpdated.push({ uniqueNumber, action: 'error', error: err.message });
            }
        }
    }

    return unitsUpdated;
};

// =============================================
// POST /api/stamping/create-stamping
// =============================================
router.post("/create-stamping", async (req, res) => {
    try {
        console.log("🚀 ===== CREATE STAMPING START =====");

        const {
            customerId,
            storeType,
            stampDate,
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

        // ===== GENERATE STAMPING NUMBER =====
        const stampingNumber = await generateStampingNumber(finalGstMode);

        const finalStampDate = stampDate ? new Date(stampDate) : new Date();
        const finalPaymentType = paymentStatus === 'Pending' ? null : (paymentType || 'Cash');

        const newStamping = new Stamping({
            stampingNumber,
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
            stampDate: finalStampDate,
            isGstMode: finalGstMode,
            taxSlab: finalGstMode ? (Number(taxSlab) || 18) : 0,
            taxType: taxType,
            paymentStatus: paymentStatus || 'Paid',
            paymentType: finalPaymentType,
            notes: notes || '',
            createdBy: user.name,
            createdById: user.userId
        });

        newStamping.recalculateTotals();

        const savedStamping = await newStamping.save();

        // ===== UPSERT STAMPING UNITS =====
        const unitsResult = await upsertStampingUnits(savedStamping, user);

        console.log("✅ STAMPING SAVED:", savedStamping.stampingNumber);
        console.log("✅ UNITS:", unitsResult);

        res.status(201).json({
            success: true,
            message: "Stamping created successfully",
            data: savedStamping,
            stampingNumber: stampingNumber,
            unitsResult: unitsResult
        });

    } catch (error) {
        console.error("❌ ERROR creating stamping:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create stamping",
            error: error.message
        });
    }
});

// =============================================
// PUT /api/stamping/update-stamping/:id
// =============================================
router.put("/update-stamping/:id", async (req, res) => {
    try {
        const {
            stampingId,
            _id,
            createdAt,
            updatedAt,
            stampingNumber,
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

        const existingStamping = await Stamping.findOne({ stampingId: req.params.id });
        if (!existingStamping) {
            return res.status(404).json({
                success: false,
                message: "Stamping not found"
            });
        }

        // Process products if sent
        if (updateData.products && Array.isArray(updateData.products)) {
            let processedProducts;
            try {
                processedProducts = await processProducts(updateData.products);
            } catch (err) {
                return res.status(404).json({
                    success: false,
                    message: err.message
                });
            }
            updateData.products = processedProducts;
        }

        // GSTIN
        if (!updateData.customerGstin || updateData.customerGstin.trim() === '') {
            updateData.customerGstin = existingStamping.customerGstin || '';
        }
        updateData.taxType = determineTaxType(updateData.customerGstin || '');

        if (updateData.paymentStatus === 'Pending') {
            updateData.paymentType = null;
        }

        if (!updateData.isGstMode) {
            updateData.taxSlab = 0;
        }

        // ===== Build temp to recalc =====
        const tempStamping = new Stamping({
            ...existingStamping.toObject(),
            ...updateData,
            stampingId: existingStamping.stampingId,
            stampingNumber: existingStamping.stampingNumber
        });

        tempStamping.recalculateTotals();

        const finalUpdate = {
            ...updateData,
            products: tempStamping.products,
            subtotal: tempStamping.subtotal,
            totalDiscount: tempStamping.totalDiscount,
            totalTax: tempStamping.totalTax,
            grandTotal: tempStamping.grandTotal,
            taxBreakdown: tempStamping.taxBreakdown,
            updatedBy: user.name,
            updatedById: user.userId
        };

        const updatedStamping = await Stamping.findOneAndUpdate(
            { stampingId: req.params.id },
            finalUpdate,
            { new: true, runValidators: true }
        );

        // NOTE: We do NOT touch StampingUnit history on edit for now.
        // If admin changes products/unique numbers drastically, unit history
        // may become out of sync — but for real-world usage, editing a
        // finished stamping should be rare. If needed later, we can add
        // a "resync units" endpoint.

        res.status(200).json({
            success: true,
            message: "Stamping updated successfully",
            data: updatedStamping
        });

    } catch (error) {
        console.error("❌ ERROR updating stamping:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update stamping",
            error: error.message
        });
    }
});

// =============================================
// POST /api/stamping/check-duplicate
// Check if customerId + productId + uniqueNumber + stampDate already exists
// =============================================
router.post("/check-duplicate", async (req, res) => {
    try {
        const { customerId, productId, uniqueNumber, stampDate, excludeStampingId } = req.body;

        if (!customerId || !productId || !uniqueNumber || !stampDate) {
            return res.status(400).json({
                success: false,
                message: "customerId, productId, uniqueNumber, stampDate required"
            });
        }

        // Normalize stampDate to full-day range
        const d = new Date(stampDate);
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);

        const query = {
            customerId: customerId,
            'products.productId': productId,
            'products.uniqueNumbers.number': uniqueNumber,
            stampDate: { $gte: startOfDay, $lte: endOfDay }
        };

        if (excludeStampingId) {
            query.stampingId = { $ne: excludeStampingId };
        }

        const found = await Stamping.findOne(query).select('stampingNumber stampDate customerName').lean();

        if (found) {
            return res.status(200).json({
                success: true,
                isDuplicate: true,
                message: `This unit was already stamped on ${new Date(found.stampDate).toLocaleDateString('en-IN')} under ${found.stampingNumber}`,
                existing: found
            });
        }

        return res.status(200).json({
            success: true,
            isDuplicate: false
        });

    } catch (error) {
        console.error("Error checking duplicate:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check duplicate",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-customer-units/:customerId
// Fetch all StampingUnits of a customer (for previous-units panel)
// =============================================
router.get("/get-customer-units/:customerId", async (req, res) => {
    try {
        const units = await StampingUnit.find({ customerId: req.params.customerId })
            .sort({ lastStampDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: units,
            total: units.length
        });
    } catch (error) {
        console.error("Error fetching customer units:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch units",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-unit-history
// Query params: customerId, productId, uniqueNumber
// =============================================
router.get("/get-unit-history", async (req, res) => {
    try {
        const { customerId, productId, uniqueNumber } = req.query;

        if (!customerId || !productId || !uniqueNumber) {
            return res.status(400).json({
                success: false,
                message: "customerId, productId, uniqueNumber required"
            });
        }

        const unit = await StampingUnit.findOne({
            customerId: customerId,
            productId: productId,
            uniqueNumber: uniqueNumber
        }).lean();

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        res.status(200).json({
            success: true,
            data: unit
        });
    } catch (error) {
        console.error("Error fetching unit history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unit history",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-stampings
// =============================================
router.get("/get-stampings", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';
        const skip = (page - 1) * limit;

        const filter = buildFilter(search, filterType);

        const total = await Stamping.countDocuments(filter);
        const stampings = await Stamping.find(filter)
            .sort({ stampDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: stampings,
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
        console.error("Error fetching stampings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch stampings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/export-stampings
// =============================================
router.get("/export-stampings", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const stampings = await Stamping.find(filter)
            .sort({ stampDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: stampings,
            total: stampings.length
        });
    } catch (error) {
        console.error("Error exporting stampings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export stampings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-all-filtered
// =============================================
router.get("/get-all-filtered", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const stampings = await Stamping.find(filter)
            .sort({ stampDate: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: stampings,
            total: stampings.length
        });
    } catch (error) {
        console.error("Error fetching all filtered stampings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch filtered stampings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-stamping/:id
// =============================================
router.get("/get-stamping/:id", async (req, res) => {
    try {
        const stamping = await Stamping.findOne({ stampingId: req.params.id }).lean();

        if (!stamping) {
            return res.status(404).json({
                success: false,
                message: "Stamping not found"
            });
        }

        res.status(200).json({
            success: true,
            data: stamping
        });
    } catch (error) {
        console.error("Error fetching stamping:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch stamping",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-stamping-by-number/:stampingNumber
// =============================================
router.get("/get-stamping-by-number/:stampingNumber", async (req, res) => {
    try {
        const stamping = await Stamping.findOne({
            stampingNumber: req.params.stampingNumber
        }).lean();

        if (!stamping) {
            return res.status(404).json({
                success: false,
                message: "Stamping not found"
            });
        }

        res.status(200).json({
            success: true,
            data: stamping
        });
    } catch (error) {
        console.error("Error fetching stamping:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch stamping",
            error: error.message
        });
    }
});

// =============================================
// GET /api/stamping/get-sale-products/:saleId
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

        const products = sale.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productDescription: item.productDescription || '',
            invoiceDescription: item.invoiceDescription || '',
            hsnCode: item.hsnCode || '',
            capacity: item.capacity || '',
            quantity: item.quantity,
            unitPrice: 0,
            discountPercent: 0,
            uniqueNumbers: (item.uniqueNumbers || []).map(u => ({
                number: u.number || '',
                isUsed: u.isUsed || false
            }))
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
// GET /api/stamping/get-customer-stampings/:customerId
// =============================================
router.get("/get-customer-stampings/:customerId", async (req, res) => {
    try {
        const stampings = await Stamping.find({ customerId: req.params.customerId })
            .sort({ stampDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: stampings,
            total: stampings.length
        });
    } catch (error) {
        console.error("Error fetching customer stampings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer stampings",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/stamping/delete-stamping/:id
// Hard delete → DeletedStamping
// =============================================
router.delete("/delete-stamping/:id", async (req, res) => {
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

        const stamping = await Stamping.findOne({ stampingId: req.params.id });
        if (!stamping) {
            return res.status(404).json({
                success: false,
                message: "Stamping not found"
            });
        }

        const deletedStamping = new DeletedStamping({
            originalStampingId: stamping.stampingId,
            stampingNumber: stamping.stampingNumber,
            linkedSaleId: stamping.linkedSaleId,
            linkedInvoiceNumber: stamping.linkedInvoiceNumber,
            customerId: stamping.customerId,
            customerName: stamping.customerName,
            customerEmail: stamping.customerEmail,
            customerPhone: stamping.customerPhone,
            customerGstin: stamping.customerGstin,
            customerState: stamping.customerState,
            customerAddress: stamping.customerAddress,
            storeType: stamping.storeType,
            products: stamping.products,
            stampDate: stamping.stampDate,
            isGstMode: stamping.isGstMode,
            taxSlab: stamping.taxSlab,
            taxType: stamping.taxType,
            subtotal: stamping.subtotal,
            totalDiscount: stamping.totalDiscount,
            totalTax: stamping.totalTax,
            grandTotal: stamping.grandTotal,
            taxBreakdown: stamping.taxBreakdown,
            paymentStatus: stamping.paymentStatus,
            paymentType: stamping.paymentType,
            notes: stamping.notes,
            createdBy: stamping.createdBy,
            createdById: stamping.createdById,
            updatedBy: stamping.updatedBy,
            updatedById: stamping.updatedById,
            deletedBy: user.name,
            deletedById: user.userId,
            deletedAt: new Date(),
            deletedReason: req.body?.deletedReason || ''
        });

        await deletedStamping.save();

        await Stamping.findOneAndDelete({ stampingId: req.params.id });

        // NOTE: We do NOT remove StampingUnit entries on stamping delete.
        // The units represent physical machines that still exist and may
        // have other stamp history. If admin really wants to clean up,
        // we can add a separate cleanup endpoint later.

        res.status(200).json({
            success: true,
            message: "Stamping deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting stamping:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete stamping",
            error: error.message
        });
    }
});

module.exports = router;