const express = require("express");
const router = express.Router();
const Sales = require("../models/sales");
const Customer = require("../models/customer");
const Product = require("../models/product");
const Item = require("../models/item");
const AMC = require("../models/amc");
const Repairing = require("../models/repairing");
const Stamping = require("../models/stamping");
const StampingUnit = require("../models/stampingUnit");

// =============================================
// HELPER: Get current IST date
// =============================================
const getISTNow = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset);
};

// =============================================
// HELPER: Get start of today (IST → returns UTC Date)
// =============================================
const getStartOfTodayIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    istNow.setUTCHours(0, 0, 0, 0);
    return new Date(istNow.getTime() - istOffset);
};

// =============================================
// HELPER: Get start & end of this month (IST)
// =============================================
const getMonthRangeIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const start = new Date(istNow);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    return {
        start: new Date(start.getTime() - istOffset),
        end: new Date(end.getTime() - istOffset)
    };
};

// =============================================
// HELPER: Get fiscal year range (1 Apr → 31 Mar), IST
// =============================================
const getFiscalYearRangeIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();

    const fiscalStartYear = month >= 3 ? year : year - 1;

    const start = new Date(Date.UTC(fiscalStartYear, 3, 1, 0, 0, 0));
    const end = new Date(Date.UTC(fiscalStartYear + 1, 3, 1, 0, 0, 0));

    return {
        start: new Date(start.getTime() - istOffset),
        end: new Date(end.getTime() - istOffset)
    };
};

// =============================================
// HELPER: Last 12 months range (rolling), IST
// =============================================
const getLast12MonthsRangeIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const start = new Date(istNow);
    start.setUTCMonth(start.getUTCMonth() - 11);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(istNow);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(1);
    end.setUTCHours(0, 0, 0, 0);

    return {
        start: new Date(start.getTime() - istOffset),
        end: new Date(end.getTime() - istOffset)
    };
};

// =============================================
// HELPER: Build store filter
// =============================================
const buildStoreFilter = (storeType) => {
    if (!storeType || storeType === 'All') return {};
    return { storeType };
};

// =============================================
// HELPER: Module config — date field + items key
// =============================================
const getModuleConfig = (moduleName) => {
    switch (moduleName) {
        case 'AMC':
            return {
                Model: AMC,
                dateField: 'createdAt',      // AMC uses createdAt (payment received on creation)
                itemsKey: 'products',
                numberField: 'amcNumber',
                idField: 'amcId',
                hasChallan: false,
                hasStatusFilter: false,      // count all AMC statuses in stats (simple & consistent)
                selectFields: 'amcId amcNumber customerName grandTotal createdAt paymentStatus isGstMode status storeType'
            };
        case 'Repairing':
            return {
                Model: Repairing,
                dateField: 'repairingDate',
                itemsKey: 'items',
                numberField: 'repairingNumber',
                idField: 'repairingId',
                hasChallan: false,
                hasStatusFilter: false,
                selectFields: 'repairingId repairingNumber customerName grandTotal repairingDate paymentStatus isGstMode status storeType'
            };
        case 'Stamping':
            return {
                Model: Stamping,
                dateField: 'stampDate',
                itemsKey: 'products',
                numberField: 'stampingNumber',
                idField: 'stampingId',
                hasChallan: false,
                hasStatusFilter: false,
                selectFields: 'stampingId stampingNumber customerName grandTotal stampDate paymentStatus isGstMode storeType'
            };
        case 'Sales':
        default:
            return {
                Model: Sales,
                dateField: 'saleDate',
                itemsKey: 'items',
                numberField: 'invoiceNumber',
                idField: 'saleId',
                hasChallan: true,
                hasStatusFilter: false,
                selectFields: 'saleId invoiceNumber customerName grandTotal saleDate paymentStatus isChallan isGstMode status storeType'
            };
    }
};

// =============================================
// GET /api/dashboard/get-dashboard
// Query params:
//   - storeType: All | Vadodara | Padra
//   - module:    Sales | AMC | Repairing | Stamping   (default: Sales)
// =============================================
router.get("/get-dashboard", async (req, res) => {
    try {
        const storeType = req.query.storeType || 'All';
        const moduleName = req.query.module || 'Sales';
        const storeFilter = buildStoreFilter(storeType);

        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;

        // Date ranges
        const todayStart = getStartOfTodayIST();
        const monthRange = getMonthRangeIST();
        const yearRange = getFiscalYearRangeIST();
        const rollingRange = getLast12MonthsRangeIST();

        // 30-day window for AMC + stamping due alerts
        const thirtyDaysFromNowIST = new Date(now.getTime() + istOffset + 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysFromNowUTC = new Date(thirtyDaysFromNowIST.getTime() - istOffset);

        const cfg = getModuleConfig(moduleName);
        const { Model, dateField, itemsKey, selectFields } = cfg;

        // ===== SHARED STATS (always same — master counts) =====
        const sharedPromises = [
            Customer.countDocuments({}),
            Product.countDocuments({}),
            Item.countDocuments({}),
            AMC.countDocuments({ ...storeFilter, status: 'Active' }),
        ];

        // ===== MODULE-SPECIFIC STATS + CHARTS =====
        const modulePromises = [
            // Today count
            Model.countDocuments({
                ...storeFilter,
                [dateField]: { $gte: todayStart }
            }),
            // Today total
            Model.aggregate([
                { $match: { ...storeFilter, [dateField]: { $gte: todayStart } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),
            // Month count
            Model.countDocuments({
                ...storeFilter,
                [dateField]: { $gte: monthRange.start, $lt: monthRange.end }
            }),
            // Month total
            Model.aggregate([
                { $match: { ...storeFilter, [dateField]: { $gte: monthRange.start, $lt: monthRange.end } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),
            // Year count
            Model.countDocuments({
                ...storeFilter,
                [dateField]: { $gte: yearRange.start, $lt: yearRange.end }
            }),
            // Year total
            Model.aggregate([
                { $match: { ...storeFilter, [dateField]: { $gte: yearRange.start, $lt: yearRange.end } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),
            // Last 12 months trend
            Model.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        [dateField]: { $gte: rollingRange.start, $lt: rollingRange.end }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: { $add: [`$${dateField}`, istOffset] } },
                            month: { $month: { $add: [`$${dateField}`, istOffset] } }
                        },
                        total: { $sum: "$grandTotal" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            // Top 5 products (this fiscal year)
            Model.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        [dateField]: { $gte: yearRange.start, $lt: yearRange.end }
                    }
                },
                { $unwind: `$${itemsKey}` },
                {
                    $group: {
                        _id: `$${itemsKey}.productId`,
                        productName: { $first: `$${itemsKey}.productName` },
                        totalQty: { $sum: `$${itemsKey}.quantity` },
                        totalRevenue: { $sum: `$${itemsKey}.finalPrice` }
                    }
                },
                { $sort: { totalQty: -1 } },
                { $limit: 5 }
            ]),
            // Type split (this fiscal year) — GST / Non-GST (+ Challan for sales)
            cfg.hasChallan
                ? Model.aggregate([
                    {
                        $match: {
                            ...storeFilter,
                            [dateField]: { $gte: yearRange.start, $lt: yearRange.end }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            gst: {
                                $sum: {
                                    $cond: [
                                        { $and: [{ $eq: ["$isChallan", false] }, { $eq: ["$isGstMode", true] }] },
                                        1, 0
                                    ]
                                }
                            },
                            nonGst: {
                                $sum: {
                                    $cond: [
                                        { $and: [{ $eq: ["$isChallan", false] }, { $eq: ["$isGstMode", false] }] },
                                        1, 0
                                    ]
                                }
                            },
                            challan: {
                                $sum: { $cond: [{ $eq: ["$isChallan", true] }, 1, 0] }
                            }
                        }
                    }
                ])
                : Model.aggregate([
                    {
                        $match: {
                            ...storeFilter,
                            [dateField]: { $gte: yearRange.start, $lt: yearRange.end }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            gst: {
                                $sum: { $cond: [{ $eq: ["$isGstMode", true] }, 1, 0] }
                            },
                            nonGst: {
                                $sum: { $cond: [{ $eq: ["$isGstMode", false] }, 1, 0] }
                            }
                        }
                    }
                ]),
            // Payment split (this fiscal year)
            Model.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        [dateField]: { $gte: yearRange.start, $lt: yearRange.end }
                    }
                },
                {
                    $group: {
                        _id: null,
                        paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0] } },
                        pending: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0] } }
                    }
                }
            ]),
            // Recent records (limit 6)
            Model.find({ ...storeFilter })
                .sort({ [dateField]: -1, createdAt: -1 })
                .limit(6)
                .select(selectFields)
                .lean(),
        ];

        // ===== ALERTS (always shown, common across toggles) =====
        const alertPromises = [
            // Pending payments — combined from Sales + AMC + Repairing + Stamping
            Sales.find({ ...storeFilter, paymentStatus: 'Pending' })
                .sort({ saleDate: -1 })
                .limit(6)
                .select('saleId invoiceNumber customerName grandTotal saleDate')
                .lean(),
            AMC.find({ ...storeFilter, paymentStatus: 'Pending' })
                .sort({ createdAt: -1 })
                .limit(6)
                .select('amcId amcNumber customerName grandTotal createdAt')
                .lean(),
            Repairing.find({ ...storeFilter, paymentStatus: 'Pending' })
                .sort({ repairingDate: -1 })
                .limit(6)
                .select('repairingId repairingNumber customerName grandTotal repairingDate')
                .lean(),
            Stamping.find({ ...storeFilter, paymentStatus: 'Pending' })
                .sort({ stampDate: -1 })
                .limit(6)
                .select('stampingId stampingNumber customerName grandTotal stampDate')
                .lean(),

            // AMC renewals due (Active, endDate within 30 days)
            AMC.find({
                ...storeFilter,
                status: 'Active',
                endDate: { $gte: now, $lte: thirtyDaysFromNowUTC }
            })
                .sort({ endDate: 1 })
                .limit(20)
                .select('amcId amcNumber customerName endDate storeType')
                .lean(),

            // Stampings due
            StampingUnit.find({
                ...storeFilter,
                nextDueDate: { $gte: now, $lte: thirtyDaysFromNowUTC }
            })
                .sort({ nextDueDate: 1 })
                .limit(6)
                .select('unitId uniqueNumber productName customerName nextDueDate storeType')
                .lean(),
        ];

        // ===== RUN ALL IN PARALLEL =====
        const [
            sharedResults,
            moduleResults,
            alertResults
        ] = await Promise.all([
            Promise.all(sharedPromises),
            Promise.all(modulePromises),
            Promise.all(alertPromises),
        ]);

        const [
            totalCustomers,
            totalProducts,
            totalItems,
            activeAmcsCount
        ] = sharedResults;

        const [
            todayCount,
            todayAgg,
            monthCount,
            monthAgg,
            yearCount,
            yearAgg,
            trendAgg,
            topProductsAgg,
            typeAgg,
            paymentAgg,
            recentList,
        ] = moduleResults;

        const [
            pendingSales,
            pendingAmc,
            pendingRepairing,
            pendingStamping,
            amcRenewalsDueList,
            stampingsDueList,
        ] = alertResults;

        // ===== BUILD PENDING PAYMENTS — combined with module tag =====
        const pendingPaymentsRaw = [
            ...pendingSales.map(s => ({
                module: 'Sales',
                id: s.saleId,
                number: s.invoiceNumber,
                customerName: s.customerName,
                grandTotal: s.grandTotal,
                date: s.saleDate,
            })),
            ...pendingAmc.map(a => ({
                module: 'AMC',
                id: a.amcId,
                number: a.amcNumber,
                customerName: a.customerName,
                grandTotal: a.grandTotal,
                date: a.createdAt,
            })),
            ...pendingRepairing.map(r => ({
                module: 'Repairing',
                id: r.repairingId,
                number: r.repairingNumber,
                customerName: r.customerName,
                grandTotal: r.grandTotal,
                date: r.repairingDate,
            })),
            ...pendingStamping.map(st => ({
                module: 'Stamping',
                id: st.stampingId,
                number: st.stampingNumber,
                customerName: st.customerName,
                grandTotal: st.grandTotal,
                date: st.stampDate,
            })),
        ]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6);

        // ===== AMC RENEWALS — post-filter out those already renewed =====
        let amcRenewalsDue = [];
        if (amcRenewalsDueList.length > 0) {
            const amcIds = amcRenewalsDueList.map(a => a.amcId);
            const childRenewals = await AMC.find({ renewalOf: { $in: amcIds } })
                .select('renewalOf')
                .lean();

            const renewedAmcIds = new Set(childRenewals.map(c => c.renewalOf));

            amcRenewalsDue = amcRenewalsDueList
                .filter(a => !renewedAmcIds.has(a.amcId))
                .slice(0, 6)
                .map(a => ({
                    amcId: a.amcId,
                    amcNumber: a.amcNumber,
                    customerName: a.customerName,
                    endDate: a.endDate,
                    storeType: a.storeType,
                    daysLeft: Math.max(0, Math.ceil((new Date(a.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                }));
        }

        // ===== BUILD STATS =====
        const stats = {
            todayModule: {
                count: todayCount,
                total: todayAgg[0]?.total || 0
            },
            monthModule: {
                count: monthCount,
                total: monthAgg[0]?.total || 0
            },
            yearModule: {
                count: yearCount,
                total: yearAgg[0]?.total || 0
            },
            totalCustomers,
            totalProducts,
            totalItems,
            activeAmcs: activeAmcsCount
        };

        // ===== BUILD TREND — pad missing months =====
        const monthsMap = {};
        trendAgg.forEach(m => {
            const key = `${m._id.year}-${String(m._id.month).padStart(2, '0')}`;
            monthsMap[key] = { total: m.total, count: m.count };
        });

        const trendLast12Months = [];
        const cursor = new Date(rollingRange.start.getTime() + istOffset);
        cursor.setUTCDate(1);
        cursor.setUTCHours(0, 0, 0, 0);

        for (let i = 0; i < 12; i++) {
            const y = cursor.getUTCFullYear();
            const m = cursor.getUTCMonth() + 1;
            const key = `${y}-${String(m).padStart(2, '0')}`;
            const label = cursor.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

            trendLast12Months.push({
                month: label,
                year: y,
                monthNumber: m,
                total: monthsMap[key]?.total || 0,
                count: monthsMap[key]?.count || 0
            });

            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }

        // ===== TOP PRODUCTS =====
        const topProducts = topProductsAgg.map(p => ({
            productId: p._id,
            productName: p.productName,
            totalQty: p.totalQty,
            totalRevenue: p.totalRevenue
        }));

        // ===== TYPE SPLIT =====
        const typeRaw = typeAgg[0] || {};
        const salesByType = {
            gst: typeRaw.gst || 0,
            nonGst: typeRaw.nonGst || 0,
            challan: cfg.hasChallan ? (typeRaw.challan || 0) : 0
        };

        // ===== PAYMENT SPLIT =====
        const paymentRaw = paymentAgg[0] || { paid: 0, pending: 0 };
        const salesByPayment = {
            paid: paymentRaw.paid || 0,
            pending: paymentRaw.pending || 0
        };

        const charts = {
            salesLast12Months: trendLast12Months,
            topProducts,
            salesByType,
            salesByPayment
        };

        // ===== ALERTS =====
        const alerts = {
            pendingPayments: pendingPaymentsRaw,
            amcRenewalsDue,
            stampingsDue: stampingsDueList.map(u => ({
                unitId: u.unitId,
                uniqueNumber: u.uniqueNumber,
                productName: u.productName,
                customerName: u.customerName,
                nextDueDate: u.nextDueDate,
                storeType: u.storeType,
                daysLeft: Math.max(0, Math.ceil((new Date(u.nextDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            }))
        };

        // ===== RECENT RECORDS (for selected module) =====
        const recentRecords = recentList.map(r => {
            const base = {
                id: r[cfg.idField],
                number: r[cfg.numberField],
                customerName: r.customerName,
                grandTotal: r.grandTotal,
                date: r[dateField],
                paymentStatus: r.paymentStatus,
                isGstMode: r.isGstMode,
                module: moduleName,
            };
            if (cfg.hasChallan) {
                base.isChallan = r.isChallan;
            }
            return base;
        });

        res.status(200).json({
            success: true,
            data: {
                module: moduleName,
                stats,
                charts,
                alerts,
                recentRecords,
                storeType
            }
        });

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard data",
            error: error.message
        });
    }
});

module.exports = router;