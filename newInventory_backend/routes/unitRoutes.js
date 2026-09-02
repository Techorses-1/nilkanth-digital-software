const express = require("express");
const router = express.Router();
const Unit = require("../models/unit");

// POST /api/units/create-unit - Create new unit
router.post("/create-unit", async (req, res) => {
    try {
        const { unitName } = req.body;

        const existingUnit = await Unit.findOne({ unitName: unitName.toUpperCase() });
        if (existingUnit) {
            return res.status(400).json({
                success: false,
                message: "Unit with this name already exists",
                field: "unitName"
            });
        }

        const unit = new Unit({
            unitName: unitName.toUpperCase(),
            unitDescription: req.body.unitDescription || ''
        });

        const savedUnit = await unit.save();

        res.status(201).json({
            success: true,
            message: "Unit created successfully",
            data: savedUnit.toObject()
        });
    } catch (error) {
        console.error("Error creating unit:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to create unit",
            error: error.message
        });
    }
});

// GET /api/units/get-units - Get all units (with pagination)
router.get("/get-units", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Build search filter
        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { unitName: { $regex: search, $options: 'i' } },
                    { unitDescription: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get total count for pagination
        const total = await Unit.countDocuments(filter);

        // Get paginated data
        const units = await Unit.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: units,
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
        console.error("Error fetching units:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch units",
            error: error.message
        });
    }
});

// GET /api/units/export-units - Export all units (NO pagination)
router.get("/export-units", async (req, res) => {
    try {
        const search = req.query.search || '';

        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { unitName: { $regex: search, $options: 'i' } },
                    { unitDescription: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const units = await Unit.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: units,
            total: units.length
        });
    } catch (error) {
        console.error("Error exporting units:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export units",
            error: error.message
        });
    }
});

// PUT /api/units/update-unit/:id - Update unit
router.put("/update-unit/:id", async (req, res) => {
    try {
        const { unitId, _id, createdAt, updatedAt, ...updateData } = req.body;

        if (updateData.unitName) {
            const existingUnit = await Unit.findOne({
                unitName: updateData.unitName.toUpperCase(),
                unitId: { $ne: req.params.id }
            });
            if (existingUnit) {
                return res.status(400).json({
                    success: false,
                    message: "Unit with this name already exists",
                    field: "unitName"
                });
            }
            updateData.unitName = updateData.unitName.toUpperCase();
        }

        const updatedUnit = await Unit.findOneAndUpdate(
            { unitId: req.params.id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedUnit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Unit updated successfully",
            data: updatedUnit.toObject()
        });
    } catch (error) {
        console.error("Error updating unit:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to update unit",
            error: error.message
        });
    }
});

// DELETE /api/units/delete-unit/:id - Delete unit
router.delete("/delete-unit/:id", async (req, res) => {
    try {
        const Item = require("../models/item");
        const Product = require("../models/product");

        const itemUsingUnit = await Item.findOne({ unitId: req.params.id });
        const productUsingUnit = await Product.findOne({ unitId: req.params.id });

        if (itemUsingUnit || productUsingUnit) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete unit. It is being used by items or products."
            });
        }

        const deletedUnit = await Unit.findOneAndDelete({ unitId: req.params.id });

        if (!deletedUnit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Unit deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting unit:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete unit",
            error: error.message
        });
    }
});

// GET /api/units/get-unit/:id - Get unit by ID
router.get("/get-unit/:id", async (req, res) => {
    try {
        const unit = await Unit.findOne({ unitId: req.params.id });
        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }
        res.status(200).json({
            success: true,
            data: unit.toObject()
        });
    } catch (error) {
        console.error("Error fetching unit:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unit",
            error: error.message
        });
    }
});

module.exports = router;