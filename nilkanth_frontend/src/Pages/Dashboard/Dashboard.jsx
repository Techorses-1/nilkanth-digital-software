import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaRupeeSign,
    FaFileInvoice,
    FaUser,
    FaBox,
    FaBoxes,
    FaSyncAlt,
    FaStamp,
    FaExclamationTriangle,
    FaClock,
    FaCalendarAlt,
    FaCheckCircle,
    FaTools,
    FaChartLine,
    FaChartPie,
    FaChartBar,
    FaStore,
    FaArrowRight,
    FaArrowUp,
    FaArrowDown,
    FaBalanceScale,
    FaFileInvoiceDollar,
    FaWrench,
    FaChevronDown
} from "react-icons/fa";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import "./Dashboard.scss";
import "react-toastify/dist/ReactToastify.css";

// ===== Auth Headers =====
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };
};

// ===== Store Options =====
const STORE_FILTER_OPTIONS = [
    { value: "All", label: "All Stores" },
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

// ===== Module Toggle Options =====
const MODULE_OPTIONS = [
    { value: "Sales", label: "Sales", icon: FaFileInvoice },
    { value: "AMC", label: "AMC", icon: FaSyncAlt },
    { value: "Repairing", label: "Repairing", icon: FaTools },
    { value: "Stamping", label: "Stamping", icon: FaStamp },
    { value: "GST", label: "GST Info", icon: FaFileInvoiceDollar }
];

// ===== GST Date Range Options =====
const GST_DATE_RANGE_OPTIONS = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "last_6_months", label: "Last 6 Months" },
    { value: "this_year", label: "This Year" },
    { value: "current_fy", label: "Current Financial Year" },
    { value: "custom", label: "Custom" },
];

const GST_STORE_OPTIONS = [
    { value: "Both", label: "Both Stores" },
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

// ===== React-Select Styles =====
const selectStyles = {
    control: (base) => ({
        ...base,
        minHeight: '40px',
        borderColor: '#ddd',
        borderRadius: '30px',
        boxShadow: 'none',
        '&:hover': { borderColor: '#7366ff' }
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#f0f0ff' : 'white',
        color: '#333',
        cursor: 'pointer',
        '&:active': { backgroundColor: '#e8e8ff' }
    }),
    placeholder: (base) => ({ ...base, color: '#999' }),
    menu: (base) => ({ ...base, zIndex: 999 })
};

// ===== Chart Colors =====
const CHART_COLORS = {
    primary: '#7366ff',
    secondary: '#948cff',
    green: '#28a745',
    orange: '#ff9800',
    red: '#dc3545',
    blue: '#4a6cf7',
    teal: '#20c997',
    amber: '#ffb74d',
    pink: '#e83e8c',
    cyan: '#17a2b8'
};

const PIE_COLORS_TYPE = ['#7366ff', '#ff9800', '#4a6cf7'];
const PIE_COLORS_PAYMENT = ['#28a745', '#ffc107'];

// ===== Format Helpers =====
const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0";
    return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatCurrencyFull = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return `₹${Number(val).toFixed(2)}`;
};

const formatCurrency2 = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ===== GST date math helpers =====
const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const getGstRangeForPreset = (preset) => {
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
            const month = today.getMonth();
            if (month >= 3) {
                from = new Date(year, 3, 1);
                to = new Date(year + 1, 2, 31);
            } else {
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

// ===== Module badge color =====
const getModuleBadgeClass = (module) => {
    switch (module) {
        case 'Sales': return 'db-module-badge-sales';
        case 'AMC': return 'db-module-badge-amc';
        case 'Repairing': return 'db-module-badge-repairing';
        case 'Stamping': return 'db-module-badge-stamping';
        default: return '';
    }
};

const Dashboard = () => {
    const navigate = useNavigate();

    // ============= STATE =============
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [storeType, setStoreType] = useState("All");
    const [activeModule, setActiveModule] = useState("Sales");

    // ============= GST STATE =============
    const [gstDateRange, setGstDateRange] = useState("this_month");
    const [gstFromDate, setGstFromDate] = useState("");
    const [gstToDate, setGstToDate] = useState("");
    const [gstStoreFilter, setGstStoreFilter] = useState("Both");
    const [gstSummary, setGstSummary] = useState(null);
    const [gstDetailed, setGstDetailed] = useState(null);
    const [gstLoading, setGstLoading] = useState(false);

    // ============= FETCH DASHBOARD (module data) =============
    useEffect(() => {
        // Only fetch dashboard module data when NOT on GST toggle
        if (activeModule === 'GST') return;
        fetchDashboard();
    }, [storeType, activeModule]);

    // ============= INIT GST DATE RANGE =============
    useEffect(() => {
        if (activeModule !== 'GST') return;
        if (gstDateRange !== "custom") {
            const { from, to } = getGstRangeForPreset(gstDateRange);
            setGstFromDate(from);
            setGstToDate(to);
        }
    }, [gstDateRange, activeModule]);

    // ============= FETCH GST DATA =============
    useEffect(() => {
        if (activeModule !== 'GST') return;
        if (gstDateRange === "custom" && (!gstFromDate || !gstToDate)) return;
        if (!gstFromDate || !gstToDate) return;
        fetchGstData();
        // eslint-disable-next-line
    }, [gstFromDate, gstToDate, gstStoreFilter, gstDateRange, activeModule]);

    const fetchDashboard = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/dashboard/get-dashboard`,
                {
                    ...headers,
                    params: { storeType, module: activeModule }
                }
            );

            if (response.data.success) {
                setDashboardData(response.data.data);
            } else {
                setDashboardData(null);
            }
        } catch (error) {
            console.error("Error fetching dashboard:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error(error.response?.data?.message || "Failed to load dashboard");
            }
            setDashboardData(null);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGstData = async () => {
        if (!gstFromDate || !gstToDate) return;
        setGstLoading(true);
        try {
            const headers = getAuthHeaders();
            const params = {
                dateFrom: gstFromDate,
                dateTo: gstToDate,
                storeType: gstStoreFilter,
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
                setGstSummary(summaryRes.data.data);
            }
            if (detailedRes.data.success) {
                setGstDetailed(detailedRes.data.data);
            }
        } catch (error) {
            console.error("Error fetching GST report:", error);
            toast.error(
                error.response?.data?.message || "Failed to load GST report"
            );
        } finally {
            setGstLoading(false);
        }
    };

    // ============= LOADING / EMPTY =============
    if (isLoading && activeModule !== 'GST') {
        return (
            <Navbar>
                <div className="db-module-wrapper">
                    <div className="db-loading-container">
                        <div className="db-loading-spinner"></div>
                        <p>Loading dashboard...</p>
                    </div>
                </div>
            </Navbar>
        );
    }

    if (!dashboardData && activeModule !== 'GST') {
        return (
            <Navbar>
                <ToastContainer position="top-center" autoClose={3000} />
                <div className="db-module-wrapper">
                    <div className="db-empty-state">
                        <FaExclamationTriangle size={50} color="#ccc" />
                        <p>Failed to load dashboard data</p>
                        <button className="db-retry-btn" onClick={fetchDashboard}>
                            Retry
                        </button>
                    </div>
                </div>
            </Navbar>
        );
    }

    // ============= GST RENDER HELPERS =============
    const renderGstSummary = () => {
        if (!gstSummary) return null;
        const { outputGst, inputGst, netGst, isCredit } = gstSummary;

        return (
            <>
                <div className="gst-summary-cards">
                    <div className="gst-card gst-card-output">
                        <div className="gst-card-icon"><FaArrowUp /></div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">Total Output GST</span>
                            <span className="gst-card-value">{formatCurrency2(outputGst.total)}</span>
                            <span className="gst-card-sub">Collected from customers</span>
                        </div>
                    </div>

                    <div className="gst-card gst-card-input">
                        <div className="gst-card-icon"><FaArrowDown /></div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">Total Input GST</span>
                            <span className="gst-card-value">{formatCurrency2(inputGst.total)}</span>
                            <span className="gst-card-sub">Paid on item purchases</span>
                        </div>
                    </div>

                    <div className={`gst-card ${isCredit ? "gst-card-credit" : "gst-card-payable"}`}>
                        <div className="gst-card-icon"><FaBalanceScale /></div>
                        <div className="gst-card-content">
                            <span className="gst-card-label">
                                {isCredit ? "GST Credit" : "Net GST Payable"}
                            </span>
                            <span className="gst-card-value">{formatCurrency2(Math.abs(netGst))}</span>
                            <span className="gst-card-sub">
                                {isCredit ? "Input exceeds Output" : "Output exceeds Input"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="gst-breakdown-card">
                    <h3 className="gst-section-title">
                        <FaFileInvoiceDollar /> Output GST Breakdown
                    </h3>
                    <div className="gst-breakdown-grid">
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label"><FaFileInvoice /> Sales</span>
                            <span className="gst-breakdown-value">{formatCurrency2(outputGst.sales)}</span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label"><FaRupeeSign /> AMC</span>
                            <span className="gst-breakdown-value">{formatCurrency2(outputGst.amc)}</span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label"><FaStamp /> Stamping</span>
                            <span className="gst-breakdown-value">{formatCurrency2(outputGst.stamping)}</span>
                        </div>
                        <div className="gst-breakdown-item">
                            <span className="gst-breakdown-label"><FaWrench /> Repairing</span>
                            <span className="gst-breakdown-value">{formatCurrency2(outputGst.repairing)}</span>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    const renderGstItemSummary = () => {
        if (!gstDetailed) return null;
        const items = gstDetailed.itemSummary || [];

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
                                        <td className="gst-cell-bold">{it.itemName}</td>
                                        <td><span className="gst-store-tag">{it.storeType}</span></td>
                                        <td>{it.totalQty}</td>
                                        <td>{formatCurrency2(it.subtotalExclGst)}</td>
                                        <td className="gst-cell-gst">{formatCurrency2(it.gst)}</td>
                                        <td className="gst-cell-total">{formatCurrency2(it.totalWithGst)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderGstOutputTable = (title, icon, list, config) => {
        const { dateField, numberField, numberLabel, showStatus = false } = config;

        return (
            <div className="gst-table-card">
                <h3 className="gst-section-title">{icon} {title}</h3>
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
                                        <td className="gst-cell-bold">{row[numberField]}</td>
                                        <td>{row.customerName}</td>
                                        <td><span className="gst-store-tag">{row.storeType}</span></td>
                                        {showStatus && (
                                            <td>
                                                <span className={`gst-status gst-status-${(row.status || "").toLowerCase()}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        )}
                                        <td>{formatCurrency2(row.subtotal)}</td>
                                        <td>{formatCurrency2(row.totalDiscount)}</td>
                                        <td className="gst-cell-gst">{formatCurrency2(row.totalTax)}</td>
                                        <td className="gst-cell-total">{formatCurrency2(row.grandTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ============= GST FULL VIEW =============
    const renderGstView = () => (
        <div className="db-gst-inline-view">
            {/* GST Filters */}
            <div className="db-gst-filters">
                <div className="db-gst-filter-group">
                    <label><FaCalendarAlt /> Period</label>
                    <div className="db-gst-select-wrap">
                        <select
                            value={gstDateRange}
                            onChange={(e) => setGstDateRange(e.target.value)}
                            className="db-gst-select"
                        >
                            {GST_DATE_RANGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <FaChevronDown className="db-gst-select-arrow" />
                    </div>
                </div>

                {gstDateRange === "custom" && (
                    <>
                        <div className="db-gst-filter-group">
                            <label>From</label>
                            <input
                                type="date"
                                value={gstFromDate}
                                onChange={(e) => setGstFromDate(e.target.value)}
                                className="db-gst-input"
                            />
                        </div>
                        <div className="db-gst-filter-group">
                            <label>To</label>
                            <input
                                type="date"
                                value={gstToDate}
                                onChange={(e) => setGstToDate(e.target.value)}
                                className="db-gst-input"
                            />
                        </div>
                    </>
                )}

                <div className="db-gst-filter-group">
                    <label><FaStore /> Store</label>
                    <div className="db-gst-select-wrap">
                        <select
                            value={gstStoreFilter}
                            onChange={(e) => setGstStoreFilter(e.target.value)}
                            className="db-gst-select"
                        >
                            {GST_STORE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <FaChevronDown className="db-gst-select-arrow" />
                    </div>
                </div>
            </div>

            {/* GST Body */}
            {gstLoading ? (
                <div className="db-loading-container">
                    <div className="db-loading-spinner"></div>
                    <p>Loading GST report...</p>
                </div>
            ) : !gstSummary ? (
                <div className="db-empty-state">
                    <FaFileInvoiceDollar size={50} color="#ccc" />
                    <p>No data available for this period</p>
                </div>
            ) : (
                <>
                    {renderGstSummary()}
                    {renderGstItemSummary()}
                    {renderGstOutputTable("Sales Invoices", <FaFileInvoice />, gstDetailed?.sales, {
                        dateField: "saleDate",
                        numberField: "invoiceNumber",
                        numberLabel: "Invoice No",
                    })}
                    {renderGstOutputTable("AMC", <FaRupeeSign />, gstDetailed?.amc, {
                        dateField: "createdAt",
                        numberField: "amcNumber",
                        numberLabel: "AMC No",
                        showStatus: true,
                    })}
                    {renderGstOutputTable("Stamping", <FaStamp />, gstDetailed?.stamping, {
                        dateField: "stampDate",
                        numberField: "stampingNumber",
                        numberLabel: "Stamping No",
                    })}
                    {renderGstOutputTable("Repairing", <FaWrench />, gstDetailed?.repairing, {
                        dateField: "repairingDate",
                        numberField: "repairingNumber",
                        numberLabel: "Repairing No",
                    })}
                </>
            )}
        </div>
    );

    // ===== Module labels =====
    const moduleLabel = activeModule;
    const moduleInvoiceWord = activeModule === 'Sales' ? 'invoices'
        : activeModule === 'AMC' ? 'AMCs'
            : activeModule === 'Repairing' ? 'repairings'
                : 'stampings';
    const showChallan = activeModule === 'Sales';

    // Extract module data safely
    const stats = dashboardData?.stats;
    const charts = dashboardData?.charts;
    const alerts = dashboardData?.alerts;
    const recentRecords = dashboardData?.recentRecords;

    // ============= MAIN RENDER =============
    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="db-module-wrapper">

                {/* ===== HEADER ===== */}
                <div className="db-header">
                    <div className="db-header-left">
                        <h2 className="db-page-title">
                            <FaChartLine /> Dashboard
                        </h2>
                        <p className="db-page-subtitle">
                            Business overview at a glance
                        </p>
                    </div>

                    <div className="db-header-right">
                        {/* Store filter is hidden when GST toggle is active (GST has its own store filter) */}
                        {activeModule !== 'GST' && (
                            <div className="db-store-filter">
                                <FaStore className="db-filter-icon" />
                                <Select
                                    options={STORE_FILTER_OPTIONS}
                                    styles={selectStyles}
                                    className="db-store-select"
                                    classNamePrefix="db-select"
                                    isSearchable={false}
                                    value={STORE_FILTER_OPTIONS.find(o => o.value === storeType)}
                                    onChange={(option) => setStoreType(option?.value || "All")}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== MODULE TOGGLE ===== */}
                <div className="db-module-toggle">
                    {MODULE_OPTIONS.map((mod) => {
                        const Icon = mod.icon;
                        const isActive = activeModule === mod.value;
                        return (
                            <button
                                key={mod.value}
                                className={`db-module-toggle-btn ${isActive ? 'db-module-toggle-active' : ''}`}
                                onClick={() => setActiveModule(mod.value)}
                            >
                                <Icon />
                                <span>{mod.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ===== CONDITIONAL BODY ===== */}
                {activeModule === 'GST' ? (
                    renderGstView()
                ) : (
                    <>
                        {/* ===== ROW 1: STAT CARDS ===== */}
                        <div className="db-stats-grid">
                            <div className="db-stat-card db-stat-primary">
                                <div className="db-stat-icon"><FaCalendarAlt /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">Today's {moduleLabel}</span>
                                    <span className="db-stat-value">{formatCurrency(stats.todayModule.total)}</span>
                                    <span className="db-stat-sub">
                                        <FaFileInvoice /> {stats.todayModule.count} {moduleInvoiceWord}
                                    </span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-success">
                                <div className="db-stat-icon"><FaChartLine /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">This Month</span>
                                    <span className="db-stat-value">{formatCurrency(stats.monthModule.total)}</span>
                                    <span className="db-stat-sub">
                                        <FaFileInvoice /> {stats.monthModule.count} {moduleInvoiceWord}
                                    </span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-info">
                                <div className="db-stat-icon"><FaRupeeSign /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">This Fiscal Year</span>
                                    <span className="db-stat-value">{formatCurrency(stats.yearModule.total)}</span>
                                    <span className="db-stat-sub">
                                        <FaFileInvoice /> {stats.yearModule.count} {moduleInvoiceWord}
                                    </span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-warning">
                                <div className="db-stat-icon"><FaUser /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">Customers</span>
                                    <span className="db-stat-value">{stats.totalCustomers}</span>
                                    <span className="db-stat-sub">Total registered</span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-purple">
                                <div className="db-stat-icon"><FaBox /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">Products</span>
                                    <span className="db-stat-value">{stats.totalProducts}</span>
                                    <span className="db-stat-sub">Master list</span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-teal">
                                <div className="db-stat-icon"><FaBoxes /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">Items</span>
                                    <span className="db-stat-value">{stats.totalItems}</span>
                                    <span className="db-stat-sub">Master list</span>
                                </div>
                            </div>

                            <div className="db-stat-card db-stat-amber">
                                <div className="db-stat-icon"><FaSyncAlt /></div>
                                <div className="db-stat-content">
                                    <span className="db-stat-label">Active AMCs</span>
                                    <span className="db-stat-value">{stats.activeAmcs}</span>
                                    <span className="db-stat-sub">Currently running</span>
                                </div>
                            </div>
                        </div>

                        {/* ===== ROW 2: CHARTS ===== */}
                        <div className="db-charts-grid">
                            <div className="db-chart-card db-chart-wide">
                                <div className="db-chart-header">
                                    <h3 className="db-chart-title">
                                        <FaChartLine /> {moduleLabel} — Last 12 Months
                                    </h3>
                                </div>
                                <div className="db-chart-body">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={charts.salesLast12Months}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip
                                                formatter={(value) => formatCurrencyFull(value)}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="total"
                                                stroke={CHART_COLORS.primary}
                                                strokeWidth={3}
                                                dot={{ r: 4 }}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="db-chart-card db-chart-wide">
                                <div className="db-chart-header">
                                    <h3 className="db-chart-title">
                                        <FaChartBar /> Top 5 Products — {moduleLabel} (This Year)
                                    </h3>
                                </div>
                                <div className="db-chart-body">
                                    {charts.topProducts.length === 0 ? (
                                        <div className="db-chart-empty">No products in {moduleLabel} yet this year</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart
                                                data={charts.topProducts}
                                                layout="vertical"
                                                margin={{ left: 20, right: 20 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="productName"
                                                    width={110}
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <Tooltip
                                                    formatter={(value) => [value, 'Qty']}
                                                    contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }}
                                                />
                                                <Bar dataKey="totalQty" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            <div className="db-chart-card db-chart-small">
                                <div className="db-chart-header">
                                    <h3 className="db-chart-title">
                                        <FaChartPie /> {moduleLabel} by Type
                                    </h3>
                                </div>
                                <div className="db-chart-body">
                                    {(() => {
                                        const total = showChallan
                                            ? charts.salesByType.gst + charts.salesByType.nonGst + charts.salesByType.challan
                                            : charts.salesByType.gst + charts.salesByType.nonGst;
                                        if (total === 0) {
                                            return <div className="db-chart-empty">No {moduleLabel} this year</div>;
                                        }
                                        const pieData = showChallan
                                            ? [
                                                { name: 'GST', value: charts.salesByType.gst },
                                                { name: 'Non-GST', value: charts.salesByType.nonGst },
                                                { name: 'Challan', value: charts.salesByType.challan }
                                            ]
                                            : [
                                                { name: 'GST', value: charts.salesByType.gst },
                                                { name: 'Non-GST', value: charts.salesByType.nonGst }
                                            ];
                                        return (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={80}
                                                        paddingAngle={3}
                                                        label={({ name, value }) => `${name}: ${value}`}
                                                        labelLine={{ stroke: '#ccc' }}
                                                    >
                                                        {pieData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={PIE_COLORS_TYPE[index % PIE_COLORS_TYPE.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="db-chart-card db-chart-small">
                                <div className="db-chart-header">
                                    <h3 className="db-chart-title">
                                        <FaChartPie /> Payment Status
                                    </h3>
                                </div>
                                <div className="db-chart-body">
                                    {(charts.salesByPayment.paid + charts.salesByPayment.pending) === 0 ? (
                                        <div className="db-chart-empty">No {moduleLabel} this year</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Paid', value: charts.salesByPayment.paid },
                                                        { name: 'Pending', value: charts.salesByPayment.pending }
                                                    ]}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={80}
                                                    paddingAngle={3}
                                                    label={({ name, value }) => `${name}: ${value}`}
                                                    labelLine={{ stroke: '#ccc' }}
                                                >
                                                    {PIE_COLORS_PAYMENT.map((color, index) => (
                                                        <Cell key={`cell-${index}`} fill={color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ===== ROW 3: ALERTS ===== */}
                        <div className="db-alerts-grid">
                            <div className="db-alert-card db-alert-danger">
                                <div className="db-alert-header">
                                    <h3 className="db-alert-title">
                                        <FaExclamationTriangle /> Pending Payments
                                    </h3>
                                    <span className="db-alert-count">
                                        {alerts.pendingPayments.length}
                                    </span>
                                </div>
                                <div className="db-alert-body">
                                    {alerts.pendingPayments.length === 0 ? (
                                        <div className="db-alert-empty">
                                            <FaCheckCircle /> All payments are clear
                                        </div>
                                    ) : (
                                        <ul className="db-alert-list">
                                            {alerts.pendingPayments.map((item) => (
                                                <li key={`${item.module}-${item.id}`} className="db-alert-item">
                                                    <div className="db-alert-item-row">
                                                        <span className="db-alert-item-title">
                                                            <span className={`db-module-badge ${getModuleBadgeClass(item.module)}`}>
                                                                {item.module}
                                                            </span>
                                                            {item.number}
                                                        </span>
                                                        <span className="db-alert-item-amount">
                                                            {formatCurrencyFull(item.grandTotal)}
                                                        </span>
                                                    </div>
                                                    <div className="db-alert-item-sub">
                                                        <span>{item.customerName}</span>
                                                        <span>{formatDate(item.date)}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="db-alert-card db-alert-warning">
                                <div className="db-alert-header">
                                    <h3 className="db-alert-title">
                                        <FaSyncAlt /> AMC Renewals Due
                                    </h3>
                                    <span className="db-alert-count">
                                        {alerts.amcRenewalsDue.length}
                                    </span>
                                </div>
                                <div className="db-alert-body">
                                    {alerts.amcRenewalsDue.length === 0 ? (
                                        <div className="db-alert-empty">
                                            <FaCheckCircle /> No renewals due soon
                                        </div>
                                    ) : (
                                        <ul className="db-alert-list">
                                            {alerts.amcRenewalsDue.map((item) => (
                                                <li key={item.amcId} className="db-alert-item">
                                                    <div className="db-alert-item-row">
                                                        <span className="db-alert-item-title">
                                                            {item.amcNumber}
                                                        </span>
                                                        <span className="db-alert-item-days">
                                                            <FaClock /> {item.daysLeft}d
                                                        </span>
                                                    </div>
                                                    <div className="db-alert-item-sub">
                                                        <span>{item.customerName}</span>
                                                        <span>{formatDate(item.endDate)}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="db-alert-card db-alert-info">
                                <div className="db-alert-header">
                                    <h3 className="db-alert-title">
                                        <FaStamp /> Stampings Due
                                    </h3>
                                    <span className="db-alert-count">
                                        {alerts.stampingsDue.length}
                                    </span>
                                </div>
                                <div className="db-alert-body">
                                    {alerts.stampingsDue.length === 0 ? (
                                        <div className="db-alert-empty">
                                            <FaCheckCircle /> No stampings due soon
                                        </div>
                                    ) : (
                                        <ul className="db-alert-list">
                                            {alerts.stampingsDue.map((item) => (
                                                <li key={item.unitId} className="db-alert-item">
                                                    <div className="db-alert-item-row">
                                                        <span className="db-alert-item-title">
                                                            {item.uniqueNumber}
                                                        </span>
                                                        <span className="db-alert-item-days">
                                                            <FaClock /> {item.daysLeft}d
                                                        </span>
                                                    </div>
                                                    <div className="db-alert-item-sub">
                                                        <span>{item.productName}</span>
                                                        <span>{item.customerName}</span>
                                                    </div>
                                                    <div className="db-alert-item-sub">
                                                        <span>Due: {formatDate(item.nextDueDate)}</span>
                                                        <span>{item.storeType}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ===== ROW 4: RECENT ===== */}
                        <div className="db-recent-card">
                            <div className="db-recent-header">
                                <h3 className="db-recent-title">
                                    <FaFileInvoice /> Recent {moduleLabel}
                                </h3>
                                <button
                                    className="db-recent-view-all"
                                    onClick={() => {
                                        const routes = {
                                            Sales: '/',
                                            AMC: '/amc',
                                            Repairing: '/repairing',
                                            Stamping: '/stamping'
                                        };
                                        navigate(routes[activeModule] || '/');
                                    }}
                                >
                                    View All <FaArrowRight />
                                </button>
                            </div>
                            <div className="db-recent-body">
                                {recentRecords.length === 0 ? (
                                    <div className="db-recent-empty">No recent {moduleLabel.toLowerCase()} records</div>
                                ) : (
                                    <div className="db-recent-table-wrap">
                                        <table className="db-recent-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Number</th>
                                                    <th>Customer</th>
                                                    <th>Type</th>
                                                    <th>Amount</th>
                                                    <th>Status</th>
                                                    <th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentRecords.map((rec, idx) => {
                                                    const type = rec.isChallan
                                                        ? 'Challan'
                                                        : (rec.isGstMode ? 'GST' : 'Non-GST');
                                                    return (
                                                        <tr key={rec.id}>
                                                            <td>{idx + 1}</td>
                                                            <td className="db-recent-invoice">
                                                                <strong>{rec.number}</strong>
                                                            </td>
                                                            <td>{rec.customerName}</td>
                                                            <td>
                                                                <span className={`db-recent-tag db-recent-tag-${type === 'Challan' ? 'challan' : (type === 'GST' ? 'gst' : 'nongst')}`}>
                                                                    {type}
                                                                </span>
                                                            </td>
                                                            <td className="db-recent-amount">
                                                                {formatCurrencyFull(rec.grandTotal)}
                                                            </td>
                                                            <td>
                                                                <span className={`db-recent-status db-recent-status-${rec.paymentStatus === 'Paid' ? 'paid' : 'pending'}`}>
                                                                    {rec.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />}
                                                                    {' '}{rec.paymentStatus || 'Paid'}
                                                                </span>
                                                            </td>
                                                            <td>{formatDate(rec.date)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

            </div>
        </Navbar>
    );
};

export default Dashboard;