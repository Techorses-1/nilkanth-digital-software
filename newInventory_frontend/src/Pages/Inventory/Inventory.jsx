import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaPlus,
    FaMinus,
    FaSearch,
    FaBoxes,
    FaBox,
    FaShoppingCart,
    FaUser,
    FaCalendarAlt,
    FaFileExcel,
    FaHistory,
    FaEye,
    FaTimes,
    FaRupeeSign,
    FaInfoCircle,
    FaChevronLeft,
    FaChevronRight,
    FaStore
} from "react-icons/fa";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Inventory.scss";
import "react-toastify/dist/ReactToastify.css";

// Get token from localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };
};

// React-Select styles
const selectStyles = {
    control: (base) => ({
        ...base,
        minHeight: '40px',
        borderColor: '#ddd',
        borderRadius: '6px',
        boxShadow: 'none',
        '&:hover': {
            borderColor: '#7366ff'
        }
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#f0f0ff' : 'white',
        color: '#333',
        cursor: 'pointer',
        '&:active': {
            backgroundColor: '#e8e8ff'
        }
    }),
    placeholder: (base) => ({
        ...base,
        color: '#999'
    }),
    menu: (base) => ({
        ...base,
        zIndex: 999
    })
};

// Store Type Options
const STORE_TYPES = [
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

const Inventory = () => {
    const [activeTab, setActiveTab] = useState("items");
    const [storeTab, setStoreTab] = useState("Vadodara");

    // ============= STATE =============
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [inventoryData, setInventoryData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // ============= PAGINATION STATE =============
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    // ============= MODAL STATES =============
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedInventory, setSelectedInventory] = useState(null);
    const [modalHistory, setModalHistory] = useState([]);

    // ============= DEBOUNCE =============
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // ============= FETCH DATA =============
    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            fetchInventory();
        }
    }, [activeTab, storeTab, debouncedSearch, pagination.page]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();

            const [itemsRes, productsRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/products-master/get-products`, headers),
            ]);

            const itemsData = itemsRes.data?.data || itemsRes.data || [];
            const productsData = productsRes.data?.data || productsRes.data || [];

            setItems(Array.isArray(itemsData) ? itemsData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);

            await fetchInventory();
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data.");
            }
            setItems([]);
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInventory = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-inventory/get-all`
                : `${import.meta.env.VITE_API_URL}/product-inventory/get-all`;

            const response = await axios.get(endpoint, {
                ...headers,
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debouncedSearch,
                    storeType: storeTab
                }
            });

            if (response.data.success) {
                setInventoryData(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setInventoryData([]);
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setInventoryData([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= GET ALL ITEMS/PRODUCTS FOR DROPDOWN =============
    const allItems = useMemo(() => {
        const data = activeTab === "items" ? items : products;
        return Array.isArray(data) ? data : [];
    }, [activeTab, items, products]);

    // ============= DROPDOWN OPTIONS =============
    const productOptions = useMemo(() => {
        const data = Array.isArray(allItems) ? allItems : [];
        return data.map((item) => ({
            value: activeTab === "items" ? item.itemId : item.productId,
            label: activeTab === "items" ? item.itemName : item.productName
        }));
    }, [allItems, activeTab]);

    const vendorOptions = useMemo(() => {
        const data = Array.isArray(allItems) ? allItems : [];
        return data.map((item) => {
            const inv = inventoryData.find(
                i => (activeTab === "items" ? i.itemId : i.productId) ===
                    (activeTab === "items" ? item.itemId : item.productId)
            );
            return {
                value: activeTab === "items" ? item.itemId : item.productId,
                label: `${activeTab === "items" ? item.itemName : item.productName} ${inv ? `(${inv.totalQuantity || 0} available)` : ''}`
            };
        });
    }, [allItems, inventoryData, activeTab]);

    // ============= VALIDATION SCHEMAS =============
    const addValidationSchema = Yup.object({
        productId: Yup.string().required("Please select a product/item"),
        quantity: Yup.number()
            .required("Quantity is required")
            .min(0.01, "Quantity must be greater than 0")
            .typeError("Quantity must be a number"),
        purchasePrice: Yup.number()
            .min(0, "Price cannot be negative")
            .typeError("Price must be a number"),
        date: Yup.date().required("Date is required"),
    });

    const removeValidationSchema = Yup.object({
        productId: Yup.string().required("Please select a product/item"),
        quantity: Yup.number()
            .required("Quantity is required")
            .min(0.01, "Quantity must be greater than 0")
            .typeError("Quantity must be a number"),
        date: Yup.date().required("Date is required"),
    });

    // ============= HANDLE ADD QUANTITY =============
    const handleAddQuantity = async (values, { resetForm, setFieldError }) => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                return;
            }

            const payload = {
                [activeTab === "items" ? "itemId" : "productId"]: values.productId,
                quantity: Number(values.quantity),
                purchasePrice: Number(values.purchasePrice) || 0,
                date: values.date || new Date(),
                notes: values.notes || '',
                storeType: storeTab
            };

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-inventory/add`
                : `${import.meta.env.VITE_API_URL}/product-inventory/add`;

            const response = await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success(response.data.message || "Quantity added successfully!");
            await fetchInventory();
            resetForm();
            setShowAddModal(false);
        } catch (error) {
            console.error("Error adding quantity:", error);
            toast.error(error.response?.data?.message || "Failed to add quantity");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============= HANDLE REMOVE QUANTITY =============
    const handleRemoveQuantity = async (values, { resetForm, setFieldError }) => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                return;
            }

            // Find the inventory to check available quantity
            const inventory = inventoryData.find(
                inv => (activeTab === "items" ? inv.itemId : inv.productId) === values.productId
            );

            if (!inventory) {
                toast.error("Inventory not found for this store");
                return;
            }

            if (inventory.totalQuantity < Number(values.quantity)) {
                toast.error(`Insufficient quantity. Available: ${inventory.totalQuantity}`);
                return;
            }

            const payload = {
                [activeTab === "items" ? "itemId" : "productId"]: values.productId,
                quantity: Number(values.quantity),
                date: values.date || new Date(),
                reason: values.reason || '',
                storeType: storeTab
            };

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-inventory/remove`
                : `${import.meta.env.VITE_API_URL}/product-inventory/remove`;

            const response = await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success(response.data.message || "Quantity removed successfully!");
            await fetchInventory();
            resetForm();
            setShowRemoveModal(false);
        } catch (error) {
            console.error("Error removing quantity:", error);
            toast.error(error.response?.data?.message || "Failed to remove quantity");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============= FETCH HISTORY FOR MODAL =============
    const fetchHistory = async (id) => {
        try {
            const headers = getAuthHeaders();
            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-inventory/get-history/${id}?storeType=${storeTab}`
                : `${import.meta.env.VITE_API_URL}/product-inventory/get-history/${id}?storeType=${storeTab}`;

            const response = await axios.get(endpoint, headers);
            return response.data;
        } catch (error) {
            console.error("Error fetching history:", error);
            return null;
        }
    };

    // ============= OPEN HISTORY MODAL =============
    const openHistoryModal = async (inventory) => {
        setSelectedInventory(inventory);
        setShowHistoryModal(true);

        const id = activeTab === "items" ? inventory.itemId : inventory.productId;
        const historyData = await fetchHistory(id);
        if (historyData && historyData.success) {
            setModalHistory(historyData.data?.history || []);
        }
    };

    const closeHistoryModal = () => {
        setShowHistoryModal(false);
        setSelectedInventory(null);
        setModalHistory([]);
    };

    // ============= EXPORT TO EXCEL =============
    const exportToExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                return;
            }

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-inventory/export`
                : `${import.meta.env.VITE_API_URL}/product-inventory/export`;

            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    search: debouncedSearch || '',
                    storeType: storeTab
                }
            });

            if (response.data.success) {
                const data = response.data.data || [];

                if (data.length === 0) {
                    toast.warning("No data to export");
                    return;
                }

                const exportData = data.map((inv) => ({
                    [activeTab === "items" ? "Item Name" : "Product Name"]:
                        activeTab === "items" ? inv.itemName : inv.productName,
                    "Store": inv.storeType || storeTab,
                    "Total Quantity": inv.totalQuantity || 0,
                    "Average Price": inv.averagePurchasePrice || 0,
                    "Unit": inv.unitName || "N/A",
                    "Last Updated": inv.updatedAt ? new Date(inv.updatedAt).toLocaleString() : "N/A",
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    `${activeTab}_inventory`
                );
                XLSX.writeFile(
                    workbook,
                    `${activeTab}_inventory_${storeTab}_${new Date().toISOString().split("T")[0]}.xlsx`
                );
                toast.success(`Exported ${data.length} records successfully!`);
            } else {
                toast.error("Failed to export data");
            }
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error.response?.data?.message || "Failed to export");
        } finally {
            setIsExporting(false);
        }
    };

    // ============= FORMAT DATE =============
    const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleString();
    };

    // ============= PAGINATION HANDLERS =============
    const nextPage = () => {
        if (pagination.hasNext) {
            setPagination(prev => ({ ...prev, page: prev.page + 1 }));
        }
    };

    const prevPage = () => {
        if (pagination.hasPrev) {
            setPagination(prev => ({ ...prev, page: prev.page - 1 }));
        }
    };

    // ============= RENDER ADD MODAL =============
    const renderAddModal = () => (
        <div className="inventory-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="inventory-modal-content inventory-modal-small" onClick={(e) => e.stopPropagation()}>
                <div className="inventory-modal-header">
                    <h3 className="inventory-modal-title">
                        <FaPlus style={{ color: '#28a745' }} /> Add Quantity
                        <span className="inventory-modal-store-badge">{storeTab}</span>
                    </h3>
                    <button className="inventory-modal-close" onClick={() => setShowAddModal(false)}>
                        <FaTimes />
                    </button>
                </div>

                <div className="inventory-modal-body">
                    <Formik
                        initialValues={{
                            productId: "",
                            quantity: "",
                            purchasePrice: "",
                            date: new Date().toISOString().split("T")[0],
                            notes: "",
                        }}
                        validationSchema={addValidationSchema}
                        onSubmit={handleAddQuantity}
                    >
                        {({ setFieldValue, values }) => (
                            <Form className="inventory-form">
                                <div className="inventory-form-row">
                                    <div className="inventory-form-field inventory-form-field-full">
                                        <label className="inventory-form-label">
                                            <FaBoxes /> {activeTab === "items" ? "Item" : "Product"} *
                                        </label>
                                        <Select
                                            options={productOptions}
                                            styles={selectStyles}
                                            className="inventory-react-select"
                                            classNamePrefix="inventory-select"
                                            placeholder={`Search ${activeTab === "items" ? "Item" : "Product"}...`}
                                            isSearchable
                                            onChange={(option) => {
                                                setFieldValue("productId", option ? option.value : "");
                                            }}
                                            value={productOptions.find(opt => opt.value === values.productId)}
                                        />
                                        <ErrorMessage name="productId" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <div className="inventory-form-row">
                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaCalendarAlt /> Date *
                                        </label>
                                        <Field
                                            name="date"
                                            type="date"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="date" component="div" className="inventory-error" />
                                    </div>

                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaShoppingCart /> Quantity *
                                        </label>
                                        <Field
                                            name="quantity"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="Enter quantity"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="quantity" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <div className="inventory-form-row">
                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaRupeeSign /> Purchase Price (Optional)
                                        </label>
                                        <Field
                                            name="purchasePrice"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Enter price"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="purchasePrice" component="div" className="inventory-error" />
                                    </div>

                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaInfoCircle /> Notes (Optional)
                                        </label>
                                        <Field
                                            name="notes"
                                            type="text"
                                            placeholder="Add notes..."
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="notes" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <button type="submit" className="inventory-add-btn" disabled={isSubmitting}>
                                    {isSubmitting ? "Adding..." : "Add Quantity"}
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            </div>
        </div>
    );

    // ============= RENDER REMOVE MODAL =============
    const renderRemoveModal = () => (
        <div className="inventory-modal-overlay" onClick={() => setShowRemoveModal(false)}>
            <div className="inventory-modal-content inventory-modal-small" onClick={(e) => e.stopPropagation()}>
                <div className="inventory-modal-header">
                    <h3 className="inventory-modal-title inventory-remove-title">
                        <FaMinus style={{ color: '#dc3545' }} /> Remove Quantity
                        <span className="inventory-modal-store-badge">{storeTab}</span>
                    </h3>
                    <button className="inventory-modal-close" onClick={() => setShowRemoveModal(false)}>
                        <FaTimes />
                    </button>
                </div>

                <div className="inventory-modal-body">
                    <Formik
                        initialValues={{
                            productId: "",
                            quantity: "",
                            date: new Date().toISOString().split("T")[0],
                            reason: "",
                        }}
                        validationSchema={removeValidationSchema}
                        onSubmit={handleRemoveQuantity}
                    >
                        {({ setFieldValue, values }) => (
                            <Form className="inventory-form">
                                <div className="inventory-form-row">
                                    <div className="inventory-form-field inventory-form-field-full">
                                        <label className="inventory-form-label">
                                            <FaBoxes /> {activeTab === "items" ? "Item" : "Product"} *
                                        </label>
                                        <Select
                                            options={vendorOptions}
                                            styles={selectStyles}
                                            className="inventory-react-select"
                                            classNamePrefix="inventory-select"
                                            placeholder={`Search ${activeTab === "items" ? "Item" : "Product"}...`}
                                            isSearchable
                                            onChange={(option) => {
                                                setFieldValue("productId", option ? option.value : "");
                                            }}
                                            value={vendorOptions.find(opt => opt.value === values.productId)}
                                        />
                                        <ErrorMessage name="productId" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <div className="inventory-form-row">
                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaCalendarAlt /> Date *
                                        </label>
                                        <Field
                                            name="date"
                                            type="date"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="date" component="div" className="inventory-error" />
                                    </div>

                                    <div className="inventory-form-field">
                                        <label className="inventory-form-label">
                                            <FaShoppingCart /> Quantity to Remove *
                                        </label>
                                        <Field
                                            name="quantity"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="Enter quantity"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="quantity" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <div className="inventory-form-row">
                                    <div className="inventory-form-field inventory-form-field-full">
                                        <label className="inventory-form-label">
                                            <FaInfoCircle /> Reason (Optional)
                                        </label>
                                        <Field
                                            name="reason"
                                            type="text"
                                            placeholder="Why removing?"
                                            className="inventory-input-field"
                                        />
                                        <ErrorMessage name="reason" component="div" className="inventory-error" />
                                    </div>
                                </div>

                                <button type="submit" className="inventory-remove-btn" disabled={isSubmitting}>
                                    {isSubmitting ? "Removing..." : "Remove Quantity"}
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            </div>
        </div>
    );

    // ============= RENDER HISTORY MODAL =============
    const renderHistoryModal = () => {
        if (!showHistoryModal || !selectedInventory) return null;

        const name = activeTab === "items"
            ? selectedInventory.itemName
            : selectedInventory.productName;

        return (
            <div className="inventory-modal-overlay" onClick={closeHistoryModal}>
                <div className="inventory-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="inventory-modal-header">
                        <h3 className="inventory-modal-title">
                            <FaHistory /> {name} - Transaction History
                            <span className="inventory-modal-stock">
                                Stock: {selectedInventory.totalQuantity || 0} {selectedInventory.unitName || ""}
                            </span>
                            <span className="inventory-modal-store-badge">{selectedInventory.storeType}</span>
                        </h3>
                        <button className="inventory-modal-close" onClick={closeHistoryModal}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="inventory-modal-body">
                        {modalHistory.length === 0 ? (
                            <div className="inventory-modal-empty">
                                <p>No transactions found</p>
                            </div>
                        ) : (
                            <div className="inventory-modal-table-wrap">
                                <table className="inventory-modal-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Type</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Store</th>
                                            <th>Admin</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modalHistory.map((entry, idx) => (
                                            <tr key={entry.entryId || idx} className="inventory-modal-row">
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <span className={`inventory-modal-type ${entry.type === 'ADD' ? 'inventory-type-add' : 'inventory-type-remove'}`}>
                                                        {entry.type === 'ADD' ? 'ADD' : 'REMOVE'}
                                                    </span>
                                                </td>
                                                <td>{entry.quantity}</td>
                                                <td>
                                                    {entry.type === 'ADD' && entry.price > 0
                                                        ? `₹${entry.price.toFixed(2)}`
                                                        : '-'}
                                                </td>
                                                <td>
                                                    <span className="inventory-modal-store-tag">{entry.store || 'N/A'}</span>
                                                </td>
                                                <td>
                                                    <span className="inventory-modal-user">
                                                        <FaUser /> {entry.admin || "N/A"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="inventory-modal-date">
                                                        <FaCalendarAlt /> {formatDate(entry.date)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="inventory-modal-footer">
                        <button className="inventory-modal-close-btn" onClick={closeHistoryModal}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="inventory-table-container">
            <div className="inventory-table-header">
                <div className="inventory-search-container">
                    <FaSearch className="inventory-search-icon" />
                    <input
                        type="text"
                        className="inventory-search-input"
                        placeholder={`Search ${activeTab === "items" ? "Item" : "Product"} Inventory...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="inventory-action-buttons">
                    <button
                        className="inventory-add-modal-btn"
                        onClick={() => setShowAddModal(true)}
                        disabled={isLoading}
                    >
                        <FaPlus /> Add
                    </button>
                    <button
                        className="inventory-remove-modal-btn"
                        onClick={() => setShowRemoveModal(true)}
                        disabled={isLoading}
                    >
                        <FaMinus /> Remove
                    </button>
                    <button
                        className="inventory-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="inventory-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export"}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="inventory-loading-container">
                    <div className="inventory-loading-spinner"></div>
                    <p>Loading inventory...</p>
                </div>
            ) : inventoryData.length === 0 ? (
                <div className="inventory-empty-state">
                    <FaHistory size={50} color="#ccc" />
                    <p>No inventory records found for {storeTab} store</p>
                </div>
            ) : (
                <>
                    <div className="inventory-table-responsive">
                        <table className="inventory-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{activeTab === "items" ? "Item" : "Product"}</th>
                                    <th>Unit</th>
                                    <th>Total Quantity</th>
                                    <th>Avg. Price</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventoryData.map((inv, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={inv.inventoryId} className="inventory-table-row">
                                            <td>{serialNo}</td>
                                            <td className="inventory-product-name">
                                                <strong>{activeTab === "items" ? inv.itemName : inv.productName}</strong>
                                            </td>
                                            <td>{inv.unitName || "N/A"}</td>
                                            <td>
                                                <span className="inventory-quantity-badge">{inv.totalQuantity || 0}</span>
                                            </td>
                                            <td>
                                                {inv.averagePurchasePrice > 0
                                                    ? `₹${inv.averagePurchasePrice.toFixed(2)}`
                                                    : "N/A"}
                                            </td>
                                            <td>
                                                <button
                                                    className="inventory-history-btn"
                                                    onClick={() => openHistoryModal(inv)}
                                                >
                                                    <FaEye /> History
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="inventory-pagination">
                            <div className="inventory-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="inventory-pagination-buttons">
                                <button
                                    className="inventory-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="inventory-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="inventory-page-btn"
                                    onClick={nextPage}
                                    disabled={!pagination.hasNext || isLoading}
                                >
                                    Next <FaChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // ============= MAIN RENDER =============
    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="inventory-module-wrapper">
                <div className="inventory-page-header">
                    <h2 className="inventory-page-title">Inventory Management</h2>
                    <div className="inventory-header-right">
                        <div className="inventory-store-tabs-container">
                            <button
                                className={`inventory-store-tab-btn ${storeTab === "Vadodara" ? "inventory-store-tab-active" : ""}`}
                                onClick={() => {
                                    setStoreTab("Vadodara");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaStore /> Vadodara
                            </button>
                            <button
                                className={`inventory-store-tab-btn ${storeTab === "Padra" ? "inventory-store-tab-active" : ""}`}
                                onClick={() => {
                                    setStoreTab("Padra");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaStore /> Padra
                            </button>
                        </div>
                        <div className="inventory-tabs-container">
                            <button
                                className={`inventory-tab-btn ${activeTab === "items" ? "inventory-tab-active" : ""}`}
                                onClick={() => {
                                    setActiveTab("items");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaBoxes /> Item Inventory
                            </button>
                            <button
                                className={`inventory-tab-btn ${activeTab === "products" ? "inventory-tab-active" : ""}`}
                                onClick={() => {
                                    setActiveTab("products");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaBox /> Product Inventory
                            </button>
                        </div>
                    </div>
                </div>

                <div className="inventory-content-wrapper">
                    {renderTable()}
                </div>

                {showAddModal && renderAddModal()}
                {showRemoveModal && renderRemoveModal()}
                {renderHistoryModal()}
            </div>
        </Navbar>
    );
};

export default Inventory;