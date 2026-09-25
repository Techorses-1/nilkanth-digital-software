import React, { useState, useEffect } from 'react';
import Navbar from '../../Components/Sidebar/Navbar';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import {
    FaFileExport,
    FaDownload,
    FaCalendarAlt,
    FaBoxes,
    FaArrowUp,
    FaArrowDown,
    FaRupeeSign,
    FaExclamationTriangle,
    FaTimesCircle,
    FaChartLine,
    FaEye,
    FaTags // NEW ICON for selling price
} from 'react-icons/fa';
import './ProductReports.scss';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ProductReports = () => {
    // State for date filters
    const [dateRange, setDateRange] = useState('today');
    const [customStartDate, setCustomStartDate] = useState(null);
    const [customEndDate, setCustomEndDate] = useState(null);
    const [showCustomPicker, setShowCustomPicker] = useState(false);

    // State for data
    const [metrics, setMetrics] = useState({
        dateFiltered: {
            totalInward: 0,
            totalOutward: 0,
            avgPurchasePrice: 0,
            avgSellingPrice: 0, // NEW FIELD
            totalValue: 0,
            productsMoved: 0
        },
        alwaysLive: {
            totalProducts: 0,
            lowStock: { count: 0, products: [] },
            outOfStock: { count: 0, products: [] }
        }
    });

    const [topOutwardProducts, setTopOutwardProducts] = useState([]);
    const [inwardTransactions, setInwardTransactions] = useState([]);
    const [outwardTransactions, setOutwardTransactions] = useState([]);

    // Loading states
    const [loading, setLoading] = useState({
        metrics: false,
        topOutward: false,
        inward: false,
        outward: false
    });

    // Modal states
    const [showLowStockModal, setShowLowStockModal] = useState(false);
    const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [modalTitle, setModalTitle] = useState('');

    // Date filter options
    const dateFilterOptions = [
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'This Week' },
        { id: 'month', label: 'This Month' },
        { id: 'lastMonth', label: 'Last Month' },
        { id: 'custom', label: 'Custom' }
    ];

    // FIXED VERSION - Handle custom dates correctly
    const getDateRange = (range) => {
        const now = new Date();

        // Create dates in UTC to avoid timezone shifts
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        switch (range) {
            case 'today':
                return {
                    fromDate: todayUTC.toISOString().split('T')[0],
                    toDate: todayUTC.toISOString().split('T')[0]
                };

            case 'week': {
                const startOfWeek = new Date(todayUTC);
                startOfWeek.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
                return {
                    fromDate: startOfWeek.toISOString().split('T')[0],
                    toDate: endOfWeek.toISOString().split('T')[0]
                };
            }

            case 'month': {
                const startOfMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1));
                const endOfMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 0));
                return {
                    fromDate: startOfMonth.toISOString().split('T')[0],
                    toDate: endOfMonth.toISOString().split('T')[0]
                };
            }

            case 'lastMonth': {
                const startOfLastMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1));
                const endOfLastMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 0));
                return {
                    fromDate: startOfLastMonth.toISOString().split('T')[0],
                    toDate: endOfLastMonth.toISOString().split('T')[0]
                };
            }

            case 'custom':
                if (customStartDate && customEndDate) {
                    const startYear = customStartDate.getFullYear();
                    const startMonth = customStartDate.getMonth();
                    const startDay = customStartDate.getDate();

                    const endYear = customEndDate.getFullYear();
                    const endMonth = customEndDate.getMonth();
                    const endDay = customEndDate.getDate();

                    const startUTC = new Date(Date.UTC(startYear, startMonth, startDay));
                    const endUTC = new Date(Date.UTC(endYear, endMonth, endDay));

                    return {
                        fromDate: startUTC.toISOString().split('T')[0],
                        toDate: endUTC.toISOString().split('T')[0]
                    };
                }
                return null;

            default:
                return null;
        }
    };

    // Fetch all data
    const fetchAllData = async () => {
        const dateParams = getDateRange(dateRange);
        if (!dateParams && dateRange === 'custom') {
            toast.warning('Please select both start and end dates');
            return;
        }

        setLoading({
            metrics: true,
            topOutward: true,
            inward: true,
            outward: true
        });

        try {
            // Fetch metrics
            const metricsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/report/metrics`, {
                params: dateParams
            });
            if (metricsResponse.data.success) {
                setMetrics(metricsResponse.data.data);
            }

            // Fetch top outward products
            if (dateParams) {
                const topOutwardResponse = await axios.get(`${import.meta.env.VITE_API_URL}/report/top-outward`, {
                    params: { ...dateParams, limit: 5 }
                });
                if (topOutwardResponse.data.success) {
                    setTopOutwardProducts(topOutwardResponse.data.data);
                }
            }

            // Fetch inward transactions
            if (dateParams) {
                const inwardResponse = await axios.get(`${import.meta.env.VITE_API_URL}/report/inward-transactions`, {
                    params: dateParams
                });
                if (inwardResponse.data.success) {
                    setInwardTransactions(inwardResponse.data.data);
                }
            }

            // Fetch outward transactions
            if (dateParams) {
                const outwardResponse = await axios.get(`${import.meta.env.VITE_API_URL}/report/outward-transactions`, {
                    params: dateParams
                });
                if (outwardResponse.data.success) {
                    setOutwardTransactions(outwardResponse.data.data);
                }
            }

        } catch (error) {
            console.error("Error fetching report data:", error);
            toast.error("Failed to fetch report data");
        } finally {
            setLoading({
                metrics: false,
                topOutward: false,
                inward: false,
                outward: false
            });
        }
    };

    // Fetch data on mount and when filters change
    useEffect(() => {
        fetchAllData();
    }, [dateRange, customStartDate, customEndDate]);

    // Handle date filter change
    const handleDateFilterChange = (rangeId) => {
        setDateRange(rangeId);
        if (rangeId === 'custom') {
            setShowCustomPicker(true);
        } else {
            setShowCustomPicker(false);
        }
    };

    // Handle card clicks
    const handleLowStockClick = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/report/low-stock`);
            if (response.data.success) {
                setSelectedProducts(response.data.data);
                setModalTitle('Low Stock Products');
                setShowLowStockModal(true);
            }
        } catch (error) {
            console.error("Error fetching low stock products:", error);
            toast.error("Failed to fetch low stock products");
        }
    };

    const handleOutOfStockClick = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/report/out-of-stock`);
            if (response.data.success) {
                setSelectedProducts(response.data.data);
                setModalTitle('Out of Stock Products');
                setShowOutOfStockModal(true);
            }
        } catch (error) {
            console.error("Error fetching out of stock products:", error);
            toast.error("Failed to fetch out of stock products");
        }
    };

    // Export functions
    const exportMasterReport = async () => {
        const dateParams = getDateRange(dateRange);
        if (!dateParams && dateRange === 'custom') {
            toast.warning('Please select both start and end dates');
            return;
        }

        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/report/combined-report`, {
                params: dateParams
            });

            if (response.data.success) {
                const { inward, outward, summary } = response.data.data;

                // Create workbook with multiple sheets
                const wb = XLSX.utils.book_new();

                // ============================================
                // UPDATED: Inward sheet - no change
                // ============================================
                const inwardWS = XLSX.utils.json_to_sheet(inward.map(item => ({
                    'Date': new Date(item.date).toLocaleDateString(),
                    'Product Name': item.productName,
                    'Units': item.units,
                    'Quantity Added': item.quantity,
                    'Purchase Price (₹)': item.price?.toFixed(2),
                    'Total Cost (₹)': item.total?.toFixed(2)
                })));
                XLSX.utils.book_append_sheet(wb, inwardWS, 'Inward Transactions');

                // ============================================
                // UPDATED: Outward sheet - WITH SELLING PRICE
                // ============================================
                const outwardWS = XLSX.utils.json_to_sheet(outward.map(item => ({
                    'Date': new Date(item.date).toLocaleDateString(),
                    'Product Name': item.productName,
                    'Units': item.units,
                    'Quantity Removed': item.quantity,
                    'Selling Price (₹)': item.price?.toFixed(2) || '0.00',          // NEW
                    'Total Value (₹)': item.totalValue?.toFixed(2) || '0.00',       // NEW
                    'Issued To': item.issuedTo || '-',
                    'System Date': new Date(item.systemDate).toLocaleDateString()
                })));
                XLSX.utils.book_append_sheet(wb, outwardWS, 'Outward Transactions');

                // ============================================
                // UPDATED: Summary sheet - WITH SELLING PRICE
                // ============================================
                const summaryWS = XLSX.utils.json_to_sheet([{
                    'Total Inward Qty': summary.totalInward,
                    'Total Outward Qty': summary.totalOutward,
                    'Total Inward Value (₹)': summary.totalInwardValue?.toFixed(2) || '0.00',
                    'Total Selling Value (₹)': summary.totalSellingValue?.toFixed(2) || '0.00',  // NEW
                    'Avg Selling Price (₹)': summary.avgSellingPrice?.toFixed(2) || '0.00',      // NEW
                    'Report Period': `${dateParams.fromDate} to ${dateParams.toDate}`
                }]);
                XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

                // Save file
                const fileName = `inventory_report_${dateParams.fromDate}_to_${dateParams.toDate}.xlsx`;
                XLSX.writeFile(wb, fileName);

                toast.success('Master report exported successfully!');
            }
        } catch (error) {
            console.error("Error exporting master report:", error);
            toast.error("Failed to export master report");
        }
    };

    const exportInwardData = () => {
        if (inwardTransactions.length === 0) {
            toast.warning('No inward data to export');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(inwardTransactions.map(item => ({
            'Date': new Date(item.date).toLocaleDateString(),
            'Product Name': item.productName,
            'Units': item.units,
            'Quantity Added': item.quantity,
            'Price per Unit (₹)': item.price?.toFixed(2),
            'Total Cost (₹)': item.total?.toFixed(2),
            'System Date': new Date(item.systemDate).toLocaleDateString()
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inward Transactions');

        const dateParams = getDateRange(dateRange);
        const fileName = `inward_data_${dateParams?.fromDate}_to_${dateParams?.toDate}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success('Inward data exported successfully!');
    };

    // ============================================
    // UPDATED: Export Outward Data - WITH SELLING PRICE
    // ============================================
    const exportOutwardData = () => {
        if (outwardTransactions.length === 0) {
            toast.warning('No outward data to export');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(outwardTransactions.map(item => ({
            'Date': new Date(item.date).toLocaleDateString(),
            'Product Name': item.productName,
            'Units': item.units,
            'Quantity Removed': item.quantity,
            'Selling Price (₹)': item.price?.toFixed(2) || '0.00',          // NEW
            'Total Value (₹)': item.totalValue?.toFixed(2) || '0.00',       // NEW
            'Issued To': item.issuedTo || '-',
            'Running Balance': `${item.runningBalance} ${item.units}`,
            'System Date': new Date(item.systemDate).toLocaleDateString()
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Outward Transactions');

        const dateParams = getDateRange(dateRange);
        const fileName = `outward_data_${dateParams?.fromDate}_to_${dateParams?.toDate}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success('Outward data exported successfully!');
    };

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(value);
    };

    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="reports-page">
                {/* Header with Filters */}
                <div className="reports-header">
                    <h1>📊 Product Reports</h1>
                    <div className="filters-section">
                        <div className="date-filters">
                            {dateFilterOptions.map(option => (
                                <button
                                    key={option.id}
                                    className={`filter-btn ${dateRange === option.id ? 'active' : ''}`}
                                    onClick={() => handleDateFilterChange(option.id)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {showCustomPicker && (
                            <div className="custom-date-picker">
                                <DatePicker
                                    selected={customStartDate}
                                    onChange={date => setCustomStartDate(date)}
                                    selectsStart
                                    startDate={customStartDate}
                                    endDate={customEndDate}
                                    placeholderText="Start Date"
                                    className="date-input"
                                    dateFormat="yyyy-MM-dd"
                                />
                                <span>to</span>
                                <DatePicker
                                    selected={customEndDate}
                                    onChange={date => setCustomEndDate(date)}
                                    selectsEnd
                                    startDate={customStartDate}
                                    endDate={customEndDate}
                                    minDate={customStartDate}
                                    placeholderText="End Date"
                                    className="date-input"
                                    dateFormat="yyyy-MM-dd"
                                />
                            </div>
                        )}

                        <button className="export-master-btn" onClick={exportMasterReport}>
                            <FaFileExport /> Export Master Report
                        </button>
                    </div>
                </div>

                {/* ============================================ */}
                {/* UPDATED: Metrics Cards - Row 1 (NOW WITH 5 CARDS) */}
                {/* ============================================ */}
                <div className="metrics-grid date-filtered">
                    <div className="metric-card">
                        <div className="metric-icon inward">
                            <FaArrowDown />
                        </div>
                        <div className="metric-content">
                            <h3>Total Inward</h3>
                            <p className="metric-value">{metrics.dateFiltered.totalInward} units</p>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon outward">
                            <FaArrowUp />
                        </div>
                        <div className="metric-content">
                            <h3>Total Outward</h3>
                            <p className="metric-value">{metrics.dateFiltered.totalOutward} units</p>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon price">
                            <FaRupeeSign />
                        </div>
                        <div className="metric-content">
                            <h3>Avg Purchase Price</h3>
                            <p className="metric-value">{formatCurrency(metrics.dateFiltered.avgPurchasePrice)}</p>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* NEW METRIC CARD: Avg Selling Price */}
                    {/* ============================================ */}
                    <div className="metric-card">
                        <div className="metric-icon selling-price">
                            <FaTags />
                        </div>
                        <div className="metric-content">
                            <h3>Avg Selling Price</h3>
                            <p className="metric-value">{formatCurrency(metrics.dateFiltered.avgSellingPrice)}</p>
                            <small className="metric-sub">Based on outward transactions</small>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon value">
                            <FaChartLine />
                        </div>
                        <div className="metric-content">
                            <h3>Total Inventory Value</h3>
                            <p className="metric-value">{formatCurrency(metrics.dateFiltered.totalValue)}</p>
                        </div>
                    </div>
                </div>

                {/* Metrics Cards - Row 2 (Always Live) - NO CHANGE */}
                <div className="metrics-grid always-live">
                    <div className="metric-card">
                        <div className="metric-icon total">
                            <FaBoxes />
                        </div>
                        <div className="metric-content">
                            <h3>Total Products</h3>
                            <p className="metric-value">{metrics.alwaysLive.totalProducts}</p>
                        </div>
                    </div>

                    <div className="metric-card clickable" onClick={handleLowStockClick}>
                        <div className="metric-icon low-stock">
                            <FaExclamationTriangle />
                        </div>
                        <div className="metric-content">
                            <h3>Low Stock</h3>
                            <p className="metric-value">{metrics.alwaysLive.lowStock.count}</p>
                            <span className="click-hint"><FaEye /> Click to view</span>
                        </div>
                    </div>

                    <div className="metric-card clickable" onClick={handleOutOfStockClick}>
                        <div className="metric-icon out-stock">
                            <FaTimesCircle />
                        </div>
                        <div className="metric-content">
                            <h3>Out of Stock</h3>
                            <p className="metric-value">{metrics.alwaysLive.outOfStock.count}</p>
                            <span className="click-hint"><FaEye /> Click to view</span>
                        </div>
                    </div>
                </div>

                {/* Top 5 Outward Products - NO CHANGE */}
                <div className="section-card">
                    <div className="section-header">
                        <h2>🏆 Top 5 Outward Products</h2>
                        <span className="period-badge">
                            {dateRange === 'custom'
                                ? `${customStartDate?.toLocaleDateString()} - ${customEndDate?.toLocaleDateString()}`
                                : dateFilterOptions.find(opt => opt.id === dateRange)?.label
                            }
                        </span>
                    </div>

                    {loading.topOutward ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : (
                        <div className="top-products-list">
                            {topOutwardProducts.length > 0 ? (
                                topOutwardProducts.map((product, index) => (
                                    <div key={product.productId} className="product-rank-item">
                                        <div className="rank-badge">{index + 1}</div>
                                        <div className="product-info">
                                            <span className="product-name">{product.productName}</span>
                                            <span className="product-stats">
                                                {product.totalOutward} {product.units} outward
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${(product.totalOutward / topOutwardProducts[0].totalOutward) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-data">No outward transactions in this period</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Inward Transactions Table - NO CHANGE */}
                <div className="section-card">
                    <div className="section-header">
                        <h2>📥 Inward Transactions</h2>
                        <button className="export-btn" onClick={exportInwardData}>
                            <FaDownload /> Export Inward
                        </button>
                    </div>

                    {loading.inward ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="transactions-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Product Name</th>
                                        <th>Units</th>
                                        <th>Quantity</th>
                                        <th>Price/Unit</th>
                                        <th>Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inwardTransactions.length > 0 ? (
                                        <>
                                            {inwardTransactions.slice(0, 10).map((transaction, index) => (
                                                <tr key={transaction.transactionId || index}>
                                                    <td>{new Date(transaction.date).toLocaleDateString()}</td>
                                                    <td>{transaction.productName}</td>
                                                    <td>{transaction.units}</td>
                                                    <td className="positive">+{transaction.quantity}</td>
                                                    <td>{formatCurrency(transaction.price)}</td>
                                                    <td>{formatCurrency(transaction.total)}</td>
                                                </tr>
                                            ))}
                                            {inwardTransactions.length > 10 && (
                                                <tr className="show-more-row">
                                                    <td colSpan="6">
                                                        <div className="show-more-info">
                                                            + {inwardTransactions.length - 10} more transactions.
                                                            <button
                                                                className="show-all-btn"
                                                                onClick={() => {
                                                                    toast.info(`Total ${inwardTransactions.length} transactions. Use Export to see all data.`);
                                                                }}
                                                            >
                                                                Click to view count
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="no-data">No inward transactions in this period</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ============================================ */}
                {/* UPDATED: Outward Transactions Table - WITH SELLING PRICE */}
                {/* ============================================ */}
                <div className="section-card">
                    <div className="section-header">
                        <h2>📤 Outward Transactions</h2>
                        <button className="export-btn" onClick={exportOutwardData}>
                            <FaDownload /> Export Outward
                        </button>
                    </div>

                    {loading.outward ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="transactions-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Product Name</th>
                                        <th>Units</th>
                                        <th>Quantity</th>
                                        <th>Selling Price</th>           {/* NEW COLUMN */}
                                        <th>Total Value</th>             {/* NEW COLUMN */}
                                        <th>Issued To</th>
                                        <th>Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {outwardTransactions.length > 0 ? (
                                        <>
                                            {outwardTransactions.slice(0, 10).map((transaction, index) => (
                                                <tr key={transaction.transactionId || index}>
                                                    <td>{new Date(transaction.date).toLocaleDateString()}</td>
                                                    <td>{transaction.productName}</td>
                                                    <td>{transaction.units}</td>
                                                    <td className="negative">-{transaction.quantity}</td>
                                                    <td className="price-cell">                                    {/* NEW */}
                                                        {formatCurrency(transaction.price || 0)}
                                                    </td>
                                                    <td className="total-cell">                                    {/* NEW */}
                                                        {formatCurrency(transaction.totalValue || 0)}
                                                    </td>
                                                    <td>
                                                        <span className="issued-to-badge">
                                                            {transaction.issuedTo || '-'}
                                                        </span>
                                                    </td>
                                                    <td>{transaction.runningBalance} {transaction.units}</td>
                                                </tr>
                                            ))}
                                            {outwardTransactions.length > 10 && (
                                                <tr className="show-more-row">
                                                    <td colSpan="8">                                           {/* Updated colSpan */}
                                                        <div className="show-more-info">
                                                            + {outwardTransactions.length - 10} more transactions.
                                                            <button
                                                                className="show-all-btn"
                                                                onClick={() => {
                                                                    toast.info(`Total ${outwardTransactions.length} transactions. Use Export to see all data.`);
                                                                }}
                                                            >
                                                                Click to view count
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="no-data">No outward transactions in this period</td>  {/* Updated colSpan */}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Low Stock Modal - NO CHANGE */}
                {showLowStockModal && (
                    <div className="modal-overlay" onClick={() => setShowLowStockModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{modalTitle}</h3>
                                <button className="close-btn" onClick={() => setShowLowStockModal(false)}>×</button>
                            </div>
                            <div className="modal-body">
                                <table className="modal-table">
                                    <thead>
                                        <tr>
                                            <th>Product Name</th>
                                            <th>Units</th>
                                            <th>Min. Qty</th>
                                            <th>Current Stock</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedProducts.map(product => (
                                            <tr key={product.productId}>
                                                <td>{product.productName}</td>
                                                <td>{product.units}</td>
                                                <td>{product.minimumQty}</td>
                                                <td className={product.currentStock === 0 ? 'danger' : 'warning'}>
                                                    {product.currentStock}
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${product.status === 'Low Stock' ? 'warning' : 'danger'}`}>
                                                        {product.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Out of Stock Modal - NO CHANGE */}
                {showOutOfStockModal && (
                    <div className="modal-overlay" onClick={() => setShowOutOfStockModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{modalTitle}</h3>
                                <button className="close-btn" onClick={() => setShowOutOfStockModal(false)}>×</button>
                            </div>
                            <div className="modal-body">
                                <table className="modal-table">
                                    <thead>
                                        <tr>
                                            <th>Product Name</th>
                                            <th>Units</th>
                                            <th>Min. Qty</th>
                                            <th>Current Stock</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedProducts.map(product => (
                                            <tr key={product.productId}>
                                                <td>{product.productName}</td>
                                                <td>{product.units}</td>
                                                <td>{product.minimumQty}</td>
                                                <td className="danger">{product.currentStock}</td>
                                                <td>
                                                    <span className="status-badge danger">{product.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Navbar>
    );
};

export default ProductReports;