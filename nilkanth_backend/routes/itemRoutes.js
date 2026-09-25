const express = require("express");
const router = express.Router();
const Item = require("../models/item");
const ItemInventory = require("../models/itemInventory");
const Unit = require("../models/unit");

// ===== HELPER: Create inventory for BOTH stores =====
const createItemInventoryForBothStores = async (item) => {
  const stores = ['Vadodara', 'Padra'];
  const results = [];

  for (const storeType of stores) {
    try {
      // Check if inventory already exists for this store
      const existingInventory = await ItemInventory.findOne({
        itemId: item.itemId,
        storeType: storeType
      });

      if (!existingInventory) {
        const inventoryEntry = new ItemInventory({
          itemId: item.itemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription || '',
          hsnCode: item.hsnCode,
          unitId: item.unitId,
          unitName: item.unitName,
          storeType: storeType,
          totalQuantity: 0,
          purchasePrice: 0,
          sellingPrice: 0,
          addHistory: [],
          removeHistory: []
        });

        await inventoryEntry.save();
        results.push({ storeType, success: true });
      } else {
        results.push({ storeType, success: true, existing: true });
      }
    } catch (error) {
      console.error(`Error creating inventory for store ${storeType}:`, error);
      results.push({ storeType, success: false, error: error.message });
    }
  }

  return results;
};

// =============================================
// GET /api/items/get-items - Get all items (with pagination)
// =============================================
router.get("/get-items", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { itemName: { $regex: search, $options: 'i' } },
          { itemDescription: { $regex: search, $options: 'i' } },
          { hsnCode: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: items,
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
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch items",
      error: error.message
    });
  }
});

// =============================================
// GET /api/items/export-items - Export all items (NO pagination)
// =============================================
router.get("/export-items", async (req, res) => {
  try {
    const search = req.query.search || '';

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { itemName: { $regex: search, $options: 'i' } },
          { itemDescription: { $regex: search, $options: 'i' } },
          { hsnCode: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (error) {
    console.error("Error exporting items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export items",
      error: error.message
    });
  }
});

// =============================================
// GET /api/items/get-item/:id - Get item by ID
// =============================================
router.get("/get-item/:id", async (req, res) => {
  try {
    const item = await Item.findOne({ itemId: req.params.id }).lean();
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item",
      error: error.message
    });
  }
});

// =============================================
// POST /api/items/create-item - Create new item
// =============================================
router.post("/create-item", async (req, res) => {
  try {
    const { itemName, unitId } = req.body;

    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
        field: "itemName"
      });
    }

    const existingItem = await Item.findOne({ itemName });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Item with this name already exists",
        field: "itemName"
      });
    }

    const unit = await Unit.findOne({ unitId });
    if (!unit) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit selected",
        field: "unitId"
      });
    }

    const item = new Item({
      itemName,
      itemDescription: req.body.itemDescription || '',
      hsnCode: req.body.hsnCode,
      unitId: unit.unitId,
      unitName: unit.unitName
    });

    const savedItem = await item.save();

    // ✅ FIX: Create inventory for BOTH stores
    const inventoryResults = await createItemInventoryForBothStores(savedItem);

    res.status(201).json({
      success: true,
      message: "Item created successfully with inventory entries for both stores",
      data: savedItem.toObject(),
      inventoryResults: inventoryResults
    });
  } catch (error) {
    console.error("Error creating item:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create item",
      error: error.message
    });
  }
});

// =============================================
// PUT /api/items/update-item/:id - Update item
// =============================================
router.put("/update-item/:id", async (req, res) => {
  try {
    const { itemId, _id, createdAt, updatedAt, ...updateData } = req.body;

    if (updateData.itemName) {
      const existingItem = await Item.findOne({
        itemName: updateData.itemName,
        itemId: { $ne: req.params.id }
      });
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: "Item with this name already exists",
          field: "itemName"
        });
      }
    }

    if (updateData.unitId) {
      const unit = await Unit.findOne({ unitId: updateData.unitId });
      if (!unit) {
        return res.status(400).json({
          success: false,
          message: "Invalid unit selected",
          field: "unitId"
        });
      }
      updateData.unitName = unit.unitName;
    }

    const updatedItem = await Item.findOneAndUpdate(
      { itemId: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // ✅ FIX: Update inventory for BOTH stores
    const inventoryUpdateData = {
      itemName: updatedItem.itemName,
      itemDescription: updatedItem.itemDescription,
      hsnCode: updatedItem.hsnCode,
      unitId: updatedItem.unitId,
      unitName: updatedItem.unitName
    };

    await ItemInventory.updateMany(
      { itemId: req.params.id },
      inventoryUpdateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Item and inventory updated successfully for both stores",
      data: updatedItem.toObject()
    });
  } catch (error) {
    console.error("Error updating item:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update item",
      error: error.message
    });
  }
});

// =============================================
// DELETE /api/items/delete-item/:id - Delete item
// =============================================
router.delete("/delete-item/:id", async (req, res) => {
  try {
    // ✅ FIX: Check inventory for BOTH stores
    const inventories = await ItemInventory.find({ itemId: req.params.id });
    const hasStock = inventories.some(inv => inv.totalQuantity > 0);

    if (hasStock) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete item. It has inventory stock in one or more stores."
      });
    }

    const deletedItem = await Item.findOneAndDelete({ itemId: req.params.id });
    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // ✅ FIX: Delete inventory for BOTH stores
    await ItemInventory.deleteMany({ itemId: req.params.id });

    res.status(200).json({
      success: true,
      message: "Item and inventory deleted successfully from both stores"
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete item",
      error: error.message
    });
  }
});

module.exports = router;