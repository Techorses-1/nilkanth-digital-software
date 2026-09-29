const express = require("express");
const router = express.Router();
const Sales = require("../models/sales");
const Customer = require("../models/customer");
const Product = require("../models/product");
const Item = require("../models/item");
const AMC = require("../models/amc");
const StampingUnit = require("../models/stampingUnit");

// =============================================
// HELPER: Get current IST date
// =============================================
const getISTNow = () => {
    const now = new Date();
    // IST = UTC + 5:30
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
    // Convert back to UTC
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
    const month = istNow.getUTCMonth(); // 0-based

    // If current month < April (index 3), fiscal year started last year
    const fiscalStartYear = month >= 3 ? year : year - 1;

    const start = new Date(Date.UTC(fiscalStartYear, 3, 1, 0, 0, 0)); // 1 April
    const end = new Date(Date.UTC(fiscalStartYear + 1, 3, 1, 0, 0, 0)); // 1 April next year

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
// GET /api/dashboard/get-dashboard
// =============================================
router.get("/get-dashboard", async (req, res) => {
    try {
        const storeType = req.query.storeType || 'All';
        const storeFilter = buildStoreFilter(storeType);

        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;

        // Today, Month, Year, Rolling 12mo ranges (all in UTC form)
        const todayStart = getStartOfTodayIST();
        const monthRange = getMonthRangeIST();
        const yearRange = getFiscalYearRangeIST();
        const rollingRange = getLast12MonthsRangeIST();

        // For AMC / stamping due soon (next 30 days in IST)
        const thirtyDaysFromNowIST = new Date(now.getTime() + istOffset + 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysFromNowUTC = new Date(thirtyDaysFromNowIST.getTime() - istOffset);

        // ===== PARALLEL QUERIES =====
        const [
            // Today sales
            todaySalesCount,
            todaySalesAgg,

            // Month sales
            monthSalesCount,
            monthSalesAgg,

            // Year sales
            yearSalesCount,
            yearSalesAgg,

            // Master counts
            totalCustomers,
            totalProducts,
            totalItems,

            // Active AMCs count
            activeAmcsCount,

            // Charts — sales last 12 months (aggregation)
            salesLast12MonthsAgg,

            // Top 5 products (this fiscal year)
            topProductsAgg,

            // Sales type split (all time, or this year? — using this year)
            salesByTypeAgg,

            // Payment split (this year)
            salesByPaymentAgg,

            // Alerts — pending payments
            pendingPaymentsList,

            // Alerts — AMC renewals due (will post-filter for no child)
            amcRenewalsDueList,

            // Alerts — stampings due
            stampingsDueList,

            // Recent sales
            recentSalesList
        ] = await Promise.all([
            // Today sales count
            Sales.countDocuments({
                ...storeFilter,
                saleDate: { $gte: todayStart }
            }),

            // Today sales total
            Sales.aggregate([
                { $match: { ...storeFilter, saleDate: { $gte: todayStart } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),

            // Month sales count
            Sales.countDocuments({
                ...storeFilter,
                saleDate: { $gte: monthRange.start, $lt: monthRange.end }
            }),

            // Month sales total
            Sales.aggregate([
                { $match: { ...storeFilter, saleDate: { $gte: monthRange.start, $lt: monthRange.end } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),

            // Year (fiscal) sales count
            Sales.countDocuments({
                ...storeFilter,
                saleDate: { $gte: yearRange.start, $lt: yearRange.end }
            }),

            // Year sales total
            Sales.aggregate([
                { $match: { ...storeFilter, saleDate: { $gte: yearRange.start, $lt: yearRange.end } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),

            // Total customers
            Customer.countDocuments({}),

            // Total products
            Product.countDocuments({}),

            // Total items
            Item.countDocuments({}),

            // Active AMCs count
            AMC.countDocuments({
                ...storeFilter,
                status: 'Active'
            }),

            // Sales last 12 months
            Sales.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        saleDate: { $gte: rollingRange.start, $lt: rollingRange.end }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: { $add: ["$saleDate", istOffset] } },
                            month: { $month: { $add: ["$saleDate", istOffset] } }
                        },
                        total: { $sum: "$grandTotal" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),

            // Top 5 products (this fiscal year)
            Sales.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        saleDate: { $gte: yearRange.start, $lt: yearRange.end }
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.productId",
                        productName: { $first: "$items.productName" },
                        totalQty: { $sum: "$items.quantity" },
                        totalRevenue: { $sum: "$items.finalPrice" }
                    }
                },
                { $sort: { totalQty: -1 } },
                { $limit: 5 }
            ]),

            // Sales by type (this fiscal year)
            Sales.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        saleDate: { $gte: yearRange.start, $lt: yearRange.end }
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
            ]),

            // Sales by payment (this fiscal year)
            Sales.aggregate([
                {
                    $match: {
                        ...storeFilter,
                        saleDate: { $gte: yearRange.start, $lt: yearRange.end }
                    }
                },
                {
                    $group: {
                        _id: null,
                        paid: {
                            $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0] }
                        },
                        pending: {
                            $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0] }
                        }
                    }
                }
            ]),

            // Pending payments list (limit 6)
            Sales.find({
                ...storeFilter,
                paymentStatus: 'Pending'
            })
                .sort({ saleDate: -1 })
                .limit(6)
                .select('saleId invoiceNumber customerName grandTotal saleDate')
                .lean(),

            // AMC renewals due (limit 20, will filter to 6 after checking children)
            AMC.find({
                ...storeFilter,
                status: 'Active',
                endDate: { $gte: now, $lte: thirtyDaysFromNowUTC }
            })
                .sort({ endDate: 1 })
                .limit(20)
                .select('amcId amcNumber customerName endDate storeType')
                .lean(),

            // Stampings due (limit 6)
            StampingUnit.find({
                ...storeFilter,
                nextDueDate: { $gte: now, $lte: thirtyDaysFromNowUTC }
            })
                .sort({ nextDueDate: 1 })
                .limit(6)
                .select('unitId uniqueNumber productName customerName nextDueDate storeType')
                .lean(),

            // Recent sales (limit 6)
            Sales.find({ ...storeFilter })
                .sort({ saleDate: -1, createdAt: -1 })
                .limit(6)
                .select('saleId invoiceNumber customerName grandTotal saleDate paymentStatus isChallan isGstMode')
                .lean()
        ]);

        // ===== POST-FILTER: AMC renewals — remove those that already have a child AMC =====
        let amcRenewalsDue = [];
        if (amcRenewalsDueList.length > 0) {
            const amcIds = amcRenewalsDueList.map(a => a.amcId);
            const childRenewals = await AMC.find({
                renewalOf: { $in: amcIds }
            })
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
            todaySales: {
                count: todaySalesCount,
                total: todaySalesAgg[0]?.total || 0
            },
            monthSales: {
                count: monthSalesCount,
                total: monthSalesAgg[0]?.total || 0
            },
            yearSales: {
                count: yearSalesCount,
                total: yearSalesAgg[0]?.total || 0
            },
            totalCustomers,
            totalProducts,
            totalItems,
            activeAmcs: activeAmcsCount
        };

        // ===== BUILD CHARTS =====

        // 1. Sales last 12 months — pad missing months with 0
        const monthsMap = {};
        salesLast12MonthsAgg.forEach(m => {
            const key = `${m._id.year}-${String(m._id.month).padStart(2, '0')}`;
            monthsMap[key] = { total: m.total, count: m.count };
        });

        const salesLast12Months = [];
        const cursor = new Date(rollingRange.start.getTime() + istOffset);
        cursor.setUTCDate(1);
        cursor.setUTCHours(0, 0, 0, 0);

        for (let i = 0; i < 12; i++) {
            const y = cursor.getUTCFullYear();
            const m = cursor.getUTCMonth() + 1;
            const key = `${y}-${String(m).padStart(2, '0')}`;
            const label = cursor.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

            salesLast12Months.push({
                month: label,
                year: y,
                monthNumber: m,
                total: monthsMap[key]?.total || 0,
                count: monthsMap[key]?.count || 0
            });

            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }

        // 2. Top products
        const topProducts = topProductsAgg.map(p => ({
            productId: p._id,
            productName: p.productName,
            totalQty: p.totalQty,
            totalRevenue: p.totalRevenue
        }));

        // 3. Sales by type
        const salesByTypeRaw = salesByTypeAgg[0] || { gst: 0, nonGst: 0, challan: 0 };
        const salesByType = {
            gst: salesByTypeRaw.gst || 0,
            nonGst: salesByTypeRaw.nonGst || 0,
            challan: salesByTypeRaw.challan || 0
        };

        // 4. Sales by payment
        const salesByPaymentRaw = salesByPaymentAgg[0] || { paid: 0, pending: 0 };
        const salesByPayment = {
            paid: salesByPaymentRaw.paid || 0,
            pending: salesByPaymentRaw.pending || 0
        };

        const charts = {
            salesLast12Months,
            topProducts,
            salesByType,
            salesByPayment
        };

        // ===== BUILD ALERTS =====
        const alerts = {
            pendingPayments: pendingPaymentsList.map(s => ({
                saleId: s.saleId,
                invoiceNumber: s.invoiceNumber,
                customerName: s.customerName,
                grandTotal: s.grandTotal,
                saleDate: s.saleDate
            })),
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

        // ===== BUILD RECENT SALES =====
        const recentSales = recentSalesList.map(s => ({
            saleId: s.saleId,
            invoiceNumber: s.invoiceNumber,
            customerName: s.customerName,
            grandTotal: s.grandTotal,
            saleDate: s.saleDate,
            paymentStatus: s.paymentStatus,
            isChallan: s.isChallan,
            isGstMode: s.isGstMode
        }));

        res.status(200).json({
            success: true,
            data: {
                stats,
                charts,
                alerts,
                recentSales,
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