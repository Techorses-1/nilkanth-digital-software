import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaPlus,
    FaSearch,
    FaTrash,
    FaBoxes,
    FaBox,
    FaBuilding,
    FaShoppingCart,
    FaUser,
    FaCalendarAlt,
    FaFileExcel,
    FaHistory,
    FaEye,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaRupeeSign,
    FaStore,
    FaUserTie,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaIdCard
} from "react-icons/fa";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Purchase.scss";
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

const Purchase = () => {
    const [activeTab, setActiveTab] = useState("items");
    const [storeTab, setStoreTab] = useState("Vadodara");

    // ============= STATE =============
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [purchases, setPurchases] = useState([]);
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

    // ============= FORM PANEL STATE =============
    const [showForm, setShowForm] = useState(false);

    // ============= MODAL STATES =============
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // ============= VENDOR MODAL STATE =============
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [isVendorSubmitting, setIsVendorSubmitting] = useState(false);

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
            fetchPurchases();
        }
    }, [activeTab, storeTab, debouncedSearch, pagination.page]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();

            const [itemsRes, productsRes, vendorsRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/products-master/get-products`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/vendors/get-vendors`, headers),
            ]);

            const itemsData = itemsRes.data?.data || itemsRes.data || [];
            const productsData = productsRes.data?.data || productsRes.data || [];
            const vendorsData = vendorsRes.data?.data || vendorsRes.data || [];

            setItems(Array.isArray(itemsData) ? itemsData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);
            setVendors(Array.isArray(vendorsData) ? vendorsData : []);

            await fetchPurchases();
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data.");
            }
            setItems([]);
            setProducts([]);
            setVendors([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPurchases = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-purchase/get-all`
                : `${import.meta.env.VITE_API_URL}/product-purchase/get-all`;

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
                setPurchases(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setPurchases([]);
            }
        } catch (error) {
            console.error("Error fetching purchases:", error);
            setPurchases([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= VENDOR FORM =============
    const vendorInitialValues = {
        vendorName: "",
        companyName: "",
        email: "",
        contactNumber: "",
        gstNumber: "",
        address: ""
    };

    const vendorValidationSchema = Yup.object({
        vendorName: Yup.string()
            .required("Vendor Name is required")
            .matches(/^(?![0-9]+$)[a-zA-Z0-9\s]*$/, "Vendor Name cannot contain only numbers"),
        companyName: Yup.string()
            .required("Company Name is required")
            .matches(/^(?![0-9]+$)[a-zA-Z0-9\s]*$/, "Company Name cannot contain only numbers"),
        email: Yup.string().email("Invalid email format"),
        contactNumber: Yup.string()
            .matches(/^[0-9]+$/, "Contact Number must contain only digits")
            .min(10, "Contact Number must be exactly 10 digits")
            .max(10, "Contact Number must be exactly 10 digits"),
        gstNumber: Yup.string()
            .matches(/^[0-9A-Z]+$/, "GST Number must contain only uppercase letters and digits")
            .min(15, "GST Number must be 15 characters")
            .max(15, "GST Number must be 15 characters"),
        address: Yup.string()
    });

    // ============= HANDLE CREATE VENDOR =============
    const handleCreateVendor = async (values, { resetForm, setFieldError }) => {
        setIsVendorSubmitting(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/vendors/create-vendors`,
                values,
                headers
            );

            toast.success(response.data.message || "Vendor created successfully!");

            const newVendor = response.data.data || response.data;
            setVendors(prev => [...prev, newVendor]);

            // ✅ Auto-select the newly created vendor
            // Set the vendor as selected in the form
            // We need to update the Formik values through the parent

            resetForm();
            setShowVendorModal(false);

            // Pass the new vendor to be selected
            // We'll handle this through a ref or callback

            return newVendor;

        } catch (error) {
            if (error.response?.data?.field === "email") {
                setFieldError("email", "Vendor with this email already exists");
                toast.error("Vendor with this email already exists");
            } else {
                toast.error(error.response?.data?.message || "Failed to create vendor");
            }
        } finally {
            setIsVendorSubmitting(false);
        }
    };

    // ============= VALIDATION SCHEMA =============
    const validationSchema = Yup.object({
        productId: Yup.string().required("Please select a product/item"),
        vendorId: Yup.string().required("Please select a vendor"),
        quantity: Yup.number()
            .required("Quantity is required")
            .min(0.01, "Quantity must be greater than 0")
            .typeError("Quantity must be a number"),
        purchasePrice: Yup.number()
            .min(0, "Price cannot be negative")
            .typeError("Price must be a number")
    });

    // ============= GET PRODUCTS FOR CURRENT TAB =============
    const currentProducts = useMemo(() => {
        const data = activeTab === "items" ? items : products;
        return Array.isArray(data) ? data : [];
    }, [activeTab, items, products]);

    // ============= DROPDOWN OPTIONS =============
    const productOptions = useMemo(() => {
        const data = Array.isArray(currentProducts) ? currentProducts : [];
        return data.map((item) => ({
            value: activeTab === "items" ? item.itemId : item.productId,
            label: activeTab === "items" ? item.itemName : item.productName
        }));
    }, [currentProducts, activeTab]);

    const vendorOptions = useMemo(() => {
        const data = Array.isArray(vendors) ? vendors : [];
        return data.map((vendor) => ({
            value: vendor.vendorId,
            label: vendor.vendorName || vendor.companyName
        }));
    }, [vendors]);

    // ============= CALCULATE TOTAL QUANTITY =============
    const getTotalQuantity = (purchase) => {
        if (!purchase?.purchaseHistory) return 0;
        return purchase.purchaseHistory
            .filter(entry => !entry.isDeleted)
            .reduce((sum, entry) => sum + entry.quantity, 0);
    };

    // ============= HANDLE SUBMIT =============
    const handleSubmit = async (values, { resetForm, setFieldError, setFieldValue }) => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');

            if (!token) {
                toast.error("Please login first");
                return;
            }

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-purchase/add`
                : `${import.meta.env.VITE_API_URL}/product-purchase/add`;

            const payload = {
                [activeTab === "items" ? "itemId" : "productId"]: values.productId,
                vendorId: values.vendorId,
                quantity: Number(values.quantity),
                purchasePrice: Number(values.purchasePrice) || 0,
                storeType: storeTab
            };

            const response = await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success(response.data.message || "Purchase added successfully!");

            // ✅ Reset form and clear select fields
            resetForm();
            setFieldValue("productId", "");
            setFieldValue("vendorId", "");
            setFieldValue("quantity", "");
            setFieldValue("purchasePrice", "");

            await fetchPurchases();
            setShowForm(false);
        } catch (error) {
            console.error("Error adding purchase:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error(error.response?.data?.message || "Failed to add purchase");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============= HANDLE DELETE ENTRY (from modal) =============
    const handleDeleteEntry = async (purchaseId, entryId) => {
        if (!window.confirm("Are you sure you want to delete this entry?")) return;

        try {
            const token = localStorage.getItem('token');

            const endpoint = activeTab === "items"
                ? `${import.meta.env.VITE_API_URL}/item-purchase/delete-entry/${purchaseId}/${entryId}`
                : `${import.meta.env.VITE_API_URL}/product-purchase/delete-entry/${purchaseId}/${entryId}`;

            await axios.delete(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success("Entry deleted successfully!");
            await fetchPurchases();

            const updatedPurchase = purchases.find(p => p.purchaseId === purchaseId);
            if (updatedPurchase) {
                setSelectedPurchase(updatedPurchase);
            }
        } catch (error) {
            console.error("Error deleting entry:", error);
            toast.error(error.response?.data?.message || "Failed to delete entry");
        }
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
                ? `${import.meta.env.VITE_API_URL}/item-purchase/export`
                : `${import.meta.env.VITE_API_URL}/product-purchase/export`;

            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    search: debouncedSearch || '',
                    storeType: storeTab
                }
            });

            if (response.data.success) {
                const data = response.data.data || [];
                const allEntries = [];

                data.forEach((purchase) => {
                    const productName = activeTab === "items" ? purchase.itemName : purchase.productName;

                    purchase.purchaseHistory?.forEach((entry) => {
                        if (!entry.isDeleted) {
                            allEntries.push({
                                "Product Name": productName || "N/A",
                                Vendor: entry.vendorName || "N/A",
                                Quantity: entry.quantity || 0,
                                "Purchase Price": entry.purchasePrice || 0,
                                "Added By": entry.addedBy || "N/A",
                                "Added Date": entry.addedAt
                                    ? new Date(entry.addedAt).toLocaleString()
                                    : "N/A",
                            });
                        }
                    });
                });

                if (allEntries.length === 0) {
                    toast.warning("No data to export");
                    return;
                }

                const worksheet = XLSX.utils.json_to_sheet(allEntries);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    `${activeTab}_purchases`
                );
                XLSX.writeFile(
                    workbook,
                    `${activeTab}_purchases_${storeTab}_${new Date().toISOString().split("T")[0]}.xlsx`
                );
                toast.success(`Exported ${allEntries.length} records successfully!`);
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

    // ============= OPEN MODAL =============
    const openModal = (purchase) => {
        setSelectedPurchase(purchase);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedPurchase(null);
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

    // ============= RENDER VENDOR MODAL =============
    const renderVendorModal = () => (
        <div className="purchase-modal-overlay" onClick={() => setShowVendorModal(false)}>
            <div className="purchase-modal-content purchase-modal-small" onClick={(e) => e.stopPropagation()}>
                <div className="purchase-modal-header">
                    <h3 className="purchase-modal-title">
                        <FaPlus style={{ color: '#28a745' }} /> Add New Vendor
                    </h3>
                    <button className="purchase-modal-close" onClick={() => setShowVendorModal(false)}>
                        <FaTimes />
                    </button>
                </div>

                <div className="purchase-modal-body">
                    <Formik
                        initialValues={vendorInitialValues}
                        validationSchema={vendorValidationSchema}
                        onSubmit={async (values, actions) => {
                            const newVendor = await handleCreateVendor(values, actions);
                            if (newVendor) {
                                // ✅ Auto-select the new vendor in parent form
                                // We'll handle this through setFieldValue
                                // This is a bit tricky since we're in a separate component
                                // We'll use a ref or callback approach
                            }
                        }}
                    >
                        {({ setFieldValue, values }) => (
                            <Form className="purchase-form">
                                <div className="purchase-form-row">
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaUserTie /> Vendor Name *
                                        </label>
                                        <Field name="vendorName" type="text" placeholder="Enter vendor name" />
                                        <ErrorMessage name="vendorName" component="div" className="purchase-error" />
                                    </div>
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaBuilding /> Company Name *
                                        </label>
                                        <Field name="companyName" type="text" placeholder="Enter company name" />
                                        <ErrorMessage name="companyName" component="div" className="purchase-error" />
                                    </div>
                                </div>

                                <div className="purchase-form-row">
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaEnvelope /> Email
                                        </label>
                                        <Field name="email" type="email" placeholder="Enter email" />
                                        <ErrorMessage name="email" component="div" className="purchase-error" />
                                    </div>
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaPhone /> Contact Number
                                        </label>
                                        <Field name="contactNumber" type="text" placeholder="10 digits" />
                                        <ErrorMessage name="contactNumber" component="div" className="purchase-error" />
                                    </div>
                                </div>

                                <div className="purchase-form-row">
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaIdCard /> GST Number
                                        </label>
                                        <Field name="gstNumber" type="text" placeholder="15 characters" />
                                        <ErrorMessage name="gstNumber" component="div" className="purchase-error" />
                                    </div>
                                    <div className="purchase-form-field">
                                        <label className="purchase-form-label">
                                            <FaMapMarkerAlt /> Address
                                        </label>
                                        <Field name="address" as="textarea" rows="2" placeholder="Enter address" />
                                        <ErrorMessage name="address" component="div" className="purchase-error" />
                                    </div>
                                </div>

                                <button type="submit" className="purchase-submit-btn" disabled={isVendorSubmitting}>
                                    {isVendorSubmitting ? "Creating..." : "Create Vendor"}
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            </div>
        </div>
    );

    // ============= RENDER FORM =============
    const renderForm = () => (
        <div className="purchase-form-container">
            <div className="purchase-form-container-header">
                <h2 className="purchase-form-title">
                    <FaStore style={{ color: '#7366ff' }} /> {storeTab} Store - {activeTab === "items" ? "Item Purchase" : "Product Purchase"}
                </h2>
                <button
                    type="button"
                    className="purchase-form-close-btn"
                    onClick={() => setShowForm(false)}
                    aria-label="Close form"
                    title="Close"
                >
                    <FaTimes />
                </button>
            </div>
            <Formik
                initialValues={{
                    productId: "",
                    vendorId: "",
                    quantity: "",
                    purchasePrice: ""
                }}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ values, setFieldValue, resetForm }) => (
                    <Form className="purchase-form">
                        <div className="purchase-form-row">
                            <div className="purchase-form-field">
                                <label className="purchase-form-label">
                                    <FaBoxes /> {activeTab === "items" ? "Item" : "Product"} *
                                </label>
                                <Select
                                    options={productOptions}
                                    styles={selectStyles}
                                    className="purchase-react-select"
                                    classNamePrefix="purchase-select"
                                    placeholder={`Search ${activeTab === "items" ? "Item" : "Product"}...`}
                                    isSearchable
                                    onChange={(option) => {
                                        setFieldValue("productId", option ? option.value : "");
                                    }}
                                    value={productOptions.find(opt => opt.value === values.productId)}
                                />
                                <ErrorMessage name="productId" component="div" className="purchase-error" />
                            </div>

                            <div className="purchase-form-field">
                                <label className="purchase-form-label">
                                    <FaBuilding /> Vendor *
                                </label>
                                <div className="purchase-vendor-row">
                                    <div className="purchase-vendor-select">
                                        <Select
                                            options={vendorOptions}
                                            styles={selectStyles}
                                            className="purchase-react-select"
                                            classNamePrefix="purchase-select"
                                            placeholder="Search Vendor..."
                                            isSearchable
                                            onChange={(option) => {
                                                setFieldValue("vendorId", option ? option.value : "");
                                            }}
                                            value={vendorOptions.find(opt => opt.value === values.vendorId)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="purchase-add-vendor-btn"
                                        onClick={() => setShowVendorModal(true)}
                                        title="Add New Vendor"
                                    >
                                        <FaPlus />
                                    </button>
                                </div>
                                <ErrorMessage name="vendorId" component="div" className="purchase-error" />
                            </div>
                        </div>

                        <div className="purchase-form-row">
                            <div className="purchase-form-field">
                                <label className="purchase-form-label">
                                    <FaShoppingCart /> Quantity *
                                </label>
                                <Field
                                    name="quantity"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="Enter quantity"
                                    className="purchase-input-field"
                                />
                                <ErrorMessage name="quantity" component="div" className="purchase-error" />
                            </div>

                            <div className="purchase-form-field">
                                <label className="purchase-form-label">
                                    <FaRupeeSign /> Purchase Price (Optional)
                                </label>
                                <Field
                                    name="purchasePrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Enter price"
                                    className="purchase-input-field"
                                />
                                <ErrorMessage name="purchasePrice" component="div" className="purchase-error" />
                            </div>
                        </div>

                        <button type="submit" className="purchase-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add Purchase"}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );

    // ============= RENDER MAIN TABLE =============
    const renderTable = () => (
        <div className="purchase-table-container">
            <div className="purchase-table-header">
                <div className="purchase-search-container">
                    <FaSearch className="purchase-search-icon" />
                    <input
                        type="text"
                        className="purchase-search-input"
                        placeholder={`Search ${activeTab === "items" ? "Item" : "Product"}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="purchase-action-buttons">
                    <button
                        className="purchase-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="purchase-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export"}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="purchase-loading-container">
                    <div className="purchase-loading-spinner"></div>
                    <p>Loading purchases...</p>
                </div>
            ) : purchases.length === 0 ? (
                <div className="purchase-empty-state">
                    <FaHistory size={50} color="#ccc" />
                    <p>No purchase records found for {storeTab} store</p>
                </div>
            ) : (
                <>
                    <div className="purchase-table-responsive">
                        <table className="purchase-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{activeTab === "items" ? "Item" : "Product"}</th>
                                    <th>Total Quantity</th>
                                    <th>Avg. Price</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.map((purchase, idx) => {
                                    const productName = activeTab === "items" ? purchase.itemName : purchase.productName;
                                    const totalQty = getTotalQuantity(purchase);
                                    const hasEntries = purchase.purchaseHistory?.some(e => !e.isDeleted);

                                    if (!hasEntries) return null;

                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;

                                    return (
                                        <tr key={purchase.purchaseId} className="purchase-table-row">
                                            <td>{serialNo}</td>
                                            <td className="purchase-product-name">
                                                <strong>{productName || "N/A"}</strong>
                                            </td>
                                            <td>
                                                <span className="purchase-quantity-badge">{totalQty}</span>
                                            </td>
                                            <td>
                                                <span className="purchase-price-badge">
                                                    ₹{purchase.averagePurchasePrice?.toFixed(2) || "0.00"}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="purchase-view-btn"
                                                    onClick={() => openModal(purchase)}
                                                >
                                                    <FaEye /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="purchase-pagination">
                            <div className="purchase-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="purchase-pagination-buttons">
                                <button
                                    className="purchase-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="purchase-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="purchase-page-btn"
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

    // ============= RENDER MODAL =============
    const renderModal = () => {
        if (!showModal || !selectedPurchase) return null;

        const productName = activeTab === "items" ? selectedPurchase.itemName : selectedPurchase.productName;

        const activeEntries = selectedPurchase.purchaseHistory?.filter(
            entry => !entry.isDeleted
        ) || [];

        return (
            <div className="purchase-modal-overlay" onClick={closeModal}>
                <div className="purchase-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="purchase-modal-header">
                        <h3 className="purchase-modal-title">
                            {productName} - Purchase History
                            <span className="purchase-modal-store-badge">{selectedPurchase.storeType}</span>
                        </h3>
                        <button className="purchase-modal-close" onClick={closeModal}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="purchase-modal-body">
                        {activeEntries.length === 0 ? (
                            <div className="purchase-modal-empty">
                                <p>No entries found</p>
                            </div>
                        ) : (
                            <div className="purchase-modal-table-wrap">
                                <table className="purchase-modal-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Vendor</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Added By</th>
                                            <th>Added At</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeEntries.map((entry, idx) => (
                                            <tr key={entry.entryId} className="purchase-modal-row">
                                                <td>{idx + 1}</td>
                                                <td>{entry.vendorName || "N/A"}</td>
                                                <td>
                                                    <span className="purchase-modal-qty">{entry.quantity}</span>
                                                </td>
                                                <td>
                                                    <span className="purchase-modal-price">
                                                        ₹{entry.purchasePrice?.toFixed(2) || "0.00"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="purchase-modal-user">
                                                        <FaUser /> {entry.addedBy || "N/A"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="purchase-modal-date">
                                                        <FaCalendarAlt /> {formatDate(entry.addedAt)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="purchase-modal-delete-btn"
                                                        onClick={() => handleDeleteEntry(selectedPurchase.purchaseId, entry.entryId)}
                                                        title="Delete this entry"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="purchase-modal-footer">
                        <button className="purchase-modal-close-btn" onClick={closeModal}>
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
            <div className="purchase-module-wrapper">
                <div className="purchase-page-header">
                    <h2 className="purchase-page-title"></h2>
                    <div className="purchase-header-right">
                        <div className="purchase-store-tabs-container">
                            <button
                                className={`purchase-store-tab-btn ${storeTab === "Vadodara" ? "purchase-store-tab-active" : ""}`}
                                onClick={() => {
                                    setStoreTab("Vadodara");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaStore /> Vadodara
                            </button>
                            <button
                                className={`purchase-store-tab-btn ${storeTab === "Padra" ? "purchase-store-tab-active" : ""}`}
                                onClick={() => {
                                    setStoreTab("Padra");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaStore /> Padra
                            </button>
                        </div>
                        <div className="purchase-tabs-container">
                            <button
                                className={`purchase-tab-btn ${activeTab === "items" ? "purchase-tab-active" : ""}`}
                                onClick={() => {
                                    setActiveTab("items");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaBoxes /> Item Purchases
                            </button>
                            <button
                                className={`purchase-tab-btn ${activeTab === "products" ? "purchase-tab-active" : ""}`}
                                onClick={() => {
                                    setActiveTab("products");
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                            >
                                <FaBox /> Product Purchases
                            </button>
                        </div>
                        <button
                            type="button"
                            className={`purchase-create-btn ${showForm ? "purchase-create-btn-active" : ""}`}
                            onClick={() => setShowForm(prev => !prev)}
                        >
                            {showForm ? <FaTimes /> : <FaPlus />}
                            {showForm ? "Close Form" : "Add Purchase"}
                        </button>
                    </div>
                </div>

                <div className="purchase-content-wrapper">
                    {showForm && (
                        <div className="purchase-form-panel">
                            {renderForm()}
                        </div>
                    )}
                    {renderTable()}
                </div>

                {renderModal()}
                {showVendorModal && renderVendorModal()}
            </div>
        </Navbar>
    );
};

export default Purchase;