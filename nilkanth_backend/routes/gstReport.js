const express = require("express");
const router = express.Router();
const Sales = require("../models/sales");
const AMC = require("../models/amc");
const Stamping = require("../models/stamping");
const Repairing = require("../models/repairing");
const ItemInventory = require("../models/itemInventory");

// =============================================
// HELPER: Build date range from query
// =============================================
const buildDateRange = (dateFrom, dateTo) => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    // If "to" date provided, push it to end of day (23:59:59.999)
    if (to) {
        to.setHours(23, 59, 59, 999);
    }
    if (from) {
        from.setHours(0, 0, 0, 0);
    }

    return { from, to };
};

// =============================================
// HELPER: Build store filter
// =============================================
const buildStoreFilter = (storeType) => {
    if (!storeType || storeType === "Both") return {};
    return { storeType: storeType };
};

// =============================================
// HELPER: Build date range object for Mongo query
// =============================================
const buildDateQuery = (field, from, to) => {
    const query = {};
    if (from || to) {
        query[field] = {};
        if (from) query[field].$gte = from;
        if (to) query[field].$lte = to;
    }
    return query;
};

// =============================================
// GET /api/gst-report/get-summary
// Query: dateFrom, dateTo, storeType
// =============================================
router.get("/get-summary", async (req, res) => {
    try {
        const { dateFrom, dateTo, storeType } = req.query;
        const { from, to } = buildDateRange(dateFrom, dateTo);
        const storeFilter = buildStoreFilter(storeType);

        // ---------- SALES ----------
        const salesFilter = {
            ...storeFilter,
            isGstMode: true,
            isChallan: false,
            status: "Completed",
            ...buildDateQuery("saleDate", from, to),
        };
        const salesAgg = await Sales.aggregate([
            { $match: salesFilter },
            { $group: { _id: null, total: { $sum: "$totalTax" } } },
        ]);
        const salesGst = salesAgg[0]?.total || 0;

        // ---------- AMC ----------
        // Uses createdAt (not startDate), Active + Expired only
        const amcFilter = {
            ...storeFilter,
            isGstMode: true,
            status: { $in: ["Active", "Expired"] },
            ...buildDateQuery("createdAt", from, to),
        };
        const amcAgg = await AMC.aggregate([
            { $match: amcFilter },
            { $group: { _id: null, total: { $sum: "$totalTax" } } },
        ]);
        const amcGst = amcAgg[0]?.total || 0;

        // ---------- STAMPING ----------
        const stampingFilter = {
            ...storeFilter,
            isGstMode: true,
            ...buildDateQuery("stampDate", from, to),
        };
        const stampingAgg = await Stamping.aggregate([
            { $match: stampingFilter },
            { $group: { _id: null, total: { $sum: "$totalTax" } } },
        ]);
        const stampingGst = stampingAgg[0]?.total || 0;

        // ---------- REPAIRING ----------
        const repairingFilter = {
            ...storeFilter,
            isGstMode: true,
            status: "Completed",
            ...buildDateQuery("repairingDate", from, to),
        };
        const repairingAgg = await Repairing.aggregate([
            { $match: repairingFilter },
            { $group: { _id: null, total: { $sum: "$totalTax" } } },
        ]);
        const repairingGst = repairingAgg[0]?.total || 0;

        // ---------- INPUT GST (ITEM INVENTORY) ----------
        const itemInvFilter = { ...storeFilter };
        const itemInvs = await ItemInventory.find(itemInvFilter)
            .select("addHistory")
            .lean();

        let inputGst = 0;
        itemInvs.forEach((inv) => {
            inv.addHistory.forEach((entry) => {
                if (entry.isDeleted) return;
                const entryDate = new Date(entry.date);
                if (from && entryDate < from) return;
                if (to && entryDate > to) return;
                inputGst += Number(entry.gst) || 0;
            });
        });

        // ---------- TOTALS ----------
        const outputGst = salesGst + amcGst + stampingGst + repairingGst;
        const netGst = outputGst - inputGst;
        const isCredit = netGst < 0;

        res.status(200).json({
            success: true,
            data: {
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                storeType: storeType || "Both",
                outputGst: {
                    sales: salesGst,
                    amc: amcGst,
                    stamping: stampingGst,
                    repairing: repairingGst,
                    total: outputGst,
                },
                inputGst: {
                    total: inputGst,
                },
                netGst: netGst,
                isCredit: isCredit,
            },
        });
    } catch (error) {
        console.error("Error fetching GST summary:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch GST summary",
            error: error.message,
        });
    }
});

// =============================================
// GET /api/gst-report/get-detailed
// Query: dateFrom, dateTo, storeType
// =============================================
router.get("/get-detailed", async (req, res) => {
    try {
        const { dateFrom, dateTo, storeType } = req.query;
        const { from, to } = buildDateRange(dateFrom, dateTo);
        const storeFilter = buildStoreFilter(storeType);

        // ---------- SALES ----------
        const salesFilter = {
            ...storeFilter,
            isGstMode: true,
            isChallan: false,
            status: "Completed",
            ...buildDateQuery("saleDate", from, to),
        };
        const salesData = await Sales.find(salesFilter)
            .select(
                "invoiceNumber saleDate customerName subtotal totalDiscount totalTax grandTotal storeType"
            )
            .sort({ saleDate: -1 })
            .lean();

        // ---------- AMC ----------
        const amcFilter = {
            ...storeFilter,
            isGstMode: true,
            status: { $in: ["Active", "Expired"] },
            ...buildDateQuery("createdAt", from, to),
        };
        const amcData = await AMC.find(amcFilter)
            .select(
                "amcNumber createdAt startDate customerName subtotal totalDiscount totalTax grandTotal storeType status"
            )
            .sort({ createdAt: -1 })
            .lean();

        // ---------- STAMPING ----------
        const stampingFilter = {
            ...storeFilter,
            isGstMode: true,
            ...buildDateQuery("stampDate", from, to),
        };
        const stampingData = await Stamping.find(stampingFilter)
            .select(
                "stampingNumber stampDate customerName subtotal totalDiscount totalTax grandTotal storeType"
            )
            .sort({ stampDate: -1 })
            .lean();

        // ---------- REPAIRING ----------
        const repairingFilter = {
            ...storeFilter,
            isGstMode: true,
            status: "Completed",
            ...buildDateQuery("repairingDate", from, to),
        };
        const repairingData = await Repairing.find(repairingFilter)
            .select(
                "repairingNumber repairingDate customerName subtotal totalDiscount totalTax grandTotal storeType"
            )
            .sort({ repairingDate: -1 })
            .lean();

        // ---------- ITEM SUMMARY (INPUT GST, grouped per item) ----------
        const itemInvFilter = { ...storeFilter };
        const itemInvs = await ItemInventory.find(itemInvFilter)
            .select("itemId itemName storeType addHistory")
            .lean();

        const itemMap = new Map();

        itemInvs.forEach((inv) => {
            inv.addHistory.forEach((entry) => {
                if (entry.isDeleted) return;
                const entryDate = new Date(entry.date);
                if (from && entryDate < from) return;
                if (to && entryDate > to) return;

                const key = `${inv.itemId}__${inv.storeType}`;
                if (!itemMap.has(key)) {
                    itemMap.set(key, {
                        itemId: inv.itemId,
                        itemName: inv.itemName,
                        storeType: inv.storeType,
                        totalQty: 0,
                        subtotalExclGst: 0,
                        gst: 0,
                        totalWithGst: 0,
                    });
                }

                const item = itemMap.get(key);
                item.totalQty += Number(entry.quantity) || 0;
                item.subtotalExclGst += Number(entry.subtotalExclGst) || 0;
                item.gst += Number(entry.gst) || 0;
                item.totalWithGst += Number(entry.totalWithGst) || 0;
            });
        });

        const itemSummary = Array.from(itemMap.values()).sort((a, b) =>
            a.itemName.localeCompare(b.itemName)
        );

        res.status(200).json({
            success: true,
            data: {
                itemSummary,
                sales: salesData,
                amc: amcData,
                stamping: stampingData,
                repairing: repairingData,
            },
        });
    } catch (error) {
        console.error("Error fetching GST detailed report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch GST detailed report",
            error: error.message,
        });
    }
});

module.exports = router;