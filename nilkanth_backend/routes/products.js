const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const Inventory = require("../models/inventory");


// Bulk Upload Products - FIXED VERSION
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

const createInventoryEntry = async (product) => {
    const inventoryEntry = new Inventory({
        productId: product.productId,
        productName: product.productName,
        productDescription: product.productDescription,
        minimumQty: product.minimumQty,
        hsnCode: product.hsnCode,
        units: product.units,
        priceHistory: [], // Empty initially
        totalQuantity: 0
    });

    await inventoryEntry.save();
    return inventoryEntry;
};

// Create Product
router.post("/create-product", async (req, res) => {
    try {
        const { productName } = req.body;

        // Check for existing product name
        const existingByName = await Product.findOne({ productName });
        if (existingByName) {
            return res.status(400).json({
                message: "Product with this name already exists",
                field: "productName"
            });
        }

        // Validate units field
        // In ALL routes (create, bulk-upload, update):
        const validUnits = ['NOS', 'METERS', 'KG', 'GRAM', 'LITRE', 'ML'];
        if (!validUnits.includes(req.body.units)) {
            return res.status(400).json({
                message: "Units must be either METERS, NUMBERS, LITRE, or KG",
                field: "units"
            });
        }

        // Create product with new fields only
        const product = new Product({
            productName: req.body.productName,
            productDescription: req.body.productDescription,
            minimumQty: Number(req.body.minimumQty),
            hsnCode: req.body.hsnCode,
            units: req.body.units
        });

        const savedProduct = await product.save();

        // Create inventory entry for the new product
        await createInventoryEntry(savedProduct);

        res.status(201).json(savedProduct.toObject());
    } catch (error) {
        console.error("Error saving product:", error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation error",
                error: error.message,
                field: Object.keys(error.errors)[0]
            });
        }

        res.status(500).json({
            message: "Error saving product",
            error: error.message
        });
    }
});




router.post("/bulk-upload-products", upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded",
                results: { successful: [], failed: [] }
            });
        }

        console.log("Processing file:", req.file.path);

        // Read the Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const products = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Found ${products.length} rows in file`);

        const results = { successful: [], failed: [] };
        // In ALL routes (create, bulk-upload, update):
        const validUnits = ['NOS', 'METERS', 'KG', 'GRAM', 'LITRE', 'ML'];

        // Process each row
        for (const [index, row] of products.entries()) {
            try {
                const rowNumber = index + 2; // +2 because Excel rows start at 1 and header is row 1

                // Get values from row (handle different column name formats)
                const productName = row['Product Name'] || row['productName'];
                const productDescription = row['Product Description'] || row['productDescription'];
                const minimumQty = row['Minimum Quantity'] || row['minimumQty'];
                const hsnCode = row['HSN Code'] || row['hsnCode'];
                const units = row['Units'] || row['units'];

                // Validate required fields
                if (!productName) {
                    results.failed.push({
                        row: rowNumber,
                        productName: 'N/A',
                        reason: "Missing product name",
                        field: "productName"
                    });
                    continue;
                }

                if (!productDescription) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Missing product description",
                        field: "productDescription"
                    });
                    continue;
                }

                if (minimumQty === undefined || minimumQty === null || minimumQty === '') {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Missing minimum quantity",
                        field: "minimumQty"
                    });
                    continue;
                }

                if (!hsnCode) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Missing HSN code",
                        field: "hsnCode"
                    });
                    continue;
                }

                if (!units) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Missing units",
                        field: "units"
                    });
                    continue;
                }

                // Validate units
                if (!validUnits.includes(units)) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: `Invalid units. Must be: ${validUnits.join(', ')}`,
                        field: "units"
                    });
                    continue;
                }

                // Check for existing product name
                const existingByName = await Product.findOne({ productName });
                if (existingByName) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Product with this name already exists",
                        field: "productName"
                    });
                    continue;
                }

                // Validate minimumQty is a number and not negative
                const minQtyNum = Number(minimumQty);
                if (isNaN(minQtyNum) || minQtyNum < 0) {
                    results.failed.push({
                        row: rowNumber,
                        productName,
                        reason: "Minimum quantity must be a positive number",
                        field: "minimumQty"
                    });
                    continue;
                }

                // Create product
                const cleanedData = {
                    productName: productName.toString().trim(),
                    productDescription: productDescription.toString().trim(),
                    minimumQty: minQtyNum,
                    hsnCode: hsnCode.toString().trim(),
                    units: units.toString().trim()
                };

                const product = new Product(cleanedData);
                const savedProduct = await product.save();

                // Create inventory entry
                await createInventoryEntry(savedProduct);

                results.successful.push({
                    product: savedProduct.toObject(),
                    message: "Successfully created"
                });

            } catch (error) {
                console.error(`Error processing row ${index + 2}:`, error);
                results.failed.push({
                    row: index + 2,
                    productName: row['Product Name'] || row['productName'] || 'Unknown',
                    reason: error.message || "Processing error",
                    field: "general"
                });
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        console.log(`Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`);

        res.status(200).json({
            message: `Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`,
            summary: {
                total: products.length,
                successful: results.successful.length,
                failed: results.failed.length
            },
            results
        });

    } catch (error) {
        console.error("Error in bulk upload:", error);

        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            message: "Error processing bulk upload",
            error: error.message,
            results: { successful: [], failed: [] }
        });
    }
});




// Update Product (Updated to sync with inventory)
router.put("/update-product/:productId", async (req, res) => {
    try {
        const { productId } = req.params;
        const { _id, createdAt, updatedAt, ...updateData } = req.body;

        // Validate units if provided
        if (updateData.units) {
            // In ALL routes (create, bulk-upload, update):
            const validUnits = ['NOS', 'METERS', 'KG', 'GRAM', 'LITRE', 'ML'];
            if (!validUnits.includes(updateData.units)) {
                return res.status(400).json({
                    message: "Units must be either METERS, NUMBERS, LITRE, or KG",
                    field: "units"
                });
            }
        }

        // Convert numeric fields
        if (updateData.minimumQty !== undefined) {
            updateData.minimumQty = Number(updateData.minimumQty);
            if (isNaN(updateData.minimumQty) || updateData.minimumQty < 0) {
                return res.status(400).json({
                    message: "Minimum quantity must be a positive number",
                    field: "minimumQty"
                });
            }
        }

        // Check if product name already exists (excluding current product)
        if (updateData.productName) {
            const existingProduct = await Product.findOne({
                productName: updateData.productName,
                productId: { $ne: productId }
            });

            if (existingProduct) {
                return res.status(400).json({
                    message: "Another product with this name already exists",
                    field: "productName"
                });
            }
        }

        // Update the product
        const updatedProduct = await Product.findOneAndUpdate(
            { productId: productId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // Update inventory with ALL new product fields (except priceHistory and batches)
        const inventoryUpdateData = {
            productName: updatedProduct.productName,
            productDescription: updatedProduct.productDescription,
            minimumQty: updatedProduct.minimumQty,
            hsnCode: updatedProduct.hsnCode,
            units: updatedProduct.units
            // ⚠️ IMPORTANT: priceHistory and batches are NOT updated here
        };

        await Inventory.findOneAndUpdate(
            { productId: productId },
            inventoryUpdateData
        );

        res.status(200).json(updatedProduct.toObject());
    } catch (error) {
        console.error("Error updating product:", error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation error",
                error: error.message,
                field: Object.keys(error.errors)[0]
            });
        }

        res.status(500).json({
            message: "Failed to update product",
            error: error.message
        });
    }
});


// Get All Products
router.get("/get-products", async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 });
        const plainProducts = products.map(product => product.toObject());
        res.status(200).json(plainProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({
            message: "Error fetching products",
            error: error.message
        });
    }
});



// Delete Product
router.delete("/delete-product/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findOneAndDelete({
            productId: req.params.id
        });

        if (!deletedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // Delete inventory entry as well
        await Inventory.findOneAndDelete({ productId: req.params.id });

        res.status(200).json({
            message: "Product and its inventory deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({
            message: "Failed to delete product",
            error: error.message
        });
    }
});

// Get product by ID
router.get("/get-product/:id", async (req, res) => {
    try {
        const product = await Product.findOne({ productId: req.params.id });

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json(product.toObject());
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({
            message: "Failed to fetch product",
            error: error.message
        });
    }
});

module.exports = router;