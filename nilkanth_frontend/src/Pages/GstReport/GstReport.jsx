import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaFileInvoiceDollar,
    FaFileExcel,
    FaCalendarAlt,
    FaStore,
    FaRupeeSign,
    FaArrowDown,
    FaArrowUp,
    FaBalanceScale,
    FaBoxes,
    FaFileInvoice,
    FaTools,
    FaStamp,
    FaWrench,
    FaChevronDown,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import "./GstReport.scss";
import "react-toastify/dist/ReactToastify.css";

// ============= AUTH =============
const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        headers: {
            Authorization: token ? `Bearer ${token}` : "",
        },
    };
};

// ============= DATE RANGE OPTIONS =============
const DATE_RANGE_OPTIONS = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "last_6_months", label: "Last 6 Months" },
    { value: "this_year", label: "This Year" },
    { value: "current_fy", label: "Current Financial Year" },
    { value: "custom", label: "Custom" },
];

const STORE_OPTIONS = [
    { value: "Both", label: "Both Stores" },
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" },
];

// ============= HELPERS: date math =============
const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const getRangeForPreset = (preset) => {
    const today = new Date();
    let from, to;

    switch (preset) {
        case "this_month": {
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        }
        case "last_month": {
            from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            to = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        }
        case "last_6_months": {
            from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
            to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        }
        case "this_year": {
            from = new Date(today.getFullYear(), 0, 1);
            to = new Date(today.getFullYear(), 11, 31);
            break;
        }
        case "current_fy": {
            const year = today.getFullYear();
            const month = today.getMonth(); // 0-11
            if (month >= 3) {
                // Apr or later → FY is Apr(year) to Mar(year+1)
                from = new Date(year, 3, 1);
                to = new Date(year + 1, 2, 31);
            } else {
                // Jan-Mar → FY is Apr(year-1) to Mar(year)
                from = new Date(year - 1, 3, 1);
                to = new Date(year, 2, 31);
            }
            break;
        }
        default:
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return { from: toISODate(from), to: toISODate(to) };
};

// ============= FORMATTERS =============
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const GstReport = () => {
    // ============= FILTER STATE =============
    const [dateRange, setDateRange] = useState("this_month");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [storeFilter, setStoreFilter] = useState("Both");

    // ============= DATA STATE =============
    const [summary, setSummary] = useState(null);
    const [detailed, setDetailed] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // ============= INITIALIZE DATE RANGE =============
    useEffect(() => {
        if (dateRange !== "custom") {
            const { from, to } = getRangeForPreset(dateRange);
            setFromDate(from);
            setToDate(to);
        }
    }, [dateRange]);

    // ============= FETCH DATA =============
    useEffect(() => {
        // Custom → wait until both dates are selected
        if (dateRange === "custom" && (!fromDate || !toDate)) {
            return;
        }
        if (!fromDate || !toDate) return;

        fetchData();
        // eslint-disable-next-line
    }, [fromDate, toDate, storeFilter, dateRange]);

    const fetchData = async () => {
        if (!fromDate || !toDate) return;

        setIsLoading(true);
        try {
            const headers = getAuthHeaders();
            const params = {
                dateFrom: fromDate,
                dateTo: toDate,
                storeType: storeFilter,
            };

            const [summaryRes, detailedRes] = await Promise.all([
                axios.get(
                    `${import.meta.env.VITE_API_URL}/gst-report/get-summary`,
                    { ...headers, params }
                ),
                axios.get(
                    `${import.meta.env.VITE_API_URL}/gst-report/get-detailed`,
                    { ...headers, params }
                ),
            ]);

            if (summaryRes.data.success) {
                setSummary(summaryRes.data.data);
            }
            if (detailedRes.data.success) {
                setDetailed(detailedRes.data.data);
            }
        } catch (error) {
            console.error("Error fetching GST report:", error);
            toast.error(
                error.response?.data?.message || "Failed to load GST report"
            );
        } finally {
            setIsLoading(false);
        }
    };

    // ============= EXPORT TO EXCEL (single sheet, professionally stacked) =============
    const exportToExcel = async () => {
        if (isExporting) return;
        if (!summary || !detailed) {
            toast.warning("No data to export");
            return;
        }

        setIsExporting(true);
        try {
            const rows = [];

            const pushBlank = () => rows.push({});
            const pushTitle = (title) => rows.push({ A: title });
            const pushHeader = (cols) => {
                const row = {};
                cols.forEach((c, i) => {
                    row[String.fromCharCode(65 + i)] = c;
                });
                rows.push(row);
            };
            const pushRow = (values) => {
                const row = {};
                values.forEach((v, i) => {
                    row[String.fromCharCode(65 + i)] = v;
                });
                rows.push(row);
            };

            // ===== HEADER INFO =====
            pushTitle("GST REPORT");
            pushRow(["Period", `${formatDate(fromDate)} to ${formatDate(toDate)}`]);
            pushRow(["Store", storeFilter]);
            pushBlank();

            // ===== SUMMARY =====
            pushTitle("=== SUMMARY ===");
            pushRow(["Total Output GST", Number(summary.outputGst.total) || 0]);
            pushRow(["Total Input GST", Number(summary.inputGst.total) || 0]);
            if (summary.isCredit) {
                pushRow(["GST Credit", Math.abs(Number(summary.netGst) || 0)]);
            } else {
                pushRow(["Net GST Payable", Number(summary.netGst) || 0]);
            }
            pushBlank();

            // ===== MODULE BREAKDOWN =====
            pushTitle("=== OUTPUT GST BREAKDOWN ===");
            pushHeader(["Module", "GST Amount"]);
            pushRow(["Sales", Number(summary.outputGst.sales) || 0]);
            pushRow(["AMC", Number(summary.outputGst.amc) || 0]);
            pushRow(["Stamping", Number(summary.outputGst.stamping) || 0]);
            pushRow(["Repairing", Number(summary.outputGst.repairing) || 0]);
            pushRow(["Total", Number(summary.outputGst.total) || 0]);
            pushBlank();

            // ===== ITEM INPUT SUMMARY =====
            pushTitle("=== ITEM-WISE INPUT GST ===");
            pushHeader([
                "Item Name",
                "Store",
                "Total Qty",
                "Subtotal (excl. GST)",
                "GST",
                "Total (with GST)",
            ]);
            if (detailed.itemSummary?.length) {
                detailed.itemSummary.forEach((it) => {
                    pushRow([
                        it.itemName,
                        it.storeType,
                        Number(it.totalQty) || 0,
                        Number(it.subtotalExclGst) || 0,
                        Number(it.gst) || 0,
                        Number(it.totalWithGst) || 0,
                    ]);
                });
            } else {
                pushRow(["No items found", "", "", "", "", ""]);
            }
            pushBlank();

            // ===== SALES =====
            pushTitle("=== SALES INVOICES ===");
            pushHeader([
                "Date",
                "Invoice No",
                "Customer",
                "Store",
                "Subtotal",
                "Discount",
                "GST",
                "Grand Total",
            ]);
            if (detailed.sales?.length) {
                detailed.sales.forEach((s) => {
                    pushRow([
                        formatDate(s.saleDate),
                        s.invoiceNumber,
                        s.customerName,
                        s.storeType,
                        Number(s.subtotal) || 0,
                        Number(s.totalDiscount) || 0,
                        Number(s.totalTax) || 0,
                        Number(s.grandTotal) || 0,
                    ]);
                });
            } else {
                pushRow(["No sales invoices in range", "", "", "", "", "", "", ""]);
            }
            pushBlank();

            // ===== AMC =====
            pushTitle("=== AMC ===");
            pushHeader([
                "Date",
                "AMC No",
                "Customer",
                "Store",
                "Status",
                "Subtotal",
                "Discount",
                "GST",
                "Grand Total",
            ]);
            if (detailed.amc?.length) {
                detailed.amc.forEach((a) => {
                    pushRow([
                        formatDate(a.createdAt),
                        a.amcNumber,
                        a.customerName,
                        a.storeType,
                        a.status,
                        Number(a.subtotal) || 0,
                        Number(a.totalDiscount) || 0,
                        Number(a.totalTax) || 0,
                        Number(a.grandTotal) || 0,
                    ]);
                });
            } else {
                pushRow(["No AMC records in range", "", "", "", "", "", "", "", ""]);
            }
            pushBlank();

            // ===== STAMPING =====
            pushTitle("=== STAMPING ===");
            pushHeader([
                "Date",
                "Stamping No",
                "Customer",
                "Store",
                "Subtotal",
                "Discount",
                "GST",
                "Grand Total",
            ]);
            if (detailed.stamping?.length) {
                detailed.stamping.forEach((s) => {
                    pushRow([
                        formatDate(s.stampDate),
                        s.stampingNumber,
                        s.customerName,
                        s.storeType,
                        Number(s.subtotal) || 0,
                        Number(s.totalDiscount) || 0,
                        Number(s.totalTax) || 0,
                        Number(s.grandTotal) || 0,
                    ]);
                });
            } else {
                pushRow(["No stamping records in range", "", "", "", "", "", "", ""]);
            }
            pushBlank();

            // ===== REPAIRING =====
            pushTitle("=== REPAIRING ===");
            pushHeader([
                "Date",
                "Repairing No",
                "Customer",
                "Store",
                "Subtotal",
                "Discount",
                "GST",
                "Grand Total",
            ]);
            if (detailed.repairing?.length) {
                detailed.repairing.forEach((r) => {
                    pushRow([
                        formatDate(r.repairingDate),
                        r.repairingNumber,
                        r.customerName,
                        r.storeType,
                        Number(r.subtotal) || 0,
                        Number(r.totalDiscount) || 0,
                        Number(r.totalTax) || 0,
                        Number(r.grandTotal) || 0,
                    ]);
                });
            } else {
                pushRow(["No repairing records in range", "", "", "", "", "", "", ""]);
            }

            const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
            // Set column widths
            worksheet["!cols"] = [
                { wch: 22 },
                { wch: 18 },
                { wch: 26 },
                { wch: 12 },
                { wch: 14 },
                { wch: 14 },
                { wch: 14 },
                { wch: 16 },
                { wch: 12 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "GST Report");
            XLSX.writeFile(
                workbook,
                `GST_Report_${storeFilter}_${fromDate}_to_${toDate}.xlsx`
            );

            toast.success("Excel exported successfully!");
        } catch (error) {
            console.error("Excel export error:", error);
            toast.error("Failed to export Excel");
        } finally {
            setIsExporting(false);
        }
    };

    // ============= RENDER SUMMARY CARD =============
    const renderSummary = () => {
        if (!summary) return null;

        const { outputGst, inputGst, netGst, isCredit } = summary;

        return (
            <>
                {/* ===== TOP SUMMARY CARDS ===== */}
                <div className="gst-summary-cards">
                    <div className="gst-card gst-card-output">
                        <div className="gst-card-icon">
                            <FaArrowUp />
                        </div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">Total Output GST</span>
                            <span className="gst-card-value">
                                {formatCurrency(outputGst.total)}
                            </span>
                            <span className="gst-card-sub">
                                Collected from customers
                            </span>
                        </div>
                    </div>

                    <div className="gst-card gst-card-input">
                        <div className="gst-card-icon">
                            <FaArrowDown />
                        </div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">Total Input GST</span>
                            <span className="gst-card-value">
                                {formatCurrency(inputGst.total)}
                            </span>
                            <span className="gst-card-sub">
                                Paid on item purchases
                            </span>
                        </div>
                    </div>

                    <div
                        className={`gst-card ${isCredit ? "gst-card-credit" : "gst-card-payable"
                            }`}
                    >
                        <div className="gst-card-icon">
                            <FaBalanceScale />
                        </div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">
                                {isCredit ? "GST Credit" : "Net GST Payable"}
                            </span>
                            <span className="gst-card-value">
                                {formatCurrency(Math.abs(netGst))}
                            </span>
                            <span className="gst-card-sub">
                                {isCredit
                                    ? "Input exceeds Output"
                                    : "Output exceeds Input"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ===== BREAKDOWN ===== */}
                <div className="gst-breakdown-card">
                    <h3 className="gst-section-title">
                        <FaFileInvoiceDollar /> Output GST Breakdown
                    </h3>
                    <div className="gst-breakdown-grid">
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label">
                                <FaFileInvoice /> Sales
                            </span>
                            <span className="gst-breakdown-value">
                                {formatCurrency(outputGst.sales)}
                            </span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label">
                                <FaRupeeSign /> AMC
                            </span>
                            <span className="gst-breakdown-value">
                                {formatCurrency(outputGst.amc)}
                            </span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label">
                                <FaStamp /> Stamping
                            </span>
                            <span className="gst-breakdown-value">
                                {formatCurrency(outputGst.stamping)}
                            </span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label">
                                <FaWrench /> Repairing
                            </span>
                            <span className="gst-breakdown-value">
                                {formatCurrency(outputGst.repairing)}
                            </span>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    // ============= RENDER ITEM SUMMARY =============
    const renderItemSummary = () => {
        if (!detailed) return null;
        const items = detailed.itemSummary || [];

        return (
            <div className="gst-table-card">
                <h3 className="gst-section-title">
                    <FaBoxes /> Item-wise Input GST
                </h3>

                {items.length === 0 ? (
                    <div className="gst-empty">
                        <p>No item purchases found in this period.</p>
                    </div>
                ) : (
                    <div className="gst-table-wrap">
                        <table className="gst-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Item Name</th>
                                    <th>Store</th>
                                    <th>Total Qty</th>
                                    <th>Subtotal (excl. GST)</th>
                                    <th>GST</th>
                                    <th>Total (with GST)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, idx) => (
                                    <tr key={`${it.itemId}-${it.storeType}-${idx}`}>
                                        <td>{idx + 1}</td>
                                        <td className="gst-cell-bold">
                                            {it.itemName}
                                        </td>
                                        <td>
                                            <span className="gst-store-tag">
                                                {it.storeType}
                                            </span>
                                        </td>
                                        <td>{it.totalQty}</td>
                                        <td>{formatCurrency(it.subtotalExclGst)}</td>
                                        <td className="gst-cell-gst">
                                            {formatCurrency(it.gst)}
                                        </td>
                                        <td className="gst-cell-total">
                                            {formatCurrency(it.totalWithGst)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER OUTPUT TABLE (reusable) =============
    const renderOutputTable = (title, icon, list, config) => {
        const {
            dateField,
            numberField,
            numberLabel,
            showStatus = false,
        } = config;

        return (
            <div className="gst-table-card">
                <h3 className="gst-section-title">
                    {icon} {title}
                </h3>

                {!list || list.length === 0 ? (
                    <div className="gst-empty">
                        <p>No records found in this period.</p>
                    </div>
                ) : (
                    <div className="gst-table-wrap">
                        <table className="gst-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>{numberLabel}</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    {showStatus && <th>Status</th>}
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>GST</th>
                                    <th>Grand Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((row, idx) => (
                                    <tr key={idx}>
                                        <td>{idx + 1}</td>
                                        <td>{formatDate(row[dateField])}</td>
                                        <td className="gst-cell-bold">
                                            {row[numberField]}
                                        </td>
                                        <td>{row.customerName}</td>
                                        <td>
                                            <span className="gst-store-tag">
                                                {row.storeType}
                                            </span>
                                        </td>
                                        {showStatus && (
                                            <td>
                                                <span
                                                    className={`gst-status gst-status-${(
                                                        row.status || ""
                                                    ).toLowerCase()}`}
                                                >
                                                    {row.status}
                                                </span>
                                            </td>
                                        )}
                                        <td>{formatCurrency(row.subtotal)}</td>
                                        <td>
                                            {formatCurrency(row.totalDiscount)}
                                        </td>
                                        <td className="gst-cell-gst">
                                            {formatCurrency(row.totalTax)}
                                        </td>
                                        <td className="gst-cell-total">
                                            {formatCurrency(row.grandTotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ============= MAIN RENDER =============
    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="gst-module-wrapper">
                <div className="gst-content-wrapper">
                    {/* ===== HEADER / FILTERS ===== */}
                    <div className="gst-page-header">
                        <h2 className="gst-page-title">
                            <FaFileInvoiceDollar /> GST Report
                        </h2>

                        <div className="gst-filters">
                            {/* Date Range Preset */}
                            <div className="gst-filter-group">
                                <label>
                                    <FaCalendarAlt /> Period
                                </label>
                                <div className="gst-select-wrap">
                                    <select
                                        value={dateRange}
                                        onChange={(e) =>
                                            setDateRange(e.target.value)
                                        }
                                        className="gst-select"
                                    >
                                        {DATE_RANGE_OPTIONS.map((opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <FaChevronDown className="gst-select-arrow" />
                                </div>
                            </div>

                            {/* Custom From / To */}
                            {dateRange === "custom" && (
                                <>
                                    <div className="gst-filter-group">
                                        <label>From</label>
                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) =>
                                                setFromDate(e.target.value)
                                            }
                                            className="gst-input"
                                        />
                                    </div>
                                    <div className="gst-filter-group">
                                        <label>To</label>
                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) =>
                                                setToDate(e.target.value)
                                            }
                                            className="gst-input"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Store */}
                            <div className="gst-filter-group">
                                <label>
                                    <FaStore /> Store
                                </label>
                                <div className="gst-select-wrap">
                                    <select
                                        value={storeFilter}
                                        onChange={(e) =>
                                            setStoreFilter(e.target.value)
                                        }
                                        className="gst-select"
                                    >
                                        {STORE_OPTIONS.map((opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <FaChevronDown className="gst-select-arrow" />
                                </div>
                            </div>

                            {/* Export */}
                            <button
                                className="gst-export-btn"
                                onClick={exportToExcel}
                                disabled={
                                    isExporting || isLoading || !summary
                                }
                            >
                                {isExporting ? (
                                    <span className="gst-spinner-small" />
                                ) : (
                                    <FaFileExcel />
                                )}
                                {isExporting ? "Exporting..." : "Export Excel"}
                            </button>
                        </div>
                    </div>

                    {/* ===== BODY ===== */}
                    {isLoading ? (
                        <div className="gst-loading-container">
                            <div className="gst-loading-spinner" />
                            <p>Loading GST report...</p>
                        </div>
                    ) : !summary ? (
                        <div className="gst-empty-state">
                            <FaFileInvoiceDollar size={50} color="#ccc" />
                            <p>No data available for this period</p>
                        </div>
                    ) : (
                        <>
                            {renderSummary()}
                            {renderItemSummary()}
                            {renderOutputTable(
                                "Sales Invoices",
                                <FaFileInvoice />,
                                detailed?.sales,
                                {
                                    dateField: "saleDate",
                                    numberField: "invoiceNumber",
                                    numberLabel: "Invoice No",
                                }
                            )}
                            {renderOutputTable(
                                "AMC",
                                <FaRupeeSign />,
                                detailed?.amc,
                                {
                                    dateField: "createdAt",
                                    numberField: "amcNumber",
                                    numberLabel: "AMC No",
                                    showStatus: true,
                                }
                            )}
                            {renderOutputTable(
                                "Stamping",
                                <FaStamp />,
                                detailed?.stamping,
                                {
                                    dateField: "stampDate",
                                    numberField: "stampingNumber",
                                    numberLabel: "Stamping No",
                                }
                            )}
                            {renderOutputTable(
                                "Repairing",
                                <FaWrench />,
                                detailed?.repairing,
                                {
                                    dateField: "repairingDate",
                                    numberField: "repairingNumber",
                                    numberLabel: "Repairing No",
                                }
                            )}
                        </>
                    )}
                </div>
            </div>
        </Navbar>
    );
};

export default GstReport;