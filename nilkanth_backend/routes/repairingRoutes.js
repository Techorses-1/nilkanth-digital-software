const express = require("express");
const router = express.Router();
const Repairing = require("../models/repairing");
const DeletedRepairing = require("../models/deletedRepairing");
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
            { repairingNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
            { customerPhone: { $regex: search, $options: 'i' } },
            { paymentType: { $regex: search, $options: 'i' } },
            { paymentStatus: { $regex: search, $options: 'i' } }
        ];
    }

    return filter;
};
// ✅ NEW: Handles 2 series - REP (GST) and NGR (Non-GST)
const generateRepairingNumber = async (isGstMode = true) => {
    const year = new Date().getFullYear();

    // ✅ Determine prefix based on GST mode
    const prefix = isGstMode ? 'REP' : 'NGR';
    const fullPrefix = `${prefix}${year}`;

    // ✅ Build series filter
    const seriesFilter = {
        isGstMode: isGstMode ? true : false
    };

    // Get active repairings for this series and year
    const activeRepairings = await Repairing.find({
        ...seriesFilter,
        repairingNumber: { $regex: `^${fullPrefix}` }
    }).select('repairingNumber').lean();

    // Get deleted repairings for this series and year
    const deletedRepairings = await DeletedRepairing.find({
        ...seriesFilter,
        repairingNumber: { $regex: `^${fullPrefix}` }
    }).select('repairingNumber').lean();

    const allNumbers = [
        ...activeRepairings.map(r => parseInt(r.repairingNumber.replace(fullPrefix, '')) || 0),
        ...deletedRepairings.map(r => parseInt(r.repairingNumber.replace(fullPrefix, '')) || 0)
    ].filter(n => n > 0);

    let nextNumber;

    if (allNumbers.length === 0) {
        nextNumber = 1;
    } else {
        const activeNumbers = activeRepairings
            .map(r => parseInt(r.repairingNumber.replace(fullPrefix, '')) || 0)
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

// =============================================
// POST /api/repairing/create-repairing - Create new repairing
// =============================================
router.post("/create-repairing", async (req, res) => {
    try {
        const {
            customerId,
            storeType,
            repairingDate,
            items,
            taxSlab,
            repairNotes,
            customerGstin,
            customerState,
            paymentType,
            paymentStatus,
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

            processedItems.push({
                productId: product.productId,
                productName: product.productName,
                productDescription: product.productDescription || '',
                invoiceDescription: item.invoiceDescription || '',
                hsnCode: item.hsnCode || product.hsnCode || '',
                unitName: item.unitName || 'NOS',
                capacity: item.capacity || '',
                quantity: quantity,
                unitPrice: unitPrice,
                discountPercent: discountPercent,
                discountAmount: discountAmount,
                discountedUnitPrice: discountedUnitPrice,
                finalPrice: finalPrice
            });
        }

        const gstin = customerGstin || customer.gstNumber || '';
        const taxType = determineTaxType(gstin);

        // ✅ FIX: Pass isGstMode to generateRepairingNumber
        const repairingNumber = await generateRepairingNumber(
            isGstMode !== undefined ? isGstMode : true
        );

        const finalPaymentType = paymentStatus === 'Pending' ? null : (paymentType || 'Cash');

        const newRepairing = new Repairing({
            repairingNumber,
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
            isGstMode: isGstMode !== undefined ? isGstMode : true,
            repairingDate: repairingDate || new Date(),
            items: processedItems,
            taxSlab: isGstMode ? (Number(taxSlab) || 18) : 0,
            taxType: taxType,
            repairNotes: repairNotes || '',
            createdBy: user.name,
            createdById: user.userId,
            status: 'Completed'
        });

        newRepairing.recalculateTotals();
        const savedRepairing = await newRepairing.save();

        res.status(201).json({
            success: true,
            message: "Repairing created successfully",
            data: savedRepairing,
            repairingNumber: repairingNumber
        });

    } catch (error) {
        console.error("Error creating repairing:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create repairing",
            error: error.message
        });
    }
});

// =============================================
// PUT /api/repairing/update-repairing/:id - Update repairing
// =============================================
router.put("/update-repairing/:id", async (req, res) => {
    try {
        const { repairingId, _id, createdAt, updatedAt, repairingNumber, ...updateData } = req.body;

        const decoded = getUserFromToken(req);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const existingRepairing = await Repairing.findOne({ repairingId: req.params.id });
        if (!existingRepairing) {
            return res.status(404).json({
                success: false,
                message: "Repairing not found"
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

                processedItems.push({
                    productId: product.productId,
                    productName: product.productName,
                    productDescription: product.productDescription || '',
                    invoiceDescription: item.invoiceDescription || '',
                    hsnCode: item.hsnCode || product.hsnCode || '',
                    unitName: item.unitName || 'NOS',
                    capacity: item.capacity || '',
                    quantity: quantity,
                    unitPrice: unitPrice,
                    discountPercent: discountPercent,
                    discountAmount: discountAmount,
                    discountedUnitPrice: discountedUnitPrice,
                    finalPrice: finalPrice
                });
            }

            updateData.items = processedItems;
        }

        if (!updateData.customerGstin || updateData.customerGstin.trim() === '') {
            updateData.customerGstin = existingRepairing.customerGstin || '';
        }
        updateData.taxType = determineTaxType(updateData.customerGstin || '');

        if (updateData.paymentStatus === 'Pending') {
            updateData.paymentType = null;
        }

        if (updateData.isGstMode === false) {
            updateData.taxSlab = 0;
        }

        const tempRepairing = new Repairing({
            ...existingRepairing.toObject(),
            ...updateData,
            repairingId: existingRepairing.repairingId,
            repairingNumber: existingRepairing.repairingNumber
        });

        tempRepairing.recalculateTotals();

        const finalUpdateData = {
            ...updateData,
            items: tempRepairing.items,
            subtotal: tempRepairing.subtotal,
            totalDiscount: tempRepairing.totalDiscount,
            totalTax: tempRepairing.totalTax,
            grandTotal: tempRepairing.grandTotal,
            taxBreakdown: tempRepairing.taxBreakdown
        };

        const updatedRepairing = await Repairing.findOneAndUpdate(
            { repairingId: req.params.id },
            finalUpdateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Repairing updated successfully",
            data: updatedRepairing
        });

    } catch (error) {
        console.error("Error updating repairing:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update repairing",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/get-repairings - Get all (pagination + filter)
// =============================================
router.get("/get-repairings", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';
        const skip = (page - 1) * limit;

        const filter = buildFilter(search, filterType);

        const total = await Repairing.countDocuments(filter);
        const repairings = await Repairing.find(filter)
            .sort({ repairingDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: repairings,
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
        console.error("Error fetching repairings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch repairings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/export-repairings - Export Excel
// =============================================
router.get("/export-repairings", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const repairings = await Repairing.find(filter)
            .sort({ repairingDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: repairings,
            total: repairings.length
        });
    } catch (error) {
        console.error("Error exporting repairings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export repairings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/get-all-filtered - For PDF export
// =============================================
router.get("/get-all-filtered", async (req, res) => {
    try {
        const search = req.query.search || '';
        const filterType = req.query.filterType || 'All';

        const filter = buildFilter(search, filterType);

        const repairings = await Repairing.find(filter)
            .sort({ repairingDate: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: repairings,
            total: repairings.length
        });
    } catch (error) {
        console.error("Error fetching all filtered repairings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch filtered repairings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/get-repairing/:id
// =============================================
router.get("/get-repairing/:id", async (req, res) => {
    try {
        const repairing = await Repairing.findOne({ repairingId: req.params.id }).lean();

        if (!repairing) {
            return res.status(404).json({
                success: false,
                message: "Repairing not found"
            });
        }

        res.status(200).json({
            success: true,
            data: repairing
        });
    } catch (error) {
        console.error("Error fetching repairing:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch repairing",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/get-repairing-by-number/:repairingNumber
// =============================================
router.get("/get-repairing-by-number/:repairingNumber", async (req, res) => {
    try {
        const repairing = await Repairing.findOne({
            repairingNumber: req.params.repairingNumber
        }).lean();

        if (!repairing) {
            return res.status(404).json({
                success: false,
                message: "Repairing not found"
            });
        }

        res.status(200).json({
            success: true,
            data: repairing
        });
    } catch (error) {
        console.error("Error fetching repairing:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch repairing",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/repairing/delete-repairing/:id - Hard delete + move to DeletedRepairing
// =============================================
router.delete("/delete-repairing/:id", async (req, res) => {
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

        const repairing = await Repairing.findOne({ repairingId: req.params.id });
        if (!repairing) {
            return res.status(404).json({
                success: false,
                message: "Repairing not found"
            });
        }

        // ✅ Copy to DeletedRepairing
        const deletedRepairing = new DeletedRepairing({
            originalRepairingId: repairing.repairingId,
            repairingNumber: repairing.repairingNumber,
            customerId: repairing.customerId,
            customerName: repairing.customerName,
            customerEmail: repairing.customerEmail,
            customerPhone: repairing.customerPhone,
            customerGstin: repairing.customerGstin,
            customerState: repairing.customerState,
            customerAddress: repairing.customerAddress,
            storeType: repairing.storeType,
            paymentStatus: repairing.paymentStatus,
            paymentType: repairing.paymentType,
            isGstMode: repairing.isGstMode,
            repairingDate: repairing.repairingDate,
            items: repairing.items,
            taxSlab: repairing.taxSlab,
            taxType: repairing.taxType,
            subtotal: repairing.subtotal,
            totalDiscount: repairing.totalDiscount,
            totalTax: repairing.totalTax,
            grandTotal: repairing.grandTotal,
            taxBreakdown: repairing.taxBreakdown,
            repairNotes: repairing.repairNotes,
            createdBy: repairing.createdBy,
            createdById: repairing.createdById,
            status: repairing.status,
            deletedBy: user.name,
            deletedById: user.userId,
            deletedAt: new Date(),
            deletedReason: req.body?.deletedReason || ''
        });

        await deletedRepairing.save();

        // ✅ HARD DELETE
        await Repairing.findOneAndDelete({ repairingId: req.params.id });

        res.status(200).json({
            success: true,
            message: "Repairing deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting repairing:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete repairing",
            error: error.message
        });
    }
});

// =============================================
// GET /api/repairing/get-customer-repairings/:customerId
// =============================================
router.get("/get-customer-repairings/:customerId", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { customerId: req.params.customerId };

        const total = await Repairing.countDocuments(filter);
        const repairings = await Repairing.find(filter)
            .sort({ repairingDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: repairings,
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
        console.error("Error fetching customer repairings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer repairings",
            error: error.message
        });
    }
});

module.exports = router;