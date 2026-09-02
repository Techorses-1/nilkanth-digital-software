const express = require("express");
const router = express.Router();
const ProductPurchase = require("../models/productPurchase");
const Product = require("../models/product");
const Vendor = require("../models/vendor");
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

// =============================================
// GET /api/product-purchase/get-all - Get all product purchases (with pagination)
// Query params: page, limit, search, storeType
// =============================================
router.get("/get-all", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const storeType = req.query.storeType || 'Vadodara';
        const skip = (page - 1) * limit;

        let filter = { storeType: storeType };

        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { productDescription: { $regex: search, $options: 'i' } },
                { productHsnCode: { $regex: search, $options: 'i' } },
                { 'purchaseHistory.vendorName': { $regex: search, $options: 'i' } }
            ];
        }

        const total = await ProductPurchase.countDocuments(filter);
        const purchases = await ProductPurchase.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: purchases,
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
        console.error("Error fetching product purchases:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product purchases",
            error: error.message
        });
    }
});

// =============================================
// GET /api/product-purchase/export - Export all product purchases (NO pagination)
// =============================================
router.get("/export", async (req, res) => {
    try {
        const search = req.query.search || '';
        const storeType = req.query.storeType || 'Vadodara';

        let filter = { storeType: storeType };

        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { productDescription: { $regex: search, $options: 'i' } },
                { productHsnCode: { $regex: search, $options: 'i' } },
                { 'purchaseHistory.vendorName': { $regex: search, $options: 'i' } }
            ];
        }

        const purchases = await ProductPurchase.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: purchases,
            total: purchases.length
        });
    } catch (error) {
        console.error("Error exporting product purchases:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export product purchases",
            error: error.message
        });
    }
});

// =============================================
// GET /api/product-purchase/get/:purchaseId - Get single purchase
// =============================================
router.get("/get/:purchaseId", async (req, res) => {
    try {
        const purchase = await ProductPurchase.findOne({ purchaseId: req.params.purchaseId }).lean();
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }
        res.status(200).json({
            success: true,
            data: purchase
        });
    } catch (error) {
        console.error("Error fetching purchase:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch purchase",
            error: error.message
        });
    }
});

// =============================================
// POST /api/product-purchase/add - Add purchase entry
// =============================================
router.post("/add", async (req, res) => {
    try {
        const { productId, vendorId, quantity, purchasePrice, storeType } = req.body;

        // Validation
        if (!productId || !vendorId || !quantity) {
            return res.status(400).json({
                success: false,
                message: "Product, Vendor, and Quantity are required"
            });
        }

        // Get user from token
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

        // Get vendor details
        const vendor = await Vendor.findOne({ vendorId });
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        // Get product details
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if purchase document exists
        let purchase = await ProductPurchase.findOne({
            productId: productId,
            storeType: storeType || 'Vadodara'
        });

        if (purchase) {
            await purchase.addPurchaseEntry(
                vendorId,
                vendor.vendorName || vendor.companyName || 'Unknown Vendor',
                Number(quantity),
                Number(purchasePrice) || 0,
                user.name,
                user.userId
            );

            res.status(200).json({
                success: true,
                message: "Purchase entry added successfully",
                data: purchase
            });
        } else {
            const newPurchase = new ProductPurchase({
                storeType: storeType || 'Vadodara',
                productId: product.productId,
                productName: product.productName,
                productDescription: product.productDescription || '',
                productHsnCode: product.hsnCode,
                productUnitId: product.unitId,
                productUnitName: product.unitName,
                purchaseHistory: [{
                    vendorId: vendorId,
                    vendorName: vendor.vendorName || vendor.companyName || 'Unknown Vendor',
                    quantity: Number(quantity),
                    purchasePrice: Number(purchasePrice) || 0,
                    addedBy: user.name,
                    addedById: user.userId,
                    addedAt: new Date()
                }]
            });

            const savedPurchase = await newPurchase.save();

            res.status(201).json({
                success: true,
                message: "Purchase created successfully",
                data: savedPurchase
            });
        }

    } catch (error) {
        console.error("Error adding purchase:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add purchase",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/product-purchase/delete-entry/:purchaseId/:entryId - Delete entry
// =============================================
router.delete("/delete-entry/:purchaseId/:entryId", async (req, res) => {
    try {
        const { purchaseId, entryId } = req.params;

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

        const purchase = await ProductPurchase.findOne({ purchaseId });
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        await purchase.deleteEntry(entryId, user.name);

        res.status(200).json({
            success: true,
            message: "Entry deleted successfully",
            data: purchase
        });

    } catch (error) {
        console.error("Error deleting entry:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete entry",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/product-purchase/delete-purchase/:purchaseId - Delete entire purchase
// =============================================
router.delete("/delete-purchase/:purchaseId", async (req, res) => {
    try {
        const { purchaseId } = req.params;

        const decoded = getUserFromToken(req);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const purchase = await ProductPurchase.findOneAndDelete({ purchaseId });
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Purchase deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting purchase:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete purchase",
            error: error.message
        });
    }
});

// =============================================
// GET /api/product-purchase/get-history/:purchaseId - Get purchase history
// =============================================
router.get("/get-history/:purchaseId", async (req, res) => {
    try {
        const purchase = await ProductPurchase.findOne({ purchaseId: req.params.purchaseId }).lean();
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const activeHistory = purchase.purchaseHistory.filter(e => !e.isDeleted);

        res.status(200).json({
            success: true,
            data: {
                purchaseId: purchase.purchaseId,
                productName: purchase.productName,
                storeType: purchase.storeType,
                totalQuantity: purchase.totalQuantity,
                averagePurchasePrice: purchase.averagePurchasePrice,
                history: activeHistory
            }
        });

    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch history",
            error: error.message
        });
    }
});

module.exports = router;