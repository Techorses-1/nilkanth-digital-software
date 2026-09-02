const express = require("express");
const router = express.Router();
const Inventory = require("../models/inventory");
const Product = require("../models/product");
const ProductDisposal = require("../models/ProductDisposal");
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// Helper function to create inventory entry for new product


// Get all inventory with product details and movement info
router.get("/get-inventory", async (req, res) => {
    try {
        const inventory = await Inventory.find({}).sort({ createdAt: -1 });

        // Enrich with product details and calculate status based on minQty
        const enrichedInventory = await Promise.all(
            inventory.map(async (item) => {
                const product = await Product.findOne({ productId: item.productId });

                // Calculate status based on minimum quantity
                let status = "In Stock";
                if (item.totalQuantity === 0) {
                    status = "Out of Stock";
                } else if (item.totalQuantity <= (product?.minimumQty || 0)) {
                    status = "Low Stock";
                }

                return {
                    inventoryId: item.inventoryId,
                    productId: item.productId,
                    productName: item.productName,
                    productDescription: item.productDescription,
                    minimumQty: product?.minimumQty || item.minimumQty,
                    hsnCode: item.hsnCode,
                    units: item.units,
                    averagePrice: item.averagePrice,
                    averageSellingPrice: item.averageSellingPrice,    // NEW
                    totalQuantity: item.totalQuantity,
                    totalOutwardValue: item.totalOutwardValue,        // NEW
                    // priceHistory with all fields
                    priceHistory: item.priceHistory ? item.priceHistory.map(ph => ({
                        price: ph.price,
                        quantityAdded: ph.quantityAdded,
                        addedAt: ph.addedAt,
                        purchaseDate: ph.purchaseDate
                    })) : [],
                    // outwardHistory with ALL fields including price - UPDATED
                    outwardHistory: item.outwardHistory ? item.outwardHistory.map(oh => ({
                        quantity: oh.quantity,
                        price: oh.price,                              // NEW - price added
                        outwardDate: oh.outwardDate,
                        issueDate: oh.issueDate,
                        issuedTo: oh.issuedTo
                    })) : [],
                    totalOutward: item.totalOutward,
                    status: status,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                };
            })
        );

        res.status(200).json({
            success: true,
            data: enrichedInventory
        });
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch inventory data",
            error: error.message
        });
    }
});

// ============================================
// UPDATED ADD QUANTITY ROUTE - WITH PURCHASE DATE
// ============================================
router.post("/add-quantity", async (req, res) => {
    try {
        console.log("🔍 ADD-QUANTITY REQUEST:", req.body);

        const { productId, quantity, price, purchaseDate } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid quantity is required (must be greater than 0)"
            });
        }

        if (!price || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid purchase price is required (must be greater than 0)"
            });
        }

        if (!purchaseDate) {
            return res.status(400).json({
                success: false,
                message: "Purchase date is required"
            });
        }

        // Find the product
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        console.log("✅ Product found:", product.productName);

        // Find or create inventory entry
        let inventoryItem = await Inventory.findOne({ productId });

        if (!inventoryItem) {
            // Create new inventory entry with product details
            inventoryItem = new Inventory({
                productId: product.productId,
                productName: product.productName,
                productDescription: product.productDescription,
                minimumQty: product.minimumQty,
                hsnCode: product.hsnCode,
                units: product.units,
                priceHistory: []
            });
            console.log("📦 Created new inventory entry");
        }

        // Add to price history with purchase date
        inventoryItem.priceHistory.push({
            price: parseFloat(price),
            quantityAdded: parseInt(quantity),
            purchaseDate: new Date(purchaseDate), // User selected date
            addedAt: new Date() // Auto timestamp for debugging
        });

        // Save (totalQuantity will be auto-updated by pre-save hook)
        await inventoryItem.save();

        console.log("✅ Quantity added successfully");
        console.log(`   Added: ${quantity} units @ ₹${price}`);
        console.log(`   Purchase Date: ${new Date(purchaseDate).toLocaleDateString()}`);
        console.log(`   New total quantity: ${inventoryItem.totalQuantity}`);
        console.log(`   Average price: ₹${inventoryItem.averagePrice}`);

        res.status(200).json({
            success: true,
            message: `Successfully added ${quantity} ${product.units} to inventory`,
            data: {
                inventoryId: inventoryItem.inventoryId,
                productName: inventoryItem.productName,
                quantityAdded: parseInt(quantity),
                price: parseFloat(price),
                purchaseDate: purchaseDate,
                newTotalQuantity: inventoryItem.totalQuantity,
                averagePrice: inventoryItem.averagePrice
            }
        });

    } catch (error) {
        console.error("💥 Error adding quantity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add quantity",
            error: error.message
        });
    }
});

// Bulk upload quantities from Excel - UPDATED WITH DATE
router.post("/bulk-upload-quantities", upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        console.log("Processing uploaded file:", req.file.path);

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Found ${data.length} rows in file`);

        let successful = 0;
        let failed = 0;
        const errors = [];

        // Get all products for validation
        const allProducts = await Product.find({});

        for (const [index, row] of data.entries()) {
            try {
                const rowNumber = index + 2;

                // Read columns with different possible names
                const productName = row['Product Name'] || row['productName'] || row['Product'] || row['product'];
                const quantity = row['Quantity'] || row['quantity'] || row['Qty'] || row['qty'];
                const price = row['Price'] || row['price'] || row['Cost'] || row['cost'];

                // NEW: Read purchase date column
                let purchaseDate = row['Purchase Date'] || row['purchaseDate'] || row['Date'] || row['date'];

                console.log(`Processing row ${rowNumber}:`, { productName, quantity, price, purchaseDate });

                // Validate required fields
                if (!productName) {
                    errors.push({
                        rowNumber,
                        message: "Missing product name",
                        details: "Product Name column is required"
                    });
                    failed++;
                    continue;
                }

                if (!quantity) {
                    errors.push({
                        rowNumber,
                        productName,
                        message: "Missing quantity",
                        details: "Quantity column is required"
                    });
                    failed++;
                    continue;
                }

                if (!price) {
                    errors.push({
                        rowNumber,
                        productName,
                        message: "Missing price",
                        details: "Price column is required"
                    });
                    failed++;
                    continue;
                }

                // Validate quantity is a positive number
                const qtyNum = Number(quantity);
                if (isNaN(qtyNum) || qtyNum <= 0) {
                    errors.push({
                        rowNumber,
                        productName,
                        message: "Invalid quantity",
                        details: `Quantity must be a positive number, got: ${quantity}`
                    });
                    failed++;
                    continue;
                }

                // Validate price is a positive number
                const priceNum = Number(price);
                if (isNaN(priceNum) || priceNum <= 0) {
                    errors.push({
                        rowNumber,
                        productName,
                        message: "Invalid price",
                        details: `Price must be a positive number, got: ${price}`
                    });
                    failed++;
                    continue;
                }

                // Handle purchase date - if not provided, use today's date
                let purchaseDateObj;
                if (purchaseDate) {
                    // Try to parse the date
                    if (typeof purchaseDate === 'number') {
                        // Excel serial date
                        purchaseDateObj = XLSX.SSF.parse_date_code(purchaseDate);
                        purchaseDateObj = new Date(purchaseDateObj.y, purchaseDateObj.m - 1, purchaseDateObj.d);
                    } else {
                        // Try to parse string date
                        purchaseDateObj = new Date(purchaseDate);
                    }

                    // Check if date is valid
                    if (isNaN(purchaseDateObj.getTime())) {
                        errors.push({
                            rowNumber,
                            productName,
                            message: "Invalid purchase date",
                            details: `Using today's date instead. Invalid format: ${purchaseDate}`
                        });
                        purchaseDateObj = new Date(); // Fallback to today
                    }
                } else {
                    purchaseDateObj = new Date(); // Default to today if not provided
                }

                // Find product
                const product = allProducts.find(p =>
                    p.productName.trim().toLowerCase() === productName.trim().toLowerCase()
                );

                if (!product) {
                    errors.push({
                        rowNumber,
                        productName,
                        message: "Product not found",
                        details: `Product "${productName}" does not exist in the system`
                    });
                    failed++;
                    continue;
                }

                // Find or create inventory
                let inventoryItem = await Inventory.findOne({ productId: product.productId });

                if (!inventoryItem) {
                    inventoryItem = new Inventory({
                        productId: product.productId,
                        productName: product.productName,
                        productDescription: product.productDescription,
                        minimumQty: product.minimumQty,
                        hsnCode: product.hsnCode,
                        units: product.units,
                        priceHistory: []
                    });
                }

                // Add to price history with purchase date
                inventoryItem.priceHistory.push({
                    price: priceNum,
                    quantityAdded: qtyNum,
                    purchaseDate: purchaseDateObj, // Use the date from Excel or today
                    addedAt: new Date() // Auto timestamp
                });

                await inventoryItem.save();
                successful++;
                console.log(`✅ Added ${qtyNum} units of ${product.productName} @ ₹${priceNum} on ${purchaseDateObj.toLocaleDateString()}`);

            } catch (error) {
                console.error(`Error processing row ${index + 2}:`, error);
                errors.push({
                    rowNumber: index + 2,
                    productName: row['Product Name'] || 'Unknown',
                    message: "Processing error",
                    details: error.message
                });
                failed++;
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        console.log(`Bulk upload completed. Successful: ${successful}, Failed: ${failed}`);

        res.status(200).json({
            success: true,
            message: `Bulk upload completed. Added: ${successful}, Failed: ${failed}`,
            summary: {
                total: data.length,
                successful,
                failed
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Error in bulk upload:", error);

        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: "Failed to process bulk upload",
            error: error.message
        });
    }
});

// DISPOSE PRODUCT - Keep as is (but update to work without batches)
router.post("/dispose-product", async (req, res) => {
    try {
        const { productId, quantity, reason, disposalDate } = req.body;

        if (!productId || !quantity || !reason) {
            return res.status(400).json({
                success: false,
                message: "Product ID, quantity, and reason are required"
            });
        }

        // Find the product
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const inventoryItem = await Inventory.findOne({ productId });
        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found"
            });
        }

        // Check if enough quantity is available
        if (inventoryItem.totalQuantity < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient quantity. Available: ${inventoryItem.totalQuantity}`
            });
        }

        // Since we don't have batches, we need to remove quantity from priceHistory
        // This is a simplified approach - remove from oldest entries first
        let remainingToRemove = parseInt(quantity);
        const updatedPriceHistory = [];
        const disposedFromEntries = [];

        // Sort priceHistory by date (oldest first) for FIFO removal
        const sortedHistory = [...inventoryItem.priceHistory].sort((a, b) =>
            new Date(a.addedAt) - new Date(b.addedAt)
        );

        for (const entry of sortedHistory) {
            if (remainingToRemove <= 0) {
                updatedPriceHistory.push(entry);
                continue;
            }

            if (entry.quantityAdded <= remainingToRemove) {
                // Remove entire entry
                remainingToRemove -= entry.quantityAdded;
                disposedFromEntries.push({
                    price: entry.price,
                    quantity: entry.quantityAdded,
                    date: entry.addedAt
                });
                // Don't add to updatedPriceHistory (remove completely)
            } else {
                // Partial removal from this entry
                const remainingInEntry = entry.quantityAdded - remainingToRemove;
                disposedFromEntries.push({
                    price: entry.price,
                    quantity: remainingToRemove,
                    date: entry.addedAt
                });

                // Keep the remaining quantity
                updatedPriceHistory.push({
                    price: entry.price,
                    quantityAdded: remainingInEntry,
                    addedAt: entry.addedAt
                });

                remainingToRemove = 0;
            }
        }

        // Update inventory with remaining price history
        inventoryItem.priceHistory = updatedPriceHistory;
        await inventoryItem.save();

        // Create disposal record (simplified)
        const disposalRecord = new ProductDisposal({
            productId: product.productId,
            productName: product.productName,
            type: "defective", // or could be "expired" based on reason
            quantity: parseInt(quantity),
            reason: reason,
            disposalDate: disposalDate || new Date(),
            // Optional: store the cost breakdown if needed
            disposedFromEntries: disposedFromEntries
        });

        await disposalRecord.save();

        res.status(200).json({
            success: true,
            message: `Successfully disposed ${quantity} units`,
            data: {
                disposalRecord,
                updatedInventory: inventoryItem,
                newTotalQuantity: inventoryItem.totalQuantity
            }
        });

    } catch (error) {
        console.error("Error disposing products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to dispose products",
            error: error.message
        });
    }
});

// Get disposal history (keep as is)
router.get("/disposal-history", async (req, res) => {
    try {
        const { productId, type, startDate, endDate, page = 1, limit = 50 } = req.query;

        let query = {};
        if (productId) query.productId = productId;
        if (type) query.type = type;

        if (startDate || endDate) {
            query.disposalDate = {};
            if (startDate) query.disposalDate.$gte = new Date(startDate);
            if (endDate) query.disposalDate.$lte = new Date(endDate);
        }

        const disposals = await ProductDisposal.find(query)
            .sort({ disposalDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await ProductDisposal.countDocuments(query);

        res.status(200).json({
            success: true,
            data: disposals,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error("Error fetching disposal history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch disposal history",
            error: error.message
        });
    }
});

// Get single inventory item
router.get("/get-inventory/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const inventoryItem = await Inventory.findOne({ productId });

        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found"
            });
        }

        const product = await Product.findOne({ productId });

        res.status(200).json({
            success: true,
            data: {
                ...inventoryItem.toObject(),
                averagePrice: inventoryItem.averagePrice,
                productDetails: product
            }
        });

    } catch (error) {
        console.error("Error fetching inventory item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch inventory item",
            error: error.message
        });
    }
});






// ============================================
// UPDATED OUTWARD ROUTE - WITH PRICE, ISSUE DATE AND PERSON NAME
// ============================================
router.post("/outward-quantity", async (req, res) => {
    try {
        console.log("🔍 OUTWARD REQUEST:", req.body);

        const { productId, quantity, price, issueDate, issuedTo } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid quantity is required (must be greater than 0)"
            });
        }

        // NEW - Price validation (REQUIRED)
        if (!price || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid outward price is required (must be greater than 0)"
            });
        }

        if (!issuedTo || issuedTo.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Person name is required (who is taking the goods)"
            });
        }

        if (!issueDate) {
            return res.status(400).json({
                success: false,
                message: "Issue date is required"
            });
        }

        // Find the product
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        console.log("✅ Product found:", product.productName);

        // Find inventory entry
        const inventoryItem = await Inventory.findOne({ productId });

        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found for this product"
            });
        }

        // Check if enough quantity is available
        if (inventoryItem.totalQuantity < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient quantity. Available: ${inventoryItem.totalQuantity} ${inventoryItem.units}`,
                availableQuantity: inventoryItem.totalQuantity,
                requestedQuantity: quantity
            });
        }

        // Add to outward history with price, issue date and person name
        inventoryItem.outwardHistory.push({
            quantity: parseInt(quantity),
            price: parseFloat(price),              // NEW - price added
            issueDate: new Date(issueDate),
            issuedTo: issuedTo.trim(),
            outwardDate: new Date()
        });

        // Save (totalQuantity will be auto-updated by pre-save hook)
        await inventoryItem.save();

        console.log("✅ Outward successful");
        console.log(`   Removed: ${quantity} ${inventoryItem.units}`);
        console.log(`   Price: ₹${price} per unit`);                 // NEW
        console.log(`   Total Value: ₹${price * quantity}`);        // NEW
        console.log(`   Issued To: ${issuedTo}`);
        console.log(`   Issue Date: ${new Date(issueDate).toLocaleDateString()}`);
        console.log(`   New total quantity: ${inventoryItem.totalQuantity}`);
        console.log(`   Avg Selling Price: ₹${inventoryItem.averageSellingPrice}`);  // NEW

        res.status(200).json({
            success: true,
            message: `Successfully removed ${quantity} ${inventoryItem.units} from inventory`,
            data: {
                inventoryId: inventoryItem.inventoryId,
                productName: inventoryItem.productName,
                quantityRemoved: parseInt(quantity),
                price: parseFloat(price),                          // NEW
                totalValue: price * quantity,                       // NEW
                issuedTo: issuedTo,
                issueDate: issueDate,
                newTotalQuantity: inventoryItem.totalQuantity,
                totalOutward: inventoryItem.totalOutward,
                averageSellingPrice: inventoryItem.averageSellingPrice,  // NEW
                units: inventoryItem.units
            }
        });

    } catch (error) {
        console.error("💥 Error in outward quantity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove quantity",
            error: error.message
        });
    }
});

// ============================================
// OPTIONAL: Get outward history for a product
// ============================================
router.get("/outward-history/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const inventoryItem = await Inventory.findOne({ productId });

        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                productId: inventoryItem.productId,
                productName: inventoryItem.productName,
                outwardHistory: inventoryItem.outwardHistory || [],
                totalOutward: inventoryItem.totalOutward
            }
        });

    } catch (error) {
        console.error("Error fetching outward history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch outward history",
            error: error.message
        });
    }
});

// ============================================
// UPDATED: Get complete movement history (inward + outward) with ALL fields including price
// ============================================
router.get("/movement-history/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const inventoryItem = await Inventory.findOne({ productId });

        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found"
            });
        }

        // Combine and sort both histories with all fields
        const inwardHistory = (inventoryItem.priceHistory || []).map(entry => ({
            type: 'INWARD',
            quantity: entry.quantityAdded,
            price: entry.price,
            totalValue: entry.price * entry.quantityAdded,
            addedAt: entry.addedAt,
            purchaseDate: entry.purchaseDate,
            reference: 'Purchase'
        }));

        const outwardHistory = (inventoryItem.outwardHistory || []).map(entry => ({
            type: 'OUTWARD',
            quantity: entry.quantity,
            price: entry.price,                                   // NEW - price added
            totalValue: entry.price * entry.quantity,             // NEW - total value
            outwardDate: entry.outwardDate,
            issueDate: entry.issueDate,
            issuedTo: entry.issuedTo,
            reference: 'Removal'
        }));

        // Combine and sort by date (newest first)
        const allMovements = [...inwardHistory, ...outwardHistory]
            .sort((a, b) => {
                const dateA = a.purchaseDate || a.issueDate || a.addedAt || a.outwardDate;
                const dateB = b.purchaseDate || b.issueDate || b.addedAt || b.outwardDate;
                return new Date(dateB) - new Date(dateA);
            });

        res.status(200).json({
            success: true,
            data: {
                productId: inventoryItem.productId,
                productName: inventoryItem.productName,
                currentQuantity: inventoryItem.totalQuantity,
                totalInwardValue: inventoryItem.priceHistory?.reduce((sum, e) => sum + (e.price * e.quantityAdded), 0) || 0,
                totalOutwardValue: inventoryItem.totalOutwardValue,           // NEW
                movements: allMovements
            }
        });

    } catch (error) {
        console.error("Error fetching movement history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch movement history",
            error: error.message
        });
    }
});


module.exports = router;