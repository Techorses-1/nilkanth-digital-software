const express = require("express");
const router = express.Router();

const Customer = require("../models/customer");
const Sales = require("../models/sales");
const Quotation = require("../models/quotation");
const AMC = require("../models/amc");
const Stamping = require("../models/stamping");
const StampingUnit = require("../models/stampingUnit");
const Repairing = require("../models/repairing");

// =============================================
// GET /api/customer-history/overview/:customerId
// Returns:
//   - customer info
//   - summary counts + totals for each module
//   - latest 10 records per module (for quick peek / faster initial load)
// =============================================
router.get("/overview/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID is required"
            });
        }

        // ===== CUSTOMER =====
        const customer = await Customer.findOne({ customerId }).lean();
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        // ===== PARALLEL QUERIES (all indexed on customerId) =====
        const [
            // Sales
            salesCount,
            salesAgg,
            salesLatest,

            // Quotations
            quotationsCount,
            quotationsAgg,
            quotationsLatest,

            // AMC
            amcActiveCount,
            amcPendingCount,
            amcExpiredCount,
            amcTotalCount,
            amcAgg,
            amcLatest,

            // Stamping
            stampingsCount,
            stampingsAgg,
            stampingsLatest,
            stampingUnitsCount,

            // Repairing
            repairingsCount,
            repairingsAgg,
            repairingsLatest
        ] = await Promise.all([
            // Sales
            Sales.countDocuments({ customerId }),
            Sales.aggregate([
                { $match: { customerId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$grandTotal" },
                        totalTax: { $sum: "$totalTax" }
                    }
                }
            ]),
            Sales.find({ customerId })
                .sort({ saleDate: -1, createdAt: -1 })
                .limit(10)
                .select("saleId invoiceNumber internalInvoiceNumber isChallan isGstMode saleDate items subtotal totalDiscount totalTax grandTotal paymentStatus paymentType status")
                .lean(),

            // Quotations
            Quotation.countDocuments({ customerId }),
            Quotation.aggregate([
                { $match: { customerId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$grandTotal" }
                    }
                }
            ]),
            Quotation.find({ customerId })
                .sort({ quotationDate: -1, createdAt: -1 })
                .limit(10)
                .select("quotationId quotationNumber quotationDate items subtotal totalDiscount grandTotal status")
                .lean(),

            // AMC
            AMC.countDocuments({ customerId, status: 'Active' }),
            AMC.countDocuments({ customerId, status: 'Pending' }),
            AMC.countDocuments({ customerId, status: 'Expired' }),
            AMC.countDocuments({ customerId }),
            AMC.aggregate([
                { $match: { customerId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$grandTotal" },
                        totalTax: { $sum: "$totalTax" }
                    }
                }
            ]),
            AMC.find({ customerId })
                .sort({ startDate: -1, createdAt: -1 })
                .limit(10)
                .select("amcId amcNumber renewalOf isGstMode storeType products durationYears startDate endDate status serviceHistory subtotal totalDiscount totalTax grandTotal paymentStatus paymentType")
                .lean(),

            // Stamping
            Stamping.countDocuments({ customerId }),
            Stamping.aggregate([
                { $match: { customerId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$grandTotal" },
                        totalTax: { $sum: "$totalTax" }
                    }
                }
            ]),
            Stamping.find({ customerId })
                .sort({ stampDate: -1, createdAt: -1 })
                .limit(10)
                .select("stampingId stampingNumber linkedInvoiceNumber isGstMode storeType products stampDate subtotal totalDiscount totalTax grandTotal paymentStatus paymentType")
                .lean(),
            StampingUnit.countDocuments({ customerId }),

            // Repairing
            Repairing.countDocuments({ customerId }),
            Repairing.aggregate([
                { $match: { customerId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$grandTotal" },
                        totalTax: { $sum: "$totalTax" }
                    }
                }
            ]),
            Repairing.find({ customerId })
                .sort({ repairingDate: -1, createdAt: -1 })
                .limit(10)
                .select("repairingId repairingNumber isGstMode storeType items repairingDate subtotal totalDiscount totalTax grandTotal paymentStatus paymentType repairNotes")
                .lean()
        ]);

        // ===== BUILD SUMMARY =====
        const summary = {
            sales: {
                count: salesCount,
                total: salesAgg[0]?.total || 0,
                totalTax: salesAgg[0]?.totalTax || 0
            },
            quotations: {
                count: quotationsCount,
                total: quotationsAgg[0]?.total || 0
            },
            amc: {
                total: amcTotalCount,
                active: amcActiveCount,
                pending: amcPendingCount,
                expired: amcExpiredCount,
                grandTotal: amcAgg[0]?.total || 0,
                totalTax: amcAgg[0]?.totalTax || 0
            },
            stamping: {
                count: stampingsCount,
                total: stampingsAgg[0]?.total || 0,
                totalTax: stampingsAgg[0]?.totalTax || 0,
                machines: stampingUnitsCount
            },
            repairing: {
                count: repairingsCount,
                total: repairingsAgg[0]?.total || 0,
                totalTax: repairingsAgg[0]?.totalTax || 0
            }
        };

        // ===== CLEAN CUSTOMER (strip internal fields) =====
        const customerSafe = {
            customerId: customer.customerId,
            customerName: customer.customerName,
            email: customer.email || '',
            contactNumber: customer.contactNumber || '',
            gstNumber: customer.gstNumber || '',
            address: customer.address || '',
            loyaltyCoins: customer.loyaltyCoins || 0,
            createdAt: customer.createdAt
        };

        res.status(200).json({
            success: true,
            data: {
                customer: customerSafe,
                summary,
                latest: {
                    sales: salesLatest,
                    quotations: quotationsLatest,
                    amcs: amcLatest,
                    stampings: stampingsLatest,
                    repairings: repairingsLatest
                }
            }
        });

    } catch (error) {
        console.error("Error fetching customer history overview:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer history overview",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/sales/:customerId
// =============================================
router.get("/sales/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';
        const skip = (page - 1) * limit;

        const filter = { customerId };

        if (fromDate || toDate) {
            filter.saleDate = {};
            if (fromDate) filter.saleDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.saleDate.$lte = end;
            }
        }

        const [total, sales] = await Promise.all([
            Sales.countDocuments(filter),
            Sales.find(filter)
                .sort({ saleDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("saleId invoiceNumber internalInvoiceNumber isChallan isGstMode saleDate items subtotal totalDiscount totalTax grandTotal taxBreakdown taxType taxSlab paymentStatus paymentType notes status customerName customerPhone customerEmail customerGstin customerAddress storeType createdBy createdById createdAt")
                .lean()
        ]);

        res.status(200).json({
            success: true,
            data: sales,
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
        console.error("Error fetching customer sales:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer sales",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/quotations/:customerId
// =============================================
router.get("/quotations/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';
        const skip = (page - 1) * limit;

        const filter = { customerId };

        if (fromDate || toDate) {
            filter.quotationDate = {};
            if (fromDate) filter.quotationDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.quotationDate.$lte = end;
            }
        }

        const [total, quotations] = await Promise.all([
            Quotation.countDocuments(filter),
            Quotation.find(filter)
                .sort({ quotationDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("quotationId quotationNumber quotationDate items subtotal totalDiscount grandTotal notes status customerName customerPhone customerEmail customerGstin customerAddress storeType createdBy createdById createdAt")
                .lean()
        ]);

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

// =============================================
// GET /api/customer-history/amcs/:customerId
// =============================================
router.get("/amcs/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';
        const skip = (page - 1) * limit;

        const filter = { customerId };

        if (fromDate || toDate) {
            filter.startDate = {};
            if (fromDate) filter.startDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.startDate.$lte = end;
            }
        }

        const [total, amcs] = await Promise.all([
            AMC.countDocuments(filter),
            AMC.find(filter)
                .sort({ startDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("amcId amcNumber renewalOf linkedSaleId linkedInvoiceNumber isGstMode storeType products durationYears startDate endDate status serviceHistory subtotal totalDiscount totalTax grandTotal taxBreakdown taxType taxSlab paymentStatus paymentType notes customerName customerPhone customerEmail customerGstin customerAddress createdBy createdById createdAt")
                .lean()
        ]);

        res.status(200).json({
            success: true,
            data: amcs,
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
        console.error("Error fetching customer AMCs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer AMCs",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/stampings/:customerId
// =============================================
router.get("/stampings/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';
        const skip = (page - 1) * limit;

        const filter = { customerId };

        if (fromDate || toDate) {
            filter.stampDate = {};
            if (fromDate) filter.stampDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.stampDate.$lte = end;
            }
        }

        const [total, stampings] = await Promise.all([
            Stamping.countDocuments(filter),
            Stamping.find(filter)
                .sort({ stampDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("stampingId stampingNumber linkedSaleId linkedInvoiceNumber isGstMode storeType products stampDate subtotal totalDiscount totalTax grandTotal taxBreakdown taxType taxSlab paymentStatus paymentType notes customerName customerPhone customerEmail customerGstin customerAddress createdBy createdById createdAt")
                .lean()
        ]);

        res.status(200).json({
            success: true,
            data: stampings,
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
        console.error("Error fetching customer stampings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer stampings",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/stamping-units/:customerId
// Machines list — paginated
// =============================================
router.get("/stamping-units/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [total, units] = await Promise.all([
            StampingUnit.countDocuments({ customerId }),
            StampingUnit.find({ customerId })
                .sort({ lastStampDate: -1 })
                .skip(skip)
                .limit(limit)
                .select("unitId customerId customerName productId productName uniqueNumber hsnCode capacity storeType lastStampDate nextDueDate lastStampingNumber totalStamps createdAt")
                .lean()
        ]);

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
        console.error("Error fetching customer stamping units:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer stamping units",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/stamping-unit-history
// Query: customerId, productId, uniqueNumber
// Full machine history (single doc, cheap query by compound index)
// =============================================
router.get("/stamping-unit-history", async (req, res) => {
    try {
        const { customerId, productId, uniqueNumber } = req.query;

        if (!customerId || !productId || !uniqueNumber) {
            return res.status(400).json({
                success: false,
                message: "customerId, productId, uniqueNumber are required"
            });
        }

        const unit = await StampingUnit.findOne({
            customerId,
            productId,
            uniqueNumber
        }).lean();

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        res.status(200).json({
            success: true,
            data: unit
        });
    } catch (error) {
        console.error("Error fetching stamping unit history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unit history",
            error: error.message
        });
    }
});

// =============================================
// GET /api/customer-history/repairings/:customerId
// =============================================
router.get("/repairings/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';
        const skip = (page - 1) * limit;

        const filter = { customerId };

        if (fromDate || toDate) {
            filter.repairingDate = {};
            if (fromDate) filter.repairingDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.repairingDate.$lte = end;
            }
        }

        const [total, repairings] = await Promise.all([
            Repairing.countDocuments(filter),
            Repairing.find(filter)
                .sort({ repairingDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("repairingId repairingNumber isGstMode storeType items repairingDate subtotal totalDiscount totalTax grandTotal taxBreakdown taxType taxSlab paymentStatus paymentType repairNotes customerName customerPhone customerEmail customerGstin customerAddress createdBy createdById createdAt")
                .lean()
        ]);

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