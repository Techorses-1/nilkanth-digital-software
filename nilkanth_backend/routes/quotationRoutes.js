const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotation");
const DeletedQuotation = require("../models/deletedQuotation");
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

// ===== HELPER: Generate Quotation Number (No gaps, reuse latest deleted) =====
const generateQuotationNumber = async () => {
    const year = new Date().getFullYear();
    const fullPrefix = `QTN${year}`;

    // Get all active quotations for this year
    const activeQuotations = await Quotation.find({
        quotationNumber: { $regex: `^${fullPrefix}` }
    }).select('quotationNumber').lean();

    // Get all deleted quotations for this year
    const deletedQuotations = await DeletedQuotation.find({
        quotationNumber: { $regex: `^${fullPrefix}` }
    }).select('quotationNumber').lean();

    // Combine both (active + deleted) to find all used numbers
    const allNumbers = [
        ...activeQuotations.map(q => parseInt(q.quotationNumber.replace(fullPrefix, '')) || 0),
        ...deletedQuotations.map(q => parseInt(q.quotationNumber.replace(fullPrefix, '')) || 0)
    ].filter(n => n > 0);

    let nextNumber;

    if (allNumbers.length === 0) {
        nextNumber = 1;
    } else {
        const activeNumbers = activeQuotations
            .map(q => parseInt(q.quotationNumber.replace(fullPrefix, '')) || 0)
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

// =============================================
// POST /api/quotation/create-quotation - Create new quotation
// =============================================
router.post("/create-quotation", async (req, res) => {
    try {
        console.log("🚀 ===== CREATE QUOTATION START =====");

        const {
            customerId,
            storeType,
            quotationDate,
            items,
            notes,
            customerGstin,
            customerState
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
        const quotationNumber = await generateQuotationNumber();

        const newQuotation = new Quotation({
            quotationNumber,
            customerId: customer.customerId,
            customerName: customer.customerName,
            customerEmail: customer.email || '',
            customerPhone: customer.contactNumber || '',
            customerGstin: gstin,
            customerState: customerState || '',
            customerAddress: customer.address || '',
            storeType: storeType || 'Vadodara',
            quotationDate: quotationDate || new Date(),
            items: processedItems,
            notes: notes || '',
            createdBy: user.name,
            createdById: user.userId,
            status: 'Completed'
        });

        newQuotation.recalculateTotals();
        const savedQuotation = await newQuotation.save();

        console.log("✅ QUOTATION SAVED:", savedQuotation.quotationNumber);

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: savedQuotation,
            quotationNumber: quotationNumber
        });

    } catch (error) {
        console.error("❌ ERROR creating quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create quotation",
            error: error.message
        });
    }
});


// =============================================
// PUT /api/quotation/update-quotation/:id - Update quotation
// =============================================
router.put("/update-quotation/:id", async (req, res) => {
    try {
        const { quotationId, _id, createdAt, updatedAt, quotationNumber, ...updateData } = req.body;

        const decoded = getUserFromToken(req);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const existingQuotation = await Quotation.findOne({ quotationId: req.params.id });
        if (!existingQuotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        // ===== PROCESS ITEMS =====
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

        // GSTIN Processing
        if (!updateData.customerGstin || updateData.customerGstin.trim() === '') {
            updateData.customerGstin = existingQuotation.customerGstin || '';
        }

        const tempQuotation = new Quotation({
            ...existingQuotation.toObject(),
            ...updateData,
            quotationId: existingQuotation.quotationId,
            quotationNumber: existingQuotation.quotationNumber
        });

        tempQuotation.recalculateTotals();

        const finalUpdateData = {
            ...updateData,
            items: tempQuotation.items,
            subtotal: tempQuotation.subtotal,
            totalDiscount: tempQuotation.totalDiscount,
            grandTotal: tempQuotation.grandTotal
        };

        const updatedQuotation = await Quotation.findOneAndUpdate(
            { quotationId: req.params.id },
            finalUpdateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Quotation updated successfully",
            data: updatedQuotation
        });

    } catch (error) {
        console.error("❌ ERROR updating quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update quotation",
            error: error.message
        });
    }
});


// =============================================
// GET /api/quotation/get-quotations - Get all quotations (with pagination + search)
// =============================================
router.get("/get-quotations", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        let filter = {};

        if (search) {
            filter.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerEmail: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { 'items.uniqueNumbers.number': { $regex: search, $options: 'i' } }
            ];
        }

        const total = await Quotation.countDocuments(filter);
        const quotations = await Quotation.find(filter)
            .sort({ quotationDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: quotations,
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
        console.error("Error fetching quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotations",
            error: error.message
        });
    }
});

// =============================================
// GET /api/quotation/export-quotations - Export all quotations (with search)
// =============================================
router.get("/export-quotations", async (req, res) => {
    try {
        const search = req.query.search || '';

        let filter = {};

        if (search) {
            filter.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerEmail: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } }
            ];
        }

        const quotations = await Quotation.find(filter)
            .sort({ quotationDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: quotations,
            total: quotations.length
        });
    } catch (error) {
        console.error("Error exporting quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export quotations",
            error: error.message
        });
    }
});

// =============================================
// GET /api/quotation/get-all-filtered - Get ALL filtered quotations (for PDF export)
// =============================================
router.get("/get-all-filtered", async (req, res) => {
    try {
        const search = req.query.search || '';

        let filter = {};

        if (search) {
            filter.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerEmail: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } }
            ];
        }

        const quotations = await Quotation.find(filter)
            .sort({ quotationDate: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: quotations,
            total: quotations.length
        });
    } catch (error) {
        console.error("Error fetching all filtered quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch filtered quotations",
            error: error.message
        });
    }
});

// =============================================
// GET /api/quotation/get-quotation/:id - Get quotation by ID
// =============================================
router.get("/get-quotation/:id", async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ quotationId: req.params.id }).lean();

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        res.status(200).json({
            success: true,
            data: quotation
        });
    } catch (error) {
        console.error("Error fetching quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotation",
            error: error.message
        });
    }
});

// =============================================
// GET /api/quotation/get-quotation-by-number/:quotationNumber
// =============================================
router.get("/get-quotation-by-number/:quotationNumber", async (req, res) => {
    try {
        const quotation = await Quotation.findOne({
            quotationNumber: req.params.quotationNumber
        }).lean();

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        res.status(200).json({
            success: true,
            data: quotation
        });
    } catch (error) {
        console.error("Error fetching quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotation",
            error: error.message
        });
    }
});


// =============================================
// DELETE /api/quotation/delete-quotation/:id - HARD DELETE + Move to DeletedQuotation
// =============================================
router.delete("/delete-quotation/:id", async (req, res) => {
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

        const quotation = await Quotation.findOne({ quotationId: req.params.id });
        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        // ✅ Copy to DeletedQuotation
        const deletedQuotation = new DeletedQuotation({
            originalQuotationId: quotation.quotationId,
            quotationNumber: quotation.quotationNumber,
            customerId: quotation.customerId,
            customerName: quotation.customerName,
            customerEmail: quotation.customerEmail,
            customerPhone: quotation.customerPhone,
            customerGstin: quotation.customerGstin,
            customerState: quotation.customerState,
            customerAddress: quotation.customerAddress,
            storeType: quotation.storeType,
            quotationDate: quotation.quotationDate,
            items: quotation.items,
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            grandTotal: quotation.grandTotal,
            notes: quotation.notes,
            createdBy: quotation.createdBy,
            createdById: quotation.createdById,
            status: quotation.status,
            deletedBy: user.name,
            deletedById: user.userId,
            deletedAt: new Date(),
            deletedReason: req.body?.deletedReason || ''
        });

        await deletedQuotation.save();

        // ✅ HARD DELETE from Quotation
        await Quotation.findOneAndDelete({ quotationId: req.params.id });

        res.status(200).json({
            success: true,
            message: "Quotation deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete quotation",
            error: error.message
        });
    }
});

// =============================================
// GET /api/quotation/get-customer-quotations/:customerId
// =============================================
router.get("/get-customer-quotations/:customerId", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {
            customerId: req.params.customerId
        };

        const total = await Quotation.countDocuments(filter);
        const quotations = await Quotation.find(filter)
            .sort({ quotationDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: quotations,
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
        console.error("Error fetching customer quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer quotations",
            error: error.message
        });
    }
});

module.exports = router;