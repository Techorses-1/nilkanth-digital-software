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
    FaEye
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

const Dashboard = () => {
    const navigate = useNavigate();

    // ============= STATE =============
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [storeType, setStoreType] = useState("All");

    // ============= FETCH =============
    useEffect(() => {
        fetchDashboard();
    }, [storeType]);

    const fetchDashboard = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/dashboard/get-dashboard`,
                {
                    ...headers,
                    params: { storeType }
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

    // ============= LOADING / EMPTY =============
    if (isLoading) {
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

    if (!dashboardData) {
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

    const { stats, charts, alerts, recentSales } = dashboardData;

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
                    </div>
                </div>

                {/* ===== ROW 1: STAT CARDS ===== */}
                <div className="db-stats-grid">
                    {/* Today's Sales */}
                    <div className="db-stat-card db-stat-primary">
                        <div className="db-stat-icon">
                            <FaCalendarAlt />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">Today's Sales</span>
                            <span className="db-stat-value">{formatCurrency(stats.todaySales.total)}</span>
                            <span className="db-stat-sub">
                                <FaFileInvoice /> {stats.todaySales.count} invoices
                            </span>
                        </div>
                    </div>

                    {/* This Month */}
                    <div className="db-stat-card db-stat-success">
                        <div className="db-stat-icon">
                            <FaChartLine />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">This Month</span>
                            <span className="db-stat-value">{formatCurrency(stats.monthSales.total)}</span>
                            <span className="db-stat-sub">
                                <FaFileInvoice /> {stats.monthSales.count} invoices
                            </span>
                        </div>
                    </div>

                    {/* This Fiscal Year */}
                    <div className="db-stat-card db-stat-info">
                        <div className="db-stat-icon">
                            <FaRupeeSign />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">This Fiscal Year</span>
                            <span className="db-stat-value">{formatCurrency(stats.yearSales.total)}</span>
                            <span className="db-stat-sub">
                                <FaFileInvoice /> {stats.yearSales.count} invoices
                            </span>
                        </div>
                    </div>

                    {/* Customers */}
                    <div className="db-stat-card db-stat-warning">
                        <div className="db-stat-icon">
                            <FaUser />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">Customers</span>
                            <span className="db-stat-value">{stats.totalCustomers}</span>
                            <span className="db-stat-sub">Total registered</span>
                        </div>
                    </div>

                    {/* Products */}
                    <div className="db-stat-card db-stat-purple">
                        <div className="db-stat-icon">
                            <FaBox />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">Products</span>
                            <span className="db-stat-value">{stats.totalProducts}</span>
                            <span className="db-stat-sub">Master list</span>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="db-stat-card db-stat-teal">
                        <div className="db-stat-icon">
                            <FaBoxes />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">Items</span>
                            <span className="db-stat-value">{stats.totalItems}</span>
                            <span className="db-stat-sub">Master list</span>
                        </div>
                    </div>

                    {/* Active AMCs */}
                    <div className="db-stat-card db-stat-amber">
                        <div className="db-stat-icon">
                            <FaSyncAlt />
                        </div>
                        <div className="db-stat-content">
                            <span className="db-stat-label">Active AMCs</span>
                            <span className="db-stat-value">{stats.activeAmcs}</span>
                            <span className="db-stat-sub">Currently running</span>
                        </div>
                    </div>
                </div>

                {/* ===== ROW 2: CHARTS ===== */}
                <div className="db-charts-grid">
                    {/* Sales Last 12 Months */}
                    <div className="db-chart-card db-chart-wide">
                        <div className="db-chart-header">
                            <h3 className="db-chart-title">
                                <FaChartLine /> Sales — Last 12 Months
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

                    {/* Top Products */}
                    <div className="db-chart-card db-chart-wide">
                        <div className="db-chart-header">
                            <h3 className="db-chart-title">
                                <FaChartBar /> Top 5 Products (This Year)
                            </h3>
                        </div>
                        <div className="db-chart-body">
                            {charts.topProducts.length === 0 ? (
                                <div className="db-chart-empty">No products sold yet this year</div>
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
                                            formatter={(value) => [value, 'Qty Sold']}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }}
                                        />
                                        <Bar dataKey="totalQty" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Sales by Type */}
                    <div className="db-chart-card db-chart-small">
                        <div className="db-chart-header">
                            <h3 className="db-chart-title">
                                <FaChartPie /> Sales by Type
                            </h3>
                        </div>
                        <div className="db-chart-body">
                            {(charts.salesByType.gst + charts.salesByType.nonGst + charts.salesByType.challan) === 0 ? (
                                <div className="db-chart-empty">No sales this year</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'GST', value: charts.salesByType.gst },
                                                { name: 'Non-GST', value: charts.salesByType.nonGst },
                                                { name: 'Challan', value: charts.salesByType.challan }
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
                                            {PIE_COLORS_TYPE.map((color, index) => (
                                                <Cell key={`cell-${index}`} fill={color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Sales by Payment */}
                    <div className="db-chart-card db-chart-small">
                        <div className="db-chart-header">
                            <h3 className="db-chart-title">
                                <FaChartPie /> Payment Status
                            </h3>
                        </div>
                        <div className="db-chart-body">
                            {(charts.salesByPayment.paid + charts.salesByPayment.pending) === 0 ? (
                                <div className="db-chart-empty">No sales this year</div>
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
                    {/* Pending Payments */}
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
                                        <li key={item.saleId} className="db-alert-item">
                                            <div className="db-alert-item-row">
                                                <span className="db-alert-item-title">
                                                    {item.invoiceNumber}
                                                </span>
                                                <span className="db-alert-item-amount">
                                                    {formatCurrencyFull(item.grandTotal)}
                                                </span>
                                            </div>
                                            <div className="db-alert-item-sub">
                                                <span>{item.customerName}</span>
                                                <span>{formatDate(item.saleDate)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* AMC Renewals Due */}
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

                    {/* Stampings Due */}
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

                {/* ===== ROW 4: RECENT SALES ===== */}
                <div className="db-recent-card">
                    <div className="db-recent-header">
                        <h3 className="db-recent-title">
                            <FaFileInvoice /> Recent Sales
                        </h3>
                        <button
                            className="db-recent-view-all"
                            onClick={() => navigate('/')}
                        >
                            View All <FaArrowRight />
                        </button>
                    </div>
                    <div className="db-recent-body">
                        {recentSales.length === 0 ? (
                            <div className="db-recent-empty">No recent sales</div>
                        ) : (
                            <div className="db-recent-table-wrap">
                                <table className="db-recent-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Invoice No</th>
                                            <th>Customer</th>
                                            <th>Type</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentSales.map((sale, idx) => {
                                            const type = sale.isChallan
                                                ? 'Challan'
                                                : (sale.isGstMode ? 'GST' : 'Non-GST');
                                            return (
                                                <tr key={sale.saleId}>
                                                    <td>{idx + 1}</td>
                                                    <td className="db-recent-invoice">
                                                        <strong>{sale.invoiceNumber}</strong>
                                                    </td>
                                                    <td>{sale.customerName}</td>
                                                    <td>
                                                        <span className={`db-recent-tag db-recent-tag-${type === 'Challan' ? 'challan' : (type === 'GST' ? 'gst' : 'nongst')}`}>
                                                            {type}
                                                        </span>
                                                    </td>
                                                    <td className="db-recent-amount">
                                                        {formatCurrencyFull(sale.grandTotal)}
                                                    </td>
                                                    <td>
                                                        <span className={`db-recent-status db-recent-status-${sale.paymentStatus === 'Paid' ? 'paid' : 'pending'}`}>
                                                            {sale.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />}
                                                            {' '}{sale.paymentStatus || 'Paid'}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(sale.saleDate)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </Navbar>
    );
};

export default Dashboard;