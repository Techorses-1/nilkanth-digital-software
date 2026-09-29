import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaUser,
    FaSearch,
    FaFileInvoice,
    FaFileAlt,
    FaStamp,
    FaTools,
    FaBox,
    FaEye,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaInfoCircle,
    FaCalendarAlt,
    FaRupeeSign,
    FaCheckCircle,
    FaClock,
    FaHistory,
    FaSyncAlt,
    FaClipboardList
} from "react-icons/fa";
import "./CustomerHistory.scss";
import "react-toastify/dist/ReactToastify.css";

// ===== Auth headers =====
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };
};

// ===== React-Select styles =====
const selectStyles = {
    control: (base) => ({
        ...base,
        minHeight: '42px',
        borderColor: '#ddd',
        borderRadius: '8px',
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

// ===== Format helpers =====
const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return `₹${Number(val).toFixed(2)}`;
};

const CustomerHistory = () => {
    // ============= GLOBAL =============
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [overview, setOverview] = useState(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

    // ============= TABS =============
    const [activeTab, setActiveTab] = useState("overview");

    // ============= PER-TAB DATA =============
    const [salesData, setSalesData] = useState({ items: [], pagination: null, loading: false });
    const [quotationsData, setQuotationsData] = useState({ items: [], pagination: null, loading: false });
    const [amcsData, setAmcsData] = useState({ items: [], pagination: null, loading: false });
    const [stampingsData, setStampingsData] = useState({ items: [], pagination: null, loading: false });
    const [machinesData, setMachinesData] = useState({ items: [], pagination: null, loading: false });
    const [repairingsData, setRepairingsData] = useState({ items: [], pagination: null, loading: false });

    // ============= FILTERS (per tab) =============
    const [salesFilter, setSalesFilter] = useState({ page: 1, fromDate: '', toDate: '' });
    const [quotationsFilter, setQuotationsFilter] = useState({ page: 1, fromDate: '', toDate: '' });
    const [amcsFilter, setAmcsFilter] = useState({ page: 1, fromDate: '', toDate: '' });
    const [stampingsFilter, setStampingsFilter] = useState({ page: 1, fromDate: '', toDate: '' });
    const [machinesFilter, setMachinesFilter] = useState({ page: 1 });
    const [repairingsFilter, setRepairingsFilter] = useState({ page: 1, fromDate: '', toDate: '' });

    // ============= MODALS =============
    const [modalType, setModalType] = useState(null); // 'sale' | 'quotation' | 'amc' | 'stamping' | 'repairing' | 'machine'
    const [modalData, setModalData] = useState(null);

    // ============= STAMPING TAB SUB-VIEW =============
    const [stampingSubTab, setStampingSubTab] = useState("receipts"); // "receipts" | "machines"

    // ============= PAGINATION LIMIT =============
    const LIMIT = 20;

    // ============= LOAD CUSTOMERS LIST =============
    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setIsLoadingCustomers(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer/get-customers`,
                headers
            );
            const data = response.data?.data || response.data || [];
            setCustomers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    // ============= CUSTOMER SELECT =============
    const handleCustomerSelect = async (option) => {
        if (!option) {
            setSelectedCustomer(null);
            setOverview(null);
            return;
        }

        const customer = customers.find(c => c.customerId === option.value);
        setSelectedCustomer(customer || null);
        setActiveTab("overview");
        setOverview(null);

        if (customer) {
            await fetchOverview(customer.customerId);
        }
    };

    const fetchOverview = async (customerId) => {
        setIsLoadingCustomer(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/overview/${customerId}`,
                headers
            );
            if (response.data.success) {
                setOverview(response.data.data);
            } else {
                setOverview(null);
            }
        } catch (error) {
            console.error("Error fetching overview:", error);
            toast.error(error.response?.data?.message || "Failed to load customer history");
            setOverview(null);
        } finally {
            setIsLoadingCustomer(false);
        }
    };

    // ============= PER-TAB FETCHERS =============

    const buildQuery = (filter) => {
        const params = new URLSearchParams();
        if (filter.page) params.append('page', filter.page);
        params.append('limit', LIMIT);
        if (filter.fromDate) params.append('fromDate', filter.fromDate);
        if (filter.toDate) params.append('toDate', filter.toDate);
        return params.toString();
    };

    const fetchSales = useCallback(async () => {
        if (!selectedCustomer) return;
        setSalesData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(salesFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/sales/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setSalesData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading sales:", error);
            setSalesData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, salesFilter]);

    const fetchQuotations = useCallback(async () => {
        if (!selectedCustomer) return;
        setQuotationsData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(quotationsFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/quotations/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setQuotationsData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading quotations:", error);
            setQuotationsData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, quotationsFilter]);

    const fetchAmcs = useCallback(async () => {
        if (!selectedCustomer) return;
        setAmcsData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(amcsFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/amcs/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setAmcsData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading AMCs:", error);
            setAmcsData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, amcsFilter]);

    const fetchStampings = useCallback(async () => {
        if (!selectedCustomer) return;
        setStampingsData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(stampingsFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/stampings/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setStampingsData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading stampings:", error);
            setStampingsData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, stampingsFilter]);

    const fetchMachines = useCallback(async () => {
        if (!selectedCustomer) return;
        setMachinesData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(machinesFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/stamping-units/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setMachinesData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading machines:", error);
            setMachinesData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, machinesFilter]);

    const fetchRepairings = useCallback(async () => {
        if (!selectedCustomer) return;
        setRepairingsData(prev => ({ ...prev, loading: true }));
        try {
            const headers = getAuthHeaders();
            const qs = buildQuery(repairingsFilter);
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/repairings/${selectedCustomer.customerId}?${qs}`,
                headers
            );
            if (response.data.success) {
                setRepairingsData({
                    items: response.data.data || [],
                    pagination: response.data.pagination,
                    loading: false
                });
            }
        } catch (error) {
            console.error("Error loading repairings:", error);
            setRepairingsData({ items: [], pagination: null, loading: false });
        }
    }, [selectedCustomer, repairingsFilter]);

    // ============= TAB TRIGGER =============
    useEffect(() => {
        if (!selectedCustomer) return;
        if (activeTab === "sales") fetchSales();
        else if (activeTab === "quotations") fetchQuotations();
        else if (activeTab === "amc") fetchAmcs();
        else if (activeTab === "stamping") {
            if (stampingSubTab === "receipts") fetchStampings();
            else fetchMachines();
        }
        else if (activeTab === "repairing") fetchRepairings();
    }, [activeTab, stampingSubTab, fetchSales, fetchQuotations, fetchAmcs, fetchStampings, fetchMachines, fetchRepairings]);

    // ============= MODAL HELPERS =============
    const openModal = (type, data) => {
        setModalType(type);
        setModalData(data);
    };

    const closeModal = () => {
        setModalType(null);
        setModalData(null);
    };

    const openMachineHistory = async (machine) => {
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/customer-history/stamping-unit-history`,
                {
                    ...headers,
                    params: {
                        customerId: machine.customerId,
                        productId: machine.productId,
                        uniqueNumber: machine.uniqueNumber
                    }
                }
            );
            if (response.data.success) {
                openModal('machine', response.data.data);
            }
        } catch (error) {
            console.error("Error fetching machine history:", error);
            toast.error("Failed to load machine history");
        }
    };

    // ============= PAGINATION HELPERS =============
    const renderPagination = (pagination, setFilter) => {
        if (!pagination || pagination.totalPages <= 1) return null;
        return (
            <div className="ch-pagination">
                <div className="ch-pagination-info">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} entries
                </div>
                <div className="ch-pagination-buttons">
                    <button
                        className="ch-page-btn"
                        onClick={() => setFilter(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={!pagination.hasPrev}
                    >
                        <FaChevronLeft /> Prev
                    </button>
                    <span className="ch-page-info">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                        className="ch-page-btn"
                        onClick={() => setFilter(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={!pagination.hasNext}
                    >
                        Next <FaChevronRight />
                    </button>
                </div>
            </div>
        );
    };

    // ============= DATE FILTER BAR =============
    const renderDateFilter = (filter, setFilter) => {
        return (
            <div className="ch-filter-bar">
                <div className="ch-filter-item">
                    <label className="ch-filter-label">
                        <FaCalendarAlt /> From
                    </label>
                    <input
                        type="date"
                        className="ch-filter-input"
                        value={filter.fromDate}
                        onChange={(e) => setFilter(prev => ({ ...prev, fromDate: e.target.value, page: 1 }))}
                    />
                </div>
                <div className="ch-filter-item">
                    <label className="ch-filter-label">
                        <FaCalendarAlt /> To
                    </label>
                    <input
                        type="date"
                        className="ch-filter-input"
                        value={filter.toDate}
                        onChange={(e) => setFilter(prev => ({ ...prev, toDate: e.target.value, page: 1 }))}
                    />
                </div>
                {(filter.fromDate || filter.toDate) && (
                    <button
                        className="ch-filter-clear"
                        onClick={() => setFilter(prev => ({ ...prev, fromDate: '', toDate: '', page: 1 }))}
                    >
                        <FaTimes /> Clear
                    </button>
                )}
            </div>
        );
    };

    // ============= TABS DEFINITION =============
    const TABS = [
        { key: 'overview', label: 'Overview', icon: <FaInfoCircle /> },
        { key: 'sales', label: 'Sales', icon: <FaFileInvoice /> },
        { key: 'quotations', label: 'Quotations', icon: <FaFileAlt /> },
        { key: 'amc', label: 'AMC', icon: <FaSyncAlt /> },
        { key: 'stamping', label: 'Stamping', icon: <FaStamp /> },
        { key: 'repairing', label: 'Repairing', icon: <FaTools /> }
    ];

    // ============= RENDER: OVERVIEW TAB =============
    const renderOverview = () => {
        if (!overview) return null;
        const { customer, summary } = overview;

        return (
            <div className="ch-overview">
                {/* Customer Info Card */}
                <div className="ch-customer-card">
                    <div className="ch-customer-header">
                        <div className="ch-customer-avatar">
                            <FaUser />
                        </div>
                        <div className="ch-customer-name-block">
                            <h3 className="ch-customer-name">{customer.customerName}</h3>
                            <span className="ch-customer-since">
                                Customer since {formatDate(customer.createdAt)}
                            </span>
                        </div>
                    </div>

                    <div className="ch-customer-info-grid">
                        {customer.contactNumber && (
                            <div className="ch-info-item">
                                <FaPhone className="ch-info-icon" />
                                <span className="ch-info-text">{customer.contactNumber}</span>
                            </div>
                        )}
                        {customer.email && (
                            <div className="ch-info-item">
                                <FaEnvelope className="ch-info-icon" />
                                <span className="ch-info-text">{customer.email}</span>
                            </div>
                        )}
                        {customer.gstNumber && (
                            <div className="ch-info-item">
                                <FaInfoCircle className="ch-info-icon" />
                                <span className="ch-info-text">GST: {customer.gstNumber}</span>
                            </div>
                        )}
                        {customer.address && (
                            <div className="ch-info-item ch-info-item-full">
                                <FaMapMarkerAlt className="ch-info-icon" />
                                <span className="ch-info-text">{customer.address}</span>
                            </div>
                        )}
                        
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="ch-summary-grid">
                    <div className="ch-summary-card ch-summary-sales">
                        <div className="ch-summary-icon"><FaFileInvoice /></div>
                        <div className="ch-summary-content">
                            <span className="ch-summary-label">Sales</span>
                            <span className="ch-summary-count">{summary.sales.count}</span>
                            <span className="ch-summary-value">{formatCurrency(summary.sales.total)}</span>
                        </div>
                    </div>

                    <div className="ch-summary-card ch-summary-quotations">
                        <div className="ch-summary-icon"><FaFileAlt /></div>
                        <div className="ch-summary-content">
                            <span className="ch-summary-label">Quotations</span>
                            <span className="ch-summary-count">{summary.quotations.count}</span>
                            <span className="ch-summary-value">{formatCurrency(summary.quotations.total)}</span>
                        </div>
                    </div>

                    <div className="ch-summary-card ch-summary-amc">
                        <div className="ch-summary-icon"><FaSyncAlt /></div>
                        <div className="ch-summary-content">
                            <span className="ch-summary-label">AMC</span>
                            <span className="ch-summary-count">{summary.amc.total}</span>
                            <span className="ch-summary-value">{formatCurrency(summary.amc.grandTotal)}</span>
                            <span className="ch-summary-sub">
                                <span className="ch-badge ch-badge-active">Active: {summary.amc.active}</span>
                                <span className="ch-badge ch-badge-pending">Pending: {summary.amc.pending}</span>
                                <span className="ch-badge ch-badge-expired">Expired: {summary.amc.expired}</span>
                            </span>
                        </div>
                    </div>

                    <div className="ch-summary-card ch-summary-stamping">
                        <div className="ch-summary-icon"><FaStamp /></div>
                        <div className="ch-summary-content">
                            <span className="ch-summary-label">Stamping</span>
                            <span className="ch-summary-count">{summary.stamping.count}</span>
                            <span className="ch-summary-value">{formatCurrency(summary.stamping.total)}</span>
                            <span className="ch-summary-sub">
                                <span className="ch-badge ch-badge-info">
                                    <FaBox /> {summary.stamping.machines} Machines
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="ch-summary-card ch-summary-repairing">
                        <div className="ch-summary-icon"><FaTools /></div>
                        <div className="ch-summary-content">
                            <span className="ch-summary-label">Repairing</span>
                            <span className="ch-summary-count">{summary.repairing.count}</span>
                            <span className="ch-summary-value">{formatCurrency(summary.repairing.total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER: SALES TAB =============
    const renderSalesTab = () => (
        <div className="ch-tab-content">
            {renderDateFilter(salesFilter, setSalesFilter)}

            {salesData.loading ? (
                <div className="ch-loading"><div className="ch-spinner"></div><p>Loading sales...</p></div>
            ) : salesData.items.length === 0 ? (
                <div className="ch-empty"><FaFileInvoice size={40} color="#ccc" /><p>No sales found</p></div>
            ) : (
                <>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Invoice No</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Items</th>
                                    <th>Grand Total</th>
                                    <th>Payment</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesData.items.map((s, idx) => {
                                    const serial = ((salesData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                    const type = s.isChallan ? 'Challan' : (s.isGstMode ? 'GST' : 'Non-GST');
                                    return (
                                        <tr key={s.saleId}>
                                            <td>{serial}</td>
                                            <td><strong>{s.invoiceNumber}</strong></td>
                                            <td>{formatDate(s.saleDate)}</td>
                                            <td>
                                                <span className={`ch-tag ch-tag-${s.isChallan ? 'challan' : (s.isGstMode ? 'gst' : 'nongst')}`}>
                                                    {type}
                                                </span>
                                            </td>
                                            <td>{s.items?.length || 0}</td>
                                            <td><strong>{formatCurrency(s.grandTotal)}</strong></td>
                                            <td>
                                                <span className={`ch-badge-status ${s.paymentStatus === 'Paid' ? 'ch-status-paid' : 'ch-status-pending'}`}>
                                                    {s.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />} {s.paymentStatus || 'Paid'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="ch-view-btn" onClick={() => openModal('sale', s)}>
                                                    <FaEye /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(salesData.pagination, setSalesFilter)}
                </>
            )}
        </div>
    );

    // ============= RENDER: QUOTATIONS TAB =============
    const renderQuotationsTab = () => (
        <div className="ch-tab-content">
            {renderDateFilter(quotationsFilter, setQuotationsFilter)}

            {quotationsData.loading ? (
                <div className="ch-loading"><div className="ch-spinner"></div><p>Loading quotations...</p></div>
            ) : quotationsData.items.length === 0 ? (
                <div className="ch-empty"><FaFileAlt size={40} color="#ccc" /><p>No quotations found</p></div>
            ) : (
                <>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Quotation No</th>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th>Grand Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotationsData.items.map((q, idx) => {
                                    const serial = ((quotationsData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                    return (
                                        <tr key={q.quotationId}>
                                            <td>{serial}</td>
                                            <td><strong>{q.quotationNumber}</strong></td>
                                            <td>{formatDate(q.quotationDate)}</td>
                                            <td>{q.items?.length || 0}</td>
                                            <td><strong>{formatCurrency(q.grandTotal)}</strong></td>
                                            <td>
                                                <button className="ch-view-btn" onClick={() => openModal('quotation', q)}>
                                                    <FaEye /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(quotationsData.pagination, setQuotationsFilter)}
                </>
            )}
        </div>
    );

    // ============= RENDER: AMC TAB =============
    const renderAmcTab = () => (
        <div className="ch-tab-content">
            {renderDateFilter(amcsFilter, setAmcsFilter)}

            {amcsData.loading ? (
                <div className="ch-loading"><div className="ch-spinner"></div><p>Loading AMCs...</p></div>
            ) : amcsData.items.length === 0 ? (
                <div className="ch-empty"><FaSyncAlt size={40} color="#ccc" /><p>No AMCs found</p></div>
            ) : (
                <>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>AMC No</th>
                                    <th>Products</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Status</th>
                                    <th>Grand Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {amcsData.items.map((a, idx) => {
                                    const serial = ((amcsData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                    return (
                                        <tr key={a.amcId}>
                                            <td>{serial}</td>
                                            <td>
                                                <strong>{a.amcNumber}</strong>
                                                {a.renewalOf && (
                                                    <span className="ch-renewal-tag" title="Renewal AMC">
                                                        <FaSyncAlt />
                                                    </span>
                                                )}
                                            </td>
                                            <td>{a.products?.length || 0}</td>
                                            <td>{formatDate(a.startDate)}</td>
                                            <td>{formatDate(a.endDate)}</td>
                                            <td>
                                                <span className={`ch-status-badge ch-status-${a.status?.toLowerCase()}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td><strong>{formatCurrency(a.grandTotal)}</strong></td>
                                            <td>
                                                <button className="ch-view-btn" onClick={() => openModal('amc', a)}>
                                                    <FaEye /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(amcsData.pagination, setAmcsFilter)}
                </>
            )}
        </div>
    );

    // ============= RENDER: STAMPING TAB =============
    const renderStampingTab = () => (
        <div className="ch-tab-content">
            {/* Sub-tab toggle */}
            <div className="ch-subtab-row">
                <button
                    className={`ch-subtab ${stampingSubTab === 'receipts' ? 'ch-subtab-active' : ''}`}
                    onClick={() => setStampingSubTab('receipts')}
                >
                    <FaStamp /> Stamping Receipts
                </button>
                <button
                    className={`ch-subtab ${stampingSubTab === 'machines' ? 'ch-subtab-active' : ''}`}
                    onClick={() => setStampingSubTab('machines')}
                >
                    <FaBox /> Machines
                </button>
            </div>

            {stampingSubTab === 'receipts' ? (
                <>
                    {renderDateFilter(stampingsFilter, setStampingsFilter)}

                    {stampingsData.loading ? (
                        <div className="ch-loading"><div className="ch-spinner"></div><p>Loading stampings...</p></div>
                    ) : stampingsData.items.length === 0 ? (
                        <div className="ch-empty"><FaStamp size={40} color="#ccc" /><p>No stamping receipts</p></div>
                    ) : (
                        <>
                            <div className="ch-table-wrap">
                                <table className="ch-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Receipt No</th>
                                            <th>Stamp Date</th>
                                            <th>Products</th>
                                            <th>Grand Total</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stampingsData.items.map((s, idx) => {
                                            const serial = ((stampingsData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                            return (
                                                <tr key={s.stampingId}>
                                                    <td>{serial}</td>
                                                    <td><strong>{s.stampingNumber}</strong></td>
                                                    <td>{formatDate(s.stampDate)}</td>
                                                    <td>{s.products?.length || 0}</td>
                                                    <td><strong>{formatCurrency(s.grandTotal)}</strong></td>
                                                    <td>
                                                        <button className="ch-view-btn" onClick={() => openModal('stamping', s)}>
                                                            <FaEye /> View
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {renderPagination(stampingsData.pagination, setStampingsFilter)}
                        </>
                    )}
                </>
            ) : (
                <>
                    {machinesData.loading ? (
                        <div className="ch-loading"><div className="ch-spinner"></div><p>Loading machines...</p></div>
                    ) : machinesData.items.length === 0 ? (
                        <div className="ch-empty"><FaBox size={40} color="#ccc" /><p>No machines found</p></div>
                    ) : (
                        <>
                            <div className="ch-table-wrap">
                                <table className="ch-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Product</th>
                                            <th>Unique No</th>
                                            <th>Last Stamped</th>
                                            <th>Total Stamps</th>
                                            <th>Next Due</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {machinesData.items.map((u, idx) => {
                                            const serial = ((machinesData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                            return (
                                                <tr key={u.unitId}>
                                                    <td>{serial}</td>
                                                    <td><strong>{u.productName}</strong></td>
                                                    <td><span className="ch-unique-tag">{u.uniqueNumber}</span></td>
                                                    <td>{formatDate(u.lastStampDate)}</td>
                                                    <td><span className="ch-count-badge">{u.totalStamps}</span></td>
                                                    <td>{formatDate(u.nextDueDate)}</td>
                                                    <td>
                                                        <button className="ch-view-btn" onClick={() => openMachineHistory(u)}>
                                                            <FaHistory /> History
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {renderPagination(machinesData.pagination, setMachinesFilter)}
                        </>
                    )}
                </>
            )}
        </div>
    );

    // ============= RENDER: REPAIRING TAB =============
    const renderRepairingTab = () => (
        <div className="ch-tab-content">
            {renderDateFilter(repairingsFilter, setRepairingsFilter)}

            {repairingsData.loading ? (
                <div className="ch-loading"><div className="ch-spinner"></div><p>Loading repairings...</p></div>
            ) : repairingsData.items.length === 0 ? (
                <div className="ch-empty"><FaTools size={40} color="#ccc" /><p>No repairings found</p></div>
            ) : (
                <>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Repairing No</th>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th>Grand Total</th>
                                    <th>Payment</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repairingsData.items.map((r, idx) => {
                                    const serial = ((repairingsData.pagination?.page || 1) - 1) * LIMIT + idx + 1;
                                    return (
                                        <tr key={r.repairingId}>
                                            <td>{serial}</td>
                                            <td><strong>{r.repairingNumber}</strong></td>
                                            <td>{formatDate(r.repairingDate)}</td>
                                            <td>{r.items?.length || 0}</td>
                                            <td><strong>{formatCurrency(r.grandTotal)}</strong></td>
                                            <td>
                                                <span className={`ch-badge-status ${r.paymentStatus === 'Paid' ? 'ch-status-paid' : 'ch-status-pending'}`}>
                                                    {r.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />} {r.paymentStatus || 'Paid'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="ch-view-btn" onClick={() => openModal('repairing', r)}>
                                                    <FaEye /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(repairingsData.pagination, setRepairingsFilter)}
                </>
            )}
        </div>
    );

    // ============= RENDER: MODALS =============

    // --- Shared Products Table ---
    const renderProductsTable = (items, itemsKey = 'items') => {
        const products = items[itemsKey] || items.products || [];
        if (!products || products.length === 0) return null;

        return (
            <div className="ch-modal-table-wrap">
                <table className="ch-modal-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Desc</th>
                            <th>Capacity</th>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((it, idx) => (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{it.productName}</td>
                                <td>{it.invoiceDescription || '-'}</td>
                                <td>{it.capacity || '-'}</td>
                                <td>{it.hsnCode || '-'}</td>
                                <td>{it.quantity}</td>
                                <td>{formatCurrency(it.unitPrice)}</td>
                                <td>{formatCurrency(it.finalPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // --- Shared Totals ---
    const renderTotals = (data) => (
        <div className="ch-modal-totals">
            <div className="ch-total-row">
                <span>Subtotal:</span>
                <span>{formatCurrency(data.subtotal)}</span>
            </div>
            <div className="ch-total-row">
                <span>Discount:</span>
                <span>-{formatCurrency(data.totalDiscount)}</span>
            </div>
            {data.isGstMode && data.totalTax !== undefined && (
                <div className="ch-total-row">
                    <span>Tax:</span>
                    <span>{formatCurrency(data.totalTax)}</span>
                </div>
            )}
            <div className="ch-total-row ch-total-grand">
                <span>Grand Total:</span>
                <span>{formatCurrency(data.grandTotal)}</span>
            </div>
        </div>
    );

    // --- Sale Modal ---
    const renderSaleModal = (s) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>Invoice No:</span><strong>{s.invoiceNumber}</strong></div>
                {s.internalInvoiceNumber && <div className="ch-modal-info"><span>Internal No:</span><strong>{s.internalInvoiceNumber}</strong></div>}
                <div className="ch-modal-info"><span>Date:</span><strong>{formatDate(s.saleDate)}</strong></div>
                <div className="ch-modal-info"><span>Type:</span><strong>{s.isChallan ? 'Challan' : (s.isGstMode ? 'GST' : 'Non-GST')}</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{s.storeType}</strong></div>
                <div className="ch-modal-info"><span>Payment:</span><strong>{s.paymentStatus || 'Paid'} {s.paymentType ? `(${s.paymentType})` : ''}</strong></div>
                {s.notes && <div className="ch-modal-info ch-modal-info-full"><span>Notes:</span><strong>{s.notes}</strong></div>}
            </div>

            <h4 className="ch-modal-section-title">Items</h4>
            {renderProductsTable(s)}
            {renderTotals(s)}
        </div>
    );

    // --- Quotation Modal ---
    const renderQuotationModal = (q) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>Quotation No:</span><strong>{q.quotationNumber}</strong></div>
                <div className="ch-modal-info"><span>Date:</span><strong>{formatDate(q.quotationDate)}</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{q.storeType}</strong></div>
                {q.notes && <div className="ch-modal-info ch-modal-info-full"><span>Notes:</span><strong>{q.notes}</strong></div>}
            </div>

            <h4 className="ch-modal-section-title">Items</h4>
            {renderProductsTable(q)}
            {renderTotals(q)}
        </div>
    );

    // --- AMC Modal ---
    const renderAmcModal = (a) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>AMC No:</span><strong>{a.amcNumber}</strong></div>
                <div className="ch-modal-info"><span>Status:</span>
                    <strong className={`ch-status-badge ch-status-${a.status?.toLowerCase()}`}>{a.status}</strong>
                </div>
                <div className="ch-modal-info"><span>Start:</span><strong>{formatDate(a.startDate)}</strong></div>
                <div className="ch-modal-info"><span>End:</span><strong>{formatDate(a.endDate)}</strong></div>
                <div className="ch-modal-info"><span>Duration:</span><strong>{a.durationYears} Year(s)</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{a.storeType}</strong></div>
                <div className="ch-modal-info"><span>Payment:</span><strong>{a.paymentStatus || 'Paid'} {a.paymentType ? `(${a.paymentType})` : ''}</strong></div>
                {a.renewalOf && (
                    <div className="ch-modal-info ch-modal-info-full">
                        <span>Renewal Of:</span><strong className="ch-renewal-info">{a.renewalOf}</strong>
                    </div>
                )}
                {a.notes && <div className="ch-modal-info ch-modal-info-full"><span>Notes:</span><strong>{a.notes}</strong></div>}
            </div>

            <h4 className="ch-modal-section-title">Products</h4>
            {renderProductsTable(a, 'products')}
            {renderTotals(a)}

            {/* Service History */}
            <h4 className="ch-modal-section-title">
                <FaHistory /> Service History ({a.serviceHistory?.length || 0})
            </h4>
            {a.serviceHistory && a.serviceHistory.length > 0 ? (
                <div className="ch-modal-table-wrap">
                    <table className="ch-modal-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product</th>
                                <th>Service Date</th>
                                <th>Qty</th>
                                <th>Store</th>
                                <th>Notes</th>
                                <th>By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.serviceHistory.map((s, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{s.productName}</td>
                                    <td>{formatDate(s.serviceDate)}</td>
                                    <td>{s.quantity}</td>
                                    <td>{s.storeType}</td>
                                    <td>{s.notes || '-'}</td>
                                    <td>{s.servicedBy || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="ch-modal-empty-text">No service entries yet.</p>
            )}
        </div>
    );

    // --- Stamping Modal ---
    const renderStampingModal = (s) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>Receipt No:</span><strong>{s.stampingNumber}</strong></div>
                <div className="ch-modal-info"><span>Stamp Date:</span><strong>{formatDate(s.stampDate)}</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{s.storeType}</strong></div>
                <div className="ch-modal-info"><span>Payment:</span><strong>{s.paymentStatus || 'Paid'} {s.paymentType ? `(${s.paymentType})` : ''}</strong></div>
                {s.linkedInvoiceNumber && (
                    <div className="ch-modal-info"><span>Linked Invoice:</span><strong>{s.linkedInvoiceNumber}</strong></div>
                )}
                {s.notes && <div className="ch-modal-info ch-modal-info-full"><span>Notes:</span><strong>{s.notes}</strong></div>}
            </div>

            <h4 className="ch-modal-section-title">Products & Unique Numbers</h4>
            <div className="ch-modal-table-wrap">
                <table className="ch-modal-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Capacity</th>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Final</th>
                            <th>Unique Numbers</th>
                        </tr>
                    </thead>
                    <tbody>
                        {s.products?.map((it, idx) => (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{it.productName}</td>
                                <td>{it.capacity || '-'}</td>
                                <td>{it.hsnCode || '-'}</td>
                                <td>{it.quantity}</td>
                                <td>{formatCurrency(it.unitPrice)}</td>
                                <td>{formatCurrency(it.finalPrice)}</td>
                                <td>
                                    {it.uniqueNumbers?.filter(u => u.number).map((u, i) => (
                                        <span key={i} className="ch-unique-tag">{u.number}</span>
                                    )) || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {renderTotals(s)}
        </div>
    );

    // --- Repairing Modal ---
    const renderRepairingModal = (r) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>Repairing No:</span><strong>{r.repairingNumber}</strong></div>
                <div className="ch-modal-info"><span>Date:</span><strong>{formatDate(r.repairingDate)}</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{r.storeType}</strong></div>
                <div className="ch-modal-info"><span>Payment:</span><strong>{r.paymentStatus || 'Paid'} {r.paymentType ? `(${r.paymentType})` : ''}</strong></div>
                {r.repairNotes && <div className="ch-modal-info ch-modal-info-full"><span>Repair Notes:</span><strong>{r.repairNotes}</strong></div>}
            </div>

            <h4 className="ch-modal-section-title">Items</h4>
            {renderProductsTable(r)}
            {renderTotals(r)}
        </div>
    );

    // --- Machine History Modal ---
    const renderMachineModal = (u) => (
        <div className="ch-modal-body">
            <div className="ch-modal-info-grid">
                <div className="ch-modal-info"><span>Product:</span><strong>{u.productName}</strong></div>
                <div className="ch-modal-info"><span>Unique No:</span><strong className="ch-unique-tag">{u.uniqueNumber}</strong></div>
                <div className="ch-modal-info"><span>Customer:</span><strong>{u.customerName}</strong></div>
                <div className="ch-modal-info"><span>Store:</span><strong>{u.storeType}</strong></div>
                <div className="ch-modal-info"><span>Total Stamps:</span><strong>{u.totalStamps}</strong></div>
                <div className="ch-modal-info"><span>Last Stamped:</span><strong>{formatDate(u.lastStampDate)}</strong></div>
                <div className="ch-modal-info"><span>Next Due:</span><strong>{formatDate(u.nextDueDate)}</strong></div>
            </div>

            <h4 className="ch-modal-section-title">
                <FaHistory /> Full Stamp History
            </h4>
            {u.stampHistory && u.stampHistory.length > 0 ? (
                <div className="ch-modal-table-wrap">
                    <table className="ch-modal-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Stamping No</th>
                                <th>Stamp Date</th>
                                <th>Store</th>
                                <th>Stamped By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {u.stampHistory.map((h, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td><strong>{h.stampingNumber}</strong></td>
                                    <td>{formatDate(h.stampDate)}</td>
                                    <td>{h.storeType}</td>
                                    <td>{h.stampedBy || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="ch-modal-empty-text">No history yet.</p>
            )}
        </div>
    );

    // --- Modal Router ---
    const renderModal = () => {
        if (!modalType || !modalData) return null;

        let title = '';
        let content = null;

        switch (modalType) {
            case 'sale':
                title = `Sale Details — ${modalData.invoiceNumber}`;
                content = renderSaleModal(modalData);
                break;
            case 'quotation':
                title = `Quotation Details — ${modalData.quotationNumber}`;
                content = renderQuotationModal(modalData);
                break;
            case 'amc':
                title = `AMC Details — ${modalData.amcNumber}`;
                content = renderAmcModal(modalData);
                break;
            case 'stamping':
                title = `Stamping Receipt — ${modalData.stampingNumber}`;
                content = renderStampingModal(modalData);
                break;
            case 'repairing':
                title = `Repairing Details — ${modalData.repairingNumber}`;
                content = renderRepairingModal(modalData);
                break;
            case 'machine':
                title = `Machine History — ${modalData.productName} (${modalData.uniqueNumber})`;
                content = renderMachineModal(modalData);
                break;
            default:
                return null;
        }

        return (
            <div className="ch-modal-overlay" onClick={closeModal}>
                <div className="ch-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="ch-modal-header">
                        <h3 className="ch-modal-title">{title}</h3>
                        <button className="ch-modal-close" onClick={closeModal}>
                            <FaTimes />
                        </button>
                    </div>
                    <div className="ch-modal-body-wrap">
                        {content}
                    </div>
                    <div className="ch-modal-footer">
                        <button className="ch-modal-close-btn" onClick={closeModal}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= MAIN RENDER =============
    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="ch-wrapper">
                {/* <div className="ch-page-header">
                    <h2 className="ch-page-title">
                        <FaClipboardList /> Customer History
                    </h2>
                </div> */}

                {/* Customer Selector */}
                <div className="ch-selector-card">
                    <label className="ch-selector-label">
                        <FaUser /> Select Customer
                    </label>
                    <Select
                        options={customers.map(c => ({
                            value: c.customerId,
                            label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                        }))}
                        styles={selectStyles}
                        className="ch-react-select"
                        classNamePrefix="ch-select"
                        placeholder={isLoadingCustomers ? "Loading customers..." : "Search and select a customer..."}
                        isSearchable
                        isClearable
                        isLoading={isLoadingCustomers}
                        value={selectedCustomer ? {
                            value: selectedCustomer.customerId,
                            label: `${selectedCustomer.customerName} ${selectedCustomer.contactNumber ? `(${selectedCustomer.contactNumber})` : ''}`
                        } : null}
                        onChange={handleCustomerSelect}
                    />
                </div>

                {/* Content */}
                {!selectedCustomer ? (
                    <div className="ch-empty-state">
                        <FaUser size={60} color="#ccc" />
                        <p>Please select a customer to view their history</p>
                    </div>
                ) : isLoadingCustomer ? (
                    <div className="ch-loading-big">
                        <div className="ch-spinner-big"></div>
                        <p>Loading customer history...</p>
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="ch-tabs">
                            {TABS.map(t => (
                                <button
                                    key={t.key}
                                    className={`ch-tab-btn ${activeTab === t.key ? 'ch-tab-btn-active' : ''}`}
                                    onClick={() => setActiveTab(t.key)}
                                >
                                    {t.icon}
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="ch-tab-body">
                            {activeTab === 'overview' && renderOverview()}
                            {activeTab === 'sales' && renderSalesTab()}
                            {activeTab === 'quotations' && renderQuotationsTab()}
                            {activeTab === 'amc' && renderAmcTab()}
                            {activeTab === 'stamping' && renderStampingTab()}
                            {activeTab === 'repairing' && renderRepairingTab()}
                        </div>
                    </>
                )}

                {/* Modal */}
                {renderModal()}
            </div>
        </Navbar>
    );
};

export default CustomerHistory;