const express = require("express");
const router = express.Router();
const ItemInventory = require("../models/itemInventory");
const Item = require("../models/item");
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
// GET /api/item-inventory/get-all - Get all item inventory (with pagination)
// Query params: page, limit, search, storeType
// =============================================
router.get("/get-all", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const storeType = req.query.storeType || 'Vadodara';
        const skip = (page - 1) * limit;

        // Build search filter
        let filter = { storeType: storeType };

        if (search) {
            filter.$or = [
                { itemName: { $regex: search, $options: 'i' } },
                { itemDescription: { $regex: search, $options: 'i' } },
                { hsnCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const total = await ItemInventory.countDocuments(filter);

        // Get paginated data
        const inventory = await ItemInventory.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: inventory,
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
        console.error("Error fetching item inventory:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch item inventory",
            error: error.message
        });
    }
});

// =============================================
// GET /api/item-inventory/get/:itemId - Get specific item inventory
// =============================================
router.get("/get/:itemId", async (req, res) => {
    try {
        const { storeType } = req.query;
        let filter = { itemId: req.params.itemId };

        if (storeType) {
            filter.storeType = storeType;
        }

        const inventory = await ItemInventory.findOne(filter).lean();
        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Item inventory not found"
            });
        }
        res.status(200).json({
            success: true,
            data: inventory
        });
    } catch (error) {
        console.error("Error fetching item inventory:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch item inventory",
            error: error.message
        });
    }
});

// =============================================
// GET /api/item-inventory/export - Export all filtered data (NO pagination)
// =============================================
router.get("/export", async (req, res) => {
    try {
        const search = req.query.search || '';
        const storeType = req.query.storeType || 'Vadodara';

        // Build search filter
        let filter = { storeType: storeType };

        if (search) {
            filter.$or = [
                { itemName: { $regex: search, $options: 'i' } },
                { itemDescription: { $regex: search, $options: 'i' } },
                { hsnCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Get ALL data matching filter (no pagination)
        const inventory = await ItemInventory.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: inventory,
            total: inventory.length
        });
    } catch (error) {
        console.error("Error exporting item inventory:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export item inventory",
            error: error.message
        });
    }
});

// =============================================
// POST /api/item-inventory/add - Add quantity to item
// =============================================
router.post("/add", async (req, res) => {
    try {
        const { itemId, quantity, purchasePrice, date, notes, storeType } = req.body;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Item ID is required"
            });
        }
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid quantity is required"
            });
        }
        if (!storeType) {
            return res.status(400).json({
                success: false,
                message: "Store type is required"
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

        const item = await Item.findOne({ itemId });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        // ✅ Find or create inventory with storeType
        let inventory = await ItemInventory.findOne({
            itemId: itemId,
            storeType: storeType
        });

        if (!inventory) {
            inventory = new ItemInventory({
                itemId: item.itemId,
                itemName: item.itemName,
                itemDescription: item.itemDescription || '',
                hsnCode: item.hsnCode,
                unitId: item.unitId,
                unitName: item.unitName,
                storeType: storeType,
                totalQuantity: 0,
                addHistory: [],
                removeHistory: []
            });
        }

        await inventory.addQuantity(
            Number(quantity),
            Number(purchasePrice) || 0,
            user.name,
            user.userId,
            date || new Date(),
            notes || ''
        );

        res.status(200).json({
            success: true,
            message: "Quantity added successfully",
            data: inventory
        });

    } catch (error) {
        console.error("Error adding quantity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add quantity",
            error: error.message
        });
    }
});

// =============================================
// POST /api/item-inventory/remove - Remove quantity from item
// =============================================
router.post("/remove", async (req, res) => {
    try {
        const { itemId, quantity, date, reason, storeType } = req.body;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Item ID is required"
            });
        }
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid quantity is required"
            });
        }
        if (!storeType) {
            return res.status(400).json({
                success: false,
                message: "Store type is required"
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

        const inventory = await ItemInventory.findOne({
            itemId: itemId,
            storeType: storeType
        });

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Item inventory not found for this store"
            });
        }

        if (inventory.totalQuantity < Number(quantity)) {
            return res.status(400).json({
                success: false,
                message: `Insufficient quantity. Available: ${inventory.totalQuantity}, Requested: ${quantity}`
            });
        }

        await inventory.removeQuantity(
            Number(quantity),
            user.name,
            user.userId,
            date || new Date(),
            reason || ''
        );

        res.status(200).json({
            success: true,
            message: "Quantity removed successfully",
            data: inventory
        });

    } catch (error) {
        console.error("Error removing quantity:", error);
        if (error.message.includes("Insufficient quantity")) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to remove quantity",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/item-inventory/delete-add/:entryId - Delete add entry
// =============================================
router.delete("/delete-add/:entryId", async (req, res) => {
    try {
        const { entryId } = req.params;
        const { itemId, storeType } = req.query;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Item ID is required"
            });
        }
        if (!storeType) {
            return res.status(400).json({
                success: false,
                message: "Store type is required"
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

        const inventory = await ItemInventory.findOne({
            itemId: itemId,
            storeType: storeType
        });

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Item inventory not found"
            });
        }

        await inventory.deleteAddEntry(entryId, user.name);

        res.status(200).json({
            success: true,
            message: "Add entry deleted successfully",
            data: inventory
        });

    } catch (error) {
        console.error("Error deleting add entry:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete add entry",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/item-inventory/delete-remove/:entryId - Delete remove entry
// =============================================
router.delete("/delete-remove/:entryId", async (req, res) => {
    try {
        const { entryId } = req.params;
        const { itemId, storeType } = req.query;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Item ID is required"
            });
        }
        if (!storeType) {
            return res.status(400).json({
                success: false,
                message: "Store type is required"
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

        const inventory = await ItemInventory.findOne({
            itemId: itemId,
            storeType: storeType
        });

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Item inventory not found"
            });
        }

        await inventory.deleteRemoveEntry(entryId, user.name);

        res.status(200).json({
            success: true,
            message: "Remove entry deleted successfully",
            data: inventory
        });

    } catch (error) {
        console.error("Error deleting remove entry:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete remove entry",
            error: error.message
        });
    }
});

// =============================================
// GET /api/item-inventory/get-history/:itemId - Get full history of an item
// =============================================
router.get("/get-history/:itemId", async (req, res) => {
    try {
        const { storeType } = req.query;

        let filter = { itemId: req.params.itemId };
        if (storeType) {
            filter.storeType = storeType;
        }

        const inventory = await ItemInventory.findOne(filter);
        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Item inventory not found"
            });
        }

        const addHistory = inventory.addHistory
            .filter(entry => !entry.isDeleted)
            .map(entry => ({
                ...entry.toObject(),
                type: 'ADD',
                admin: entry.addedBy,
                price: entry.purchasePrice || 0,
                store: entry.entryStoreType || inventory.storeType
            }));

        const removeHistory = inventory.removeHistory
            .filter(entry => !entry.isDeleted)
            .map(entry => ({
                ...entry.toObject(),
                type: 'REMOVE',
                admin: entry.removedBy,
                price: 0,
                store: entry.entryStoreType || inventory.storeType
            }));

        const allHistory = [...addHistory, ...removeHistory]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            data: {
                itemId: inventory.itemId,
                itemName: inventory.itemName,
                storeType: inventory.storeType,
                totalQuantity: inventory.totalQuantity,
                averagePurchasePrice: inventory.averagePurchasePrice,
                history: allHistory
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