const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const ProductInventory = require("../models/productInventory");
const Unit = require("../models/unit");

// ===== HELPER: Create inventory for BOTH stores =====
const createProductInventoryForBothStores = async (product) => {
    const stores = ['Vadodara', 'Padra'];
    const results = [];

    for (const storeType of stores) {
        try {
            const existingInventory = await ProductInventory.findOne({
                productId: product.productId,
                storeType: storeType
            });

            if (!existingInventory) {
                const inventoryEntry = new ProductInventory({
                    productId: product.productId,
                    productName: product.productName,
                    productDescription: product.productDescription || '',
                    hsnCode: product.hsnCode,
                    unitId: product.unitId,
                    unitName: product.unitName,
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
// GET /api/products/get-products - Get all products (with pagination)
// =============================================
router.get("/get-products", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { productName: { $regex: search, $options: 'i' } },
                    { productDescription: { $regex: search, $options: 'i' } },
                    { hsnCode: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const total = await Product.countDocuments(filter);
        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            data: products,
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
        console.error("Error fetching products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products",
            error: error.message
        });
    }
});

// =============================================
// GET /api/products/export-products - Export all products (NO pagination)
// =============================================
router.get("/export-products", async (req, res) => {
    try {
        const search = req.query.search || '';

        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { productName: { $regex: search, $options: 'i' } },
                    { productDescription: { $regex: search, $options: 'i' } },
                    { hsnCode: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: products,
            total: products.length
        });
    } catch (error) {
        console.error("Error exporting products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export products",
            error: error.message
        });
    }
});

// =============================================
// GET /api/products/get-product/:id - Get product by ID
// =============================================
router.get("/get-product/:id", async (req, res) => {
    try {
        const product = await Product.findOne({ productId: req.params.id }).lean();
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product",
            error: error.message
        });
    }
});

// =============================================
// POST /api/products/create-product - Create new product
// =============================================
router.post("/create-product", async (req, res) => {
    try {
        const { productName, unitId } = req.body;

        if (!productName) {
            return res.status(400).json({
                success: false,
                message: "Product name is required",
                field: "productName"
            });
        }

        const existingProduct = await Product.findOne({ productName });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "Product with this name already exists",
                field: "productName"
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

        const product = new Product({
            productName,
            productDescription: req.body.productDescription || '',
            hsnCode: req.body.hsnCode,
            unitId: unit.unitId,
            unitName: unit.unitName
        });

        const savedProduct = await product.save();

        // ✅ FIX: Create inventory for BOTH stores
        const inventoryResults = await createProductInventoryForBothStores(savedProduct);

        res.status(201).json({
            success: true,
            message: "Product created successfully with inventory entries for both stores",
            data: savedProduct.toObject(),
            inventoryResults: inventoryResults
        });
    } catch (error) {
        console.error("Error creating product:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to create product",
            error: error.message
        });
    }
});

// =============================================
// PUT /api/products/update-product/:id - Update product
// =============================================
router.put("/update-product/:id", async (req, res) => {
    try {
        const { productId, _id, createdAt, updatedAt, ...updateData } = req.body;

        if (updateData.productName) {
            const existingProduct = await Product.findOne({
                productName: updateData.productName,
                productId: { $ne: req.params.id }
            });
            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Product with this name already exists",
                    field: "productName"
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

        const updatedProduct = await Product.findOneAndUpdate(
            { productId: req.params.id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // ✅ FIX: Update inventory for BOTH stores
        const inventoryUpdateData = {
            productName: updatedProduct.productName,
            productDescription: updatedProduct.productDescription,
            hsnCode: updatedProduct.hsnCode,
            unitId: updatedProduct.unitId,
            unitName: updatedProduct.unitName
        };

        await ProductInventory.updateMany(
            { productId: req.params.id },
            inventoryUpdateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Product and inventory updated successfully for both stores",
            data: updatedProduct.toObject()
        });
    } catch (error) {
        console.error("Error updating product:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/products/delete-product/:id - Delete product
// =============================================
router.delete("/delete-product/:id", async (req, res) => {
    try {
        // ✅ FIX: Check inventory for BOTH stores
        const inventories = await ProductInventory.find({ productId: req.params.id });
        const hasStock = inventories.some(inv => inv.totalQuantity > 0);

        if (hasStock) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete product. It has inventory stock in one or more stores."
            });
        }

        const deletedProduct = await Product.findOneAndDelete({ productId: req.params.id });
        if (!deletedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // ✅ FIX: Delete inventory for BOTH stores
        await ProductInventory.deleteMany({ productId: req.params.id });

        res.status(200).json({
            success: true,
            message: "Product and inventory deleted successfully from both stores"
        });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete product",
            error: error.message
        });
    }
});

module.exports = router;