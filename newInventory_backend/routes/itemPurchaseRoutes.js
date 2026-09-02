const express = require("express");
const router = express.Router();
const ItemPurchase = require("../models/itemPurchase");
const Item = require("../models/item");
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
// GET /api/item-purchase/get-all - Get all item purchases (with pagination)
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
                { itemName: { $regex: search, $options: 'i' } },
                { itemDescription: { $regex: search, $options: 'i' } },
                { itemHsnCode: { $regex: search, $options: 'i' } },
                { 'purchaseHistory.vendorName': { $regex: search, $options: 'i' } }
            ];
        }

        const total = await ItemPurchase.countDocuments(filter);
        const purchases = await ItemPurchase.find(filter)
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
        console.error("Error fetching item purchases:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch item purchases",
            error: error.message
        });
    }
});

// =============================================
// GET /api/item-purchase/export - Export all item purchases (NO pagination)
// =============================================
router.get("/export", async (req, res) => {
    try {
        const search = req.query.search || '';
        const storeType = req.query.storeType || 'Vadodara';

        let filter = { storeType: storeType };

        if (search) {
            filter.$or = [
                { itemName: { $regex: search, $options: 'i' } },
                { itemDescription: { $regex: search, $options: 'i' } },
                { itemHsnCode: { $regex: search, $options: 'i' } },
                { 'purchaseHistory.vendorName': { $regex: search, $options: 'i' } }
            ];
        }

        const purchases = await ItemPurchase.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: purchases,
            total: purchases.length
        });
    } catch (error) {
        console.error("Error exporting item purchases:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export item purchases",
            error: error.message
        });
    }
});

// =============================================
// GET /api/item-purchase/get/:purchaseId - Get single purchase
// =============================================
router.get("/get/:purchaseId", async (req, res) => {
    try {
        const purchase = await ItemPurchase.findOne({ purchaseId: req.params.purchaseId }).lean();
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
// POST /api/item-purchase/add - Add purchase entry
// =============================================
router.post("/add", async (req, res) => {
    try {
        const { itemId, vendorId, quantity, purchasePrice, storeType } = req.body;

        // Validation
        if (!itemId || !vendorId || !quantity) {
            return res.status(400).json({
                success: false,
                message: "Item, Vendor, and Quantity are required"
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

        // Get item details
        const item = await Item.findOne({ itemId });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        // Check if purchase document exists
        let purchase = await ItemPurchase.findOne({
            itemId: itemId,
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
            const newPurchase = new ItemPurchase({
                storeType: storeType || 'Vadodara',
                itemId: item.itemId,
                itemName: item.itemName,
                itemDescription: item.itemDescription || '',
                itemHsnCode: item.hsnCode,
                itemUnitId: item.unitId,
                itemUnitName: item.unitName,
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
// DELETE /api/item-purchase/delete-entry/:purchaseId/:entryId - Delete entry
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

        const purchase = await ItemPurchase.findOne({ purchaseId });
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
// DELETE /api/item-purchase/delete-purchase/:purchaseId - Delete entire purchase
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

        const purchase = await ItemPurchase.findOneAndDelete({ purchaseId });
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
// GET /api/item-purchase/get-history/:purchaseId - Get purchase history
// =============================================
router.get("/get-history/:purchaseId", async (req, res) => {
    try {
        const purchase = await ItemPurchase.findOne({ purchaseId: req.params.purchaseId }).lean();
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
                itemName: purchase.itemName,
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