import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaUser,
    FaBox,
    FaPlus,
    FaSearch,
    FaEdit,
    FaSave,
    FaTrash,
    FaFileExcel,
    FaEye,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaShoppingCart,
    FaRupeeSign,
    FaBuilding,
    FaPercent,
    FaInfoCircle,
    FaFileInvoice,
    FaStore,
    FaCalendarAlt,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaMinus,
    FaFilePdf,
    FaToggleOn,
    FaToggleOff,
    FaHashtag
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import SalesPrint from "./SalesPrint";
import "../Form/Form.scss";
import "./Sales.scss";
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

// Tax Slab Options
const TAX_OPTIONS = [
    { value: 0, label: "0%" },
    { value: 5, label: "5%" },
    { value: 12, label: "12%" },
    { value: 18, label: "18%" },
    { value: 28, label: "28%" }
];

// Store Type Options
const STORE_OPTIONS = [
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

// Payment Type Options
const PAYMENT_OPTIONS = [
    { value: "Cash", label: "Cash" },
    { value: "Bank", label: "Bank" },
    { value: "UPI", label: "UPI" },
    { value: "Cheque", label: "Cheque" }
];

const Sales = () => {
    // ============= STATE =============
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // ============= FORM STATE =============
    const [showForm, setShowForm] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [storeType, setStoreType] = useState("Vadodara");
    const [taxSlab, setTaxSlab] = useState(18);
    const [notes, setNotes] = useState("");
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editSaleId, setEditSaleId] = useState(null);

    // ============= NEW FIELDS =============
    const [paymentType, setPaymentType] = useState("Cash");
    const [isGstMode, setIsGstMode] = useState(true);

    // ============= MODAL STATES =============
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);

    // ============= PDF/PRINT STATE =============
    const [saleForPrint, setSaleForPrint] = useState(null);

    // ============= PAGINATION STATE =============
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    // ============= CUSTOMER FORM =============
    const customerInitialValues = {
        customerName: "",
        email: "",
        contactNumber: "",
        address: "",
        gstin: "",
        state: ""
    };

    const customerValidationSchema = Yup.object({
        customerName: Yup.string().required("Customer name is required"),
        email: Yup.string().email("Invalid email"),
        contactNumber: Yup.string()
            .required("Contact number is required")
            .matches(/^[0-9]{10}$/, "Must be exactly 10 digits"),
        address: Yup.string(),
        gstin: Yup.string()
            .matches(/^[0-9A-Z]{15}$/, "GSTIN must be 15 characters")
            .nullable(),
        state: Yup.string()
    });

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
            fetchSales();
        }
    }, [debouncedSearch, pagination.page]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();

            const [customersRes, productsRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/products-master/get-products`, headers),
            ]);

            const customersData = customersRes.data?.data || customersRes.data || [];
            const productsData = productsRes.data?.data || productsRes.data || [];

            setCustomers(Array.isArray(customersData) ? customersData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);

            await fetchSales();
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data.");
            }
            setCustomers([]);
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSales = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/sales/get-sales`,
                {
                    ...headers,
                    params: {
                        page: pagination.page,
                        limit: pagination.limit,
                        search: debouncedSearch
                    }
                }
            );

            if (response.data.success) {
                setSales(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setSales([]);
            }
        } catch (error) {
            console.error("Error fetching sales:", error);
            setSales([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= CUSTOMER HANDLERS =============
    const handleCreateCustomer = async (values, { resetForm, setFieldError }) => {
        try {
            const headers = getAuthHeaders();
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/customer/create-customer`,
                values,
                headers
            );

            toast.success(response.data.message || "Customer created successfully!");
            const newCustomer = response.data.data || response.data;
            setCustomers(prev => [...prev, newCustomer]);
            setSelectedCustomer(newCustomer);
            setShowCustomerModal(false);
            resetForm();
        } catch (error) {
            if (error.response?.data?.field === "email") {
                setFieldError("email", "Customer with this email already exists");
                toast.error("Customer with this email already exists");
            } else if (error.response?.data?.field === "contactNumber") {
                setFieldError("contactNumber", "Customer with this mobile number already exists");
                toast.error("Customer with this mobile number already exists");
            } else {
                toast.error(error.response?.data?.message || "Failed to create customer");
            }
        }
    };

    // ============= PRODUCT HANDLERS =============
    const handleAddProduct = () => {
        if (!selectedProduct) {
            toast.warning("Please select a product");
            return;
        }

        const exists = lineItems.some(item => item.productId === selectedProduct.productId);
        if (exists) {
            toast.warning("Product already added");
            setSelectedProduct(null);
            return;
        }

        const newItem = {
            productId: selectedProduct.productId,
            productName: selectedProduct.productName,
            productDescription: selectedProduct.productDescription || '',
            hsnCode: selectedProduct.hsnCode || '',
            unitName: selectedProduct.unitName || 'NOS',
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            discountAmount: 0,
            discountedUnitPrice: 0,
            finalPrice: 0,
            uniqueNumbers: [{ number: '', isUsed: false }] // ✅ Initialize with 1 empty slot
        };

        setLineItems(prev => [...prev, newItem]);
        setSelectedProduct(null);
        toast.success("Product added to cart");
    };

    const handleUpdateLineItem = (index, field, value) => {
        const updated = [...lineItems];
        updated[index][field] = Number(value) || 0;

        const discountFactor = (100 - updated[index].discountPercent) / 100;
        updated[index].discountedUnitPrice = updated[index].unitPrice * discountFactor;
        updated[index].discountAmount = updated[index].unitPrice - updated[index].discountedUnitPrice;
        updated[index].finalPrice = updated[index].discountedUnitPrice * updated[index].quantity;

        // ✅ Sync unique numbers with quantity
        const quantity = updated[index].quantity;
        const currentUniqueCount = updated[index].uniqueNumbers?.length || 0;

        if (currentUniqueCount < quantity) {
            const difference = quantity - currentUniqueCount;
            for (let i = 0; i < difference; i++) {
                updated[index].uniqueNumbers.push({ number: '', isUsed: false });
            }
        } else if (currentUniqueCount > quantity) {
            // Keep only first 'quantity' numbers
            updated[index].uniqueNumbers = updated[index].uniqueNumbers.slice(0, quantity);
        }

        setLineItems(updated);
    };

    // ✅ Handle unique number change
    const handleUniqueNumberChange = (productIndex, numberIndex, value) => {
        const updated = [...lineItems];
        updated[productIndex].uniqueNumbers[numberIndex].number = value;
        setLineItems(updated);
    };

    // ✅ Remove unique number manually (only when admin wants to)
    const handleRemoveUniqueNumber = (productIndex, numberIndex) => {
        const updated = [...lineItems];
        const item = updated[productIndex];

        // Don't allow removing if it would make count less than quantity
        if (item.uniqueNumbers.length <= item.quantity) {
            toast.warning("Cannot remove. Quantity is " + item.quantity);
            return;
        }

        item.uniqueNumbers.splice(numberIndex, 1);
        setLineItems(updated);
    };

    const handleRemoveLineItem = (index) => {
        if (lineItems.length <= 1) {
            toast.warning("Cannot remove the last product");
            return;
        }
        setLineItems(prev => prev.filter((_, i) => i !== index));
    };

    // ============= CALCULATIONS =============
    const calculateTotals = () => {
        let subtotal = 0;
        let totalDiscount = 0;

        lineItems.forEach(item => {
            subtotal += item.unitPrice * item.quantity;
            totalDiscount += item.discountAmount * item.quantity;
        });

        const taxableAmount = subtotal - totalDiscount;

        if (!isGstMode) {
            return {
                subtotal,
                totalDiscount,
                totalTax: 0,
                grandTotal: taxableAmount,
                taxableAmount: taxableAmount
            };
        }

        const taxRate = taxSlab / 100;
        const totalTax = taxableAmount * taxRate;
        const grandTotal = taxableAmount + totalTax;

        return { subtotal, totalDiscount, totalTax, grandTotal, taxableAmount };
    };

    const totals = calculateTotals();

    const generatePDF = async (sale, openWhatsApp = true) => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);

        try {
            setSaleForPrint(sale);
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = document.getElementById("sales-pdf");
            if (!element) {
                throw new Error("PDF element not found");
            }

            const opt = {
                filename: `${sale.invoiceNumber}_${(sale.customerName || "customer").replace(/\s+/g, "_")}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true
                },
                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait"
                },
                margin: [0, 0, 20, 0],
                pagebreak: {
                    mode: ['css', 'legacy']
                }
            };

            // ✅ Add "Developed by Techorses" on EVERY page bottom-right
            // "Developed by " stays plain grey text, "Techorses" is blue + clickable (opens in new tab)
            await html2pdf()
                .set(opt)
                .from(element)
                .toPdf()
                .get('pdf')
                .then((pdf) => {
                    const totalPages = pdf.internal.getNumberOfPages();
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();

                    const websiteUrl = "https://www.techorses.com"; // 👈 replace with your real website URL

                    const label = "Developed by ";
                    const linkText = "Techorses";

                    for (let i = 1; i <= totalPages; i++) {
                        pdf.setPage(i);
                        pdf.setFontSize(8);

                        // measure widths so the whole line stays right-aligned at the same spot
                        const labelWidth = pdf.getTextWidth(label);
                        const linkWidth = pdf.getTextWidth(linkText);
                        const totalWidth = labelWidth + linkWidth;

                        const rightEdge = pageWidth - 15;
                        const startX = rightEdge - totalWidth;
                        const y = pageHeight - 10;

                        // "Developed by " in grey
                        pdf.setTextColor(150);
                        pdf.text(label, startX, y);

                        // "Techorses" in blue, clickable, opens in a new tab
                        pdf.setTextColor(0, 0, 255);
                        pdf.textWithLink(linkText, startX + labelWidth, y, { url: websiteUrl });
                    }
                })
                .save();

            toast.success("PDF generated successfully!");

            if (openWhatsApp && sale.customerPhone) {
                const phone = sale.customerPhone.replace(/\D/g, "");
                if (phone) {
                    const message = `Hello ${sale.customerName || ""}, your invoice (No: ${sale.invoiceNumber}) has been generated.`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                }
            }

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
            setSaleForPrint(null);
        }
    };

    // ============= VALIDATE UNIQUE NUMBERS =============
    const validateUniqueNumbers = () => {
        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i];
            const uniqueNumbers = item.uniqueNumbers || [];

            // Check if all unique numbers are filled
            for (let j = 0; j < uniqueNumbers.length; j++) {
                if (!uniqueNumbers[j].number || uniqueNumbers[j].number.trim() === '') {
                    toast.error(`Please add unique number for Unit ${j + 1} of "${item.productName}"`);
                    return false;
                }
            }
        }
        return true;
    };

    // ============= HANDLE SUBMIT =============
    const handleSubmit = async () => {
        if (!selectedCustomer) {
            toast.warning("Please select a customer");
            return;
        }

        if (lineItems.length === 0) {
            toast.warning("Please add at least one product");
            return;
        }

        // ✅ Validate unique numbers - FIX #3
        if (!validateUniqueNumbers()) {
            return;
        }

        // ✅ Validate duplicate unique numbers
        const allNumbers = [];
        for (const item of lineItems) {
            if (item.uniqueNumbers && item.uniqueNumbers.length > 0) {
                for (const un of item.uniqueNumbers) {
                    if (un.number && un.number.trim()) {
                        if (allNumbers.includes(un.number.trim())) {
                            toast.error(`Duplicate unique number found: ${un.number}`);
                            return;
                        }
                        allNumbers.push(un.number.trim());
                    }
                }
            }
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                return;
            }

            // ✅ FIX: Use gstNumber instead of gstin
            const payload = {
                customerId: selectedCustomer.customerId,
                customerGstin: selectedCustomer.gstNumber || '',  // ← FIXED: gstNumber
                customerState: selectedCustomer.state || '',
                storeType: storeType,
                paymentType: paymentType,
                isGstMode: isGstMode,
                saleDate: saleDate,
                items: lineItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    uniqueNumbers: item.uniqueNumbers || []
                })),
                taxSlab: isGstMode ? taxSlab : 0,
                notes: notes
            };

            console.log("📦 Sending payload:", payload); // For debugging

            let response;
            if (isEditMode && editSaleId) {
                response = await axios.put(
                    `${import.meta.env.VITE_API_URL}/sales/update-sale/${editSaleId}`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Sale updated successfully!");
            } else {
                response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/sales/create-sale`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Sale created successfully!");
            }

            const newSale = response.data.data || response.data;
            await generatePDF(newSale, true);

            resetForm();
            await fetchSales();
        } catch (error) {
            console.error("Error saving sale:", error);
            toast.error(error.response?.data?.message || "Failed to save sale");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setLineItems([]);
        setSelectedCustomer(null);
        setSelectedProduct(null);
        setNotes("");
        setStoreType("Vadodara");
        setTaxSlab(18);
        setPaymentType("Cash");
        setIsGstMode(true);
        setSaleDate(new Date().toISOString().split("T")[0]);
        setIsEditMode(false);
        setEditSaleId(null);
        setShowForm(false);
    };

    // ============= EDIT SALE =============
    const handleEditSale = (sale) => {
        setIsEditMode(true);
        setEditSaleId(sale.saleId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === sale.customerId);
        setSelectedCustomer(customer || null);

        setStoreType(sale.storeType || "Vadodara");
        setTaxSlab(sale.taxSlab || 18);
        setPaymentType(sale.paymentType || "Cash");
        setIsGstMode(sale.isGstMode !== undefined ? sale.isGstMode : true);
        setNotes(sale.notes || "");
        setSaleDate(sale.saleDate ? new Date(sale.saleDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

        // ✅ Load items with unique numbers
        const items = sale.items.map(item => ({
            ...item,
            uniqueNumbers: item.uniqueNumbers || []
        }));
        setLineItems(items);
    };

    // ============= DELETE SALE =============
    const handleDeleteSale = async (saleId) => {
        if (!window.confirm("Are you sure you want to delete this sale?")) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/sales/delete-sale/${saleId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("Sale deleted successfully!");
            await fetchSales();
        } catch (error) {
            console.error("Error deleting sale:", error);
            toast.error(error.response?.data?.message || "Failed to delete sale");
        }
    };

    // ============= EXPORT TO EXCEL =============
    const exportToExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/sales/export-sales`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: { search: debouncedSearch || '' }
                }
            );

            if (response.data.success) {
                const data = response.data.data || [];
                if (data.length === 0) {
                    toast.warning("No data to export");
                    return;
                }

                const exportData = data.map((sale) => ({
                    "Invoice No": sale.invoiceNumber,
                    "Internal No": sale.internalInvoiceNumber,
                    "Customer": sale.customerName,
                    "Store": sale.storeType,
                    "Payment": sale.paymentType,
                    "GST Mode": sale.isGstMode ? "GST" : "Non-GST",
                    "Date": sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "N/A",
                    "Items": sale.items?.length || 0,
                    "Subtotal": sale.subtotal || 0,
                    "Discount": sale.totalDiscount || 0,
                    "Tax": sale.totalTax || 0,
                    "Grand Total": sale.grandTotal || 0,
                    "Unique Numbers": sale.items?.map(item =>
                        item.uniqueNumbers?.filter(un => un.number).map(un => un.number).join(', ') || ''
                    ).filter(Boolean).join('; ') || ''
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
                XLSX.writeFile(workbook, `sales_${new Date().toISOString().split("T")[0]}.xlsx`);
                toast.success(`Exported ${data.length} records successfully!`);
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

    // ============= RENDER UNIQUE NUMBERS =============
    const renderUniqueNumbers = () => {
        if (lineItems.length === 0) return null;

        return (
            <div className="sales-unique-section">
                <h3 className="sales-section-title">
                    <FaHashtag style={{ color: '#7366ff' }} /> Unique Numbers for Products
                </h3>
                <div className="sales-unique-grid">
                    {lineItems.map((item, productIndex) => {
                        const hasNumbers = item.uniqueNumbers && item.uniqueNumbers.length > 0;
                        const displayNumbers = item.uniqueNumbers || [];

                        return (
                            <div key={productIndex} className="sales-unique-product">
                                <div className="sales-unique-product-header">
                                    <span className="sales-unique-product-name">
                                        {item.productName} (Qty: {item.quantity})
                                    </span>
                                </div>
                                <div className="sales-unique-numbers-row">
                                    {displayNumbers.map((un, numberIndex) => (
                                        <div key={numberIndex} className="sales-unique-number-item">
                                            <input
                                                type="text"
                                                className="sales-unique-input"
                                                placeholder={`Unit ${numberIndex + 1}`}
                                                value={un.number || ''}
                                                onChange={(e) => handleUniqueNumberChange(productIndex, numberIndex, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="sales-unique-remove-btn"
                                                onClick={() => handleRemoveUniqueNumber(productIndex, numberIndex)}
                                                title="Remove this number"
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ============= RENDER CUSTOMER MODAL =============
    const renderCustomerModal = () => (
        <div className="sales-modal-overlay" onClick={() => setShowCustomerModal(false)}>
            <div className="sales-modal-content sales-modal-small" onClick={(e) => e.stopPropagation()}>
                <div className="sales-modal-header">
                    <h3 className="sales-modal-title">
                        <FaPlus style={{ color: '#28a745' }} /> New Customer
                    </h3>
                    <button className="sales-modal-close" onClick={() => setShowCustomerModal(false)}>
                        <FaTimes />
                    </button>
                </div>

                <div className="sales-modal-body">
                    <Formik
                        initialValues={customerInitialValues}
                        validationSchema={customerValidationSchema}
                        onSubmit={handleCreateCustomer}
                    >
                        <Form className="sales-form">
                            <div className="sales-form-row">
                                <div className="sales-form-field sales-form-field-full">
                                    <label className="sales-form-label">
                                        <FaUser /> Customer Name *
                                    </label>
                                    <Field name="customerName" type="text" placeholder="Enter customer name" />
                                    <ErrorMessage name="customerName" component="div" className="sales-error" />
                                </div>
                            </div>

                            <div className="sales-form-row">
                                <div className="sales-form-field">
                                    <label className="sales-form-label">
                                        <FaEnvelope /> Email
                                    </label>
                                    <Field name="email" type="email" placeholder="Enter email" />
                                    <ErrorMessage name="email" component="div" className="sales-error" />
                                </div>
                                <div className="sales-form-field">
                                    <label className="sales-form-label">
                                        <FaPhone /> Contact Number *
                                    </label>
                                    <Field name="contactNumber" type="text" placeholder="10 digits" />
                                    <ErrorMessage name="contactNumber" component="div" className="sales-error" />
                                </div>
                            </div>

                            <div className="sales-form-row">
                                <div className="sales-form-field">
                                    <label className="sales-form-label">
                                        <FaInfoCircle /> GSTIN
                                    </label>
                                    <Field name="gstin" type="text" placeholder="15 characters" />
                                    <ErrorMessage name="gstin" component="div" className="sales-error" />
                                </div>
                                <div className="sales-form-field">
                                    <label className="sales-form-label">
                                        <FaBuilding /> State
                                    </label>
                                    <Field name="state" type="text" placeholder="e.g., Gujarat" />
                                    <ErrorMessage name="state" component="div" className="sales-error" />
                                </div>
                            </div>

                            <div className="sales-form-row">
                                <div className="sales-form-field sales-form-field-full">
                                    <label className="sales-form-label">
                                        <FaMapMarkerAlt /> Address
                                    </label>
                                    <Field name="address" as="textarea" rows="2" placeholder="Enter address" />
                                    <ErrorMessage name="address" component="div" className="sales-error" />
                                </div>
                            </div>

                            <button type="submit" className="sales-submit-btn">
                                Create Customer
                            </button>
                        </Form>
                    </Formik>
                </div>
            </div>
        </div>
    );

    // ============= RENDER VIEW MODAL =============
    const renderViewModal = () => {
        if (!selectedSale) return null;

        // FIX #2: Get tax breakdown based on tax type
        const getTaxDisplay = () => {
            if (!selectedSale.isGstMode) {
                return null;
            }

            const taxBreakdown = selectedSale.taxBreakdown || {};
            const taxType = selectedSale.taxType || 'IGST';

            if (taxType === 'IGST') {
                return (
                    <div className="sales-view-total">
                        <span>IGST:</span>
                        <span>₹{(taxBreakdown.igst || selectedSale.totalTax || 0).toFixed(2)}</span>
                    </div>
                );
            } else if (taxType === 'CGST_SGST') {
                return (
                    <>
                        <div className="sales-view-total">
                            <span>CGST:</span>
                            <span>₹{(taxBreakdown.cgst || 0).toFixed(2)}</span>
                        </div>
                        <div className="sales-view-total">
                            <span>SGST:</span>
                            <span>₹{(taxBreakdown.sgst || 0).toFixed(2)}</span>
                        </div>
                    </>
                );
            } else {
                // Default fallback
                return (
                    <div className="sales-view-total">
                        <span>Tax ({selectedSale.taxSlab || 0}%):</span>
                        <span>₹{(selectedSale.totalTax || 0).toFixed(2)}</span>
                    </div>
                );
            }
        };

        return (
            <div className="sales-modal-overlay" onClick={() => setShowViewModal(false)}>
                <div className="sales-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="sales-modal-header">
                        <h3 className="sales-modal-title">
                            <FaFileInvoice /> Sale Details - {selectedSale.invoiceNumber}
                        </h3>
                        <button className="sales-modal-close" onClick={() => setShowViewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="sales-modal-body">
                        <div className="sales-view-grid">
                            <div className="sales-view-item">
                                <span className="sales-view-label">Invoice:</span>
                                <span className="sales-view-value">{selectedSale.invoiceNumber}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Internal No:</span>
                                <span className="sales-view-value">{selectedSale.internalInvoiceNumber}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Customer:</span>
                                <span className="sales-view-value">{selectedSale.customerName}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Store:</span>
                                <span className="sales-view-value">{selectedSale.storeType}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Payment:</span>
                                <span className="sales-view-value">{selectedSale.paymentType}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">GST Mode:</span>
                                <span className="sales-view-value">{selectedSale.isGstMode ? "GST" : "Non-GST"}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Date:</span>
                                <span className="sales-view-value">{formatDate(selectedSale.saleDate)}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Tax Type:</span>
                                <span className="sales-view-value">{selectedSale.taxType}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Tax Slab:</span>
                                <span className="sales-view-value">{selectedSale.taxSlab}%</span>
                            </div>
                            {/* FIX #1: Added Notes field */}
                            <div className="sales-view-item sales-view-item-full">
                                <span className="sales-view-label">Notes:</span>
                                <span className="sales-view-value">{selectedSale.notes || 'No notes'}</span>
                            </div>
                        </div>

                        <div className="sales-view-table-wrap">
                            <table className="sales-view-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Disc%</th>
                                        <th>Final</th>
                                        <th>Unique Numbers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSale.items?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>{item.productName}</td>
                                            <td>{item.quantity}</td>
                                            <td>₹{item.unitPrice.toFixed(2)}</td>
                                            <td>{item.discountPercent}%</td>
                                            <td>₹{item.finalPrice.toFixed(2)}</td>
                                            <td>
                                                {item.uniqueNumbers?.filter(un => un.number).map((un, i) => (
                                                    <span key={i} className="sales-unique-tag">
                                                        {un.number}
                                                    </span>
                                                )) || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="sales-view-summary">
                            <div className="sales-view-total">
                                <span>Subtotal:</span>
                                <span>₹{selectedSale.subtotal?.toFixed(2) || 0}</span>
                            </div>
                            <div className="sales-view-total">
                                <span>Discount:</span>
                                <span>₹{selectedSale.totalDiscount?.toFixed(2) || 0}</span>
                            </div>
                            {/* FIX #2: Show tax breakdown based on type */}
                            {selectedSale.isGstMode && getTaxDisplay()}
                            <div className="sales-view-total sales-view-grand">
                                <span>Grand Total:</span>
                                <span>₹{selectedSale.grandTotal?.toFixed(2) || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sales-modal-footer">
                        <button
                            className="sales-pdf-btn"
                            onClick={() => generatePDF(selectedSale, false)}
                            disabled={isGeneratingPDF}
                        >
                            <FaFilePdf /> {isGeneratingPDF ? "Generating..." : "PDF"}
                        </button>
                        <button className="sales-modal-close-btn" onClick={() => setShowViewModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER FORM =============
    const renderForm = () => {
        return (
            <div className="sales-form-container">
                <div className="sales-form-header">
                    <h2 className="sales-form-title">
                        <FaFileInvoice style={{ color: '#7366ff' }} />
                        {isEditMode ? "Edit Sale" : "Create New Sale"}
                    </h2>
                    <button className="sales-form-close" onClick={resetForm}>
                        <FaTimes />
                    </button>
                </div>

                {/* GST/Non-GST Toggle */}
                <div className="sales-toggle-section">
                    <div className="sales-toggle-container">
                        <span className="sales-toggle-label">GST Mode</span>
                        <button
                            className={`sales-toggle-btn ${isGstMode ? 'active' : ''}`}
                            onClick={() => {
                                setIsGstMode(!isGstMode);
                                if (!isGstMode) {
                                    setTaxSlab(18);
                                }
                            }}
                            type="button"
                        >
                            {isGstMode ? <FaToggleOn /> : <FaToggleOff />}
                            <span>{isGstMode ? "GST" : "Non-GST"}</span>
                        </button>
                    </div>
                </div>

                {/* Customer Selection + Date */}
                <div className="sales-section">
                    <div className="sales-form-row">
                        <div className="sales-form-field" style={{ flex: 7 }}>
                            <label className="sales-form-label">
                                <FaUser /> Select Customer *
                            </label>
                            <div className="sales-customer-row-inline">
                                <div className="sales-customer-select" style={{ flex: 1 }}>
                                    <Select
                                        options={customers.map(c => ({
                                            value: c.customerId,
                                            label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstin ? ` - GST: ${c.gstin}` : ''}`
                                        }))}
                                        styles={selectStyles}
                                        className="sales-react-select"
                                        classNamePrefix="sales-select"
                                        placeholder="Search Customer..."
                                        isSearchable
                                        value={selectedCustomer ? {
                                            value: selectedCustomer.customerId,
                                            label: `${selectedCustomer.customerName} ${selectedCustomer.contactNumber ? `(${selectedCustomer.contactNumber})` : ''}${selectedCustomer.gstin ? ` - GST: ${selectedCustomer.gstin}` : ''}`
                                        } : null}
                                        onChange={(option) => {
                                            const customer = customers.find(c => c.customerId === option?.value);
                                            setSelectedCustomer(customer || null);
                                        }}
                                    />
                                </div>
                                <button
                                    className="sales-new-customer-btn"
                                    onClick={() => setShowCustomerModal(true)}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                        </div>

                        <div className="sales-form-field" style={{ flex: 3 }}>
                            <label className="sales-form-label">
                                <FaCalendarAlt /> Sale Date *
                            </label>
                            <input
                                type="date"
                                className="sales-input-field"
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedCustomer && (
                        <div className="sales-customer-info">
                            <span><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</span>
                            <span><strong>Phone:</strong> {selectedCustomer.contactNumber || 'N/A'}</span>
                            {selectedCustomer.gstin && <span><strong>GSTIN:</strong> {selectedCustomer.gstin}</span>}
                            {selectedCustomer.state && <span><strong>State:</strong> {selectedCustomer.state}</span>}
                            {selectedCustomer.address && <span><strong>Address:</strong> {selectedCustomer.address}</span>}
                        </div>
                    )}
                </div>

                {/* Product Selection */}
                <div className="sales-section">
                    <div className="sales-product-row">
                        <div className="sales-product-select">
                            <label className="sales-form-label">
                                <FaBox /> Select Product
                            </label>
                            <Select
                                options={products.map(p => ({
                                    value: p.productId,
                                    label: `${p.productName} (${p.unitName || 'NOS'})`
                                }))}
                                styles={selectStyles}
                                className="sales-react-select"
                                classNamePrefix="sales-select"
                                placeholder="Search Product..."
                                isSearchable
                                value={selectedProduct ? {
                                    value: selectedProduct.productId,
                                    label: `${selectedProduct.productName} (${selectedProduct.unitName || 'NOS'})`
                                } : null}
                                onChange={(option) => {
                                    const product = products.find(p => p.productId === option?.value);
                                    setSelectedProduct(product || null);
                                }}
                            />
                        </div>
                        <button
                            className="sales-add-product-btn"
                            onClick={handleAddProduct}
                        >
                            <FaPlus /> Add
                        </button>
                    </div>
                </div>

                {/* Line Items Table */}
                {lineItems.length > 0 && (
                    <div className="sales-section">
                        <div className="sales-items-table-wrap">
                            <table className="sales-items-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>HSN</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Disc%</th>
                                        <th>Final</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td className="sales-item-name">{item.productName}</td>
                                            <td>{item.hsnCode || '-'}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="sales-item-input"
                                                    value={item.quantity}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="sales-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="sales-item-input sales-item-discount"
                                                    value={item.discountPercent}
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'discountPercent', e.target.value)}
                                                />
                                            </td>
                                            <td className="sales-item-final">
                                                ₹{item.finalPrice.toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="sales-item-remove"
                                                    onClick={() => handleRemoveLineItem(idx)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ✅ Unique Numbers Section */}
                {lineItems.length > 0 && renderUniqueNumbers()}

                {/* Store, Tax, Payment */}
                <div className="sales-section">
                    <div className="sales-form-row">
                        <div className="sales-form-field">
                            <label className="sales-form-label">
                                <FaStore /> Store *
                            </label>
                            <Select
                                options={STORE_OPTIONS}
                                styles={selectStyles}
                                className="sales-react-select"
                                classNamePrefix="sales-select"
                                placeholder="Select Store"
                                value={STORE_OPTIONS.find(opt => opt.value === storeType)}
                                onChange={(option) => setStoreType(option?.value || "Vadodara")}
                            />
                        </div>

                        {isGstMode && (
                            <div className="sales-form-field">
                                <label className="sales-form-label">
                                    <FaPercent /> Tax Slab *
                                </label>
                                <Select
                                    options={TAX_OPTIONS}
                                    styles={selectStyles}
                                    className="sales-react-select"
                                    classNamePrefix="sales-select"
                                    placeholder="Select Tax"
                                    value={TAX_OPTIONS.find(opt => opt.value === taxSlab)}
                                    onChange={(option) => setTaxSlab(option?.value || 18)}
                                />
                            </div>
                        )}

                        <div className="sales-form-field">
                            <label className="sales-form-label">
                                <FaRupeeSign /> Payment Type *
                            </label>
                            <Select
                                options={PAYMENT_OPTIONS}
                                styles={selectStyles}
                                className="sales-react-select"
                                classNamePrefix="sales-select"
                                placeholder="Select Payment"
                                value={PAYMENT_OPTIONS.find(opt => opt.value === paymentType)}
                                onChange={(option) => setPaymentType(option?.value || "Cash")}
                            />
                        </div>
                    </div>

                    <div className="sales-form-row">
                        <div className="sales-form-field sales-form-field-full">
                            <label className="sales-form-label">
                                <FaInfoCircle /> Notes (Optional)
                            </label>
                            <textarea
                                className="sales-textarea-field"
                                rows="2"
                                placeholder="Add notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary - Column View */}
                {lineItems.length > 0 && (
                    <div className="sales-summary-column">
                        <div className="sales-summary-title">Summary</div>
                        <div className="sales-summary-items">
                            <div className="sales-summary-row">
                                <span>Subtotal</span>
                                <span>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="sales-summary-row sales-summary-discount">
                                <span>Discount</span>
                                <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="sales-summary-row">
                                <span>Taxable Amount</span>
                                <span>₹{totals.taxableAmount.toFixed(2)}</span>
                            </div>
                            {isGstMode && (
                                <div className="sales-summary-row">
                                    <span>Tax ({taxSlab}%)</span>
                                    <span>₹{totals.totalTax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="sales-summary-row sales-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            className="sales-submit-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !selectedCustomer || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update Invoice" : "Create Invoice"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="sales-table-container">
            <div className="sales-table-header">
                <div className="sales-search-container">
                    <FaSearch className="sales-search-icon" />
                    <input
                        type="text"
                        className="sales-search-input"
                        placeholder="Search by Invoice, Customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="sales-action-buttons">
                    <button
                        className="sales-create-btn"
                        onClick={() => {
                            if (showForm) {
                                resetForm();
                            } else {
                                setIsEditMode(false);
                                setEditSaleId(null);
                                setLineItems([]);
                                setSelectedCustomer(null);
                                setSelectedProduct(null);
                                setNotes("");
                                setStoreType("Vadodara");
                                setTaxSlab(18);
                                setPaymentType("Cash");
                                setIsGstMode(true);
                                setSaleDate(new Date().toISOString().split("T")[0]);
                                setShowForm(true);
                            }
                        }}
                    >
                        {showForm ? <FaMinus /> : <FaPlus />}
                        {showForm ? "Close" : "Create"}
                    </button>
                    <button
                        className="sales-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="sales-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export"}
                    </button>
                </div>
            </div>

            {showForm && renderForm()}

            {isLoading ? (
                <div className="sales-loading-container">
                    <div className="sales-loading-spinner"></div>
                    <p>Loading sales...</p>
                </div>
            ) : sales.length === 0 ? (
                <div className="sales-empty-state">
                    <FaFileInvoice size={50} color="#ccc" />
                    <p>No sales found</p>
                </div>
            ) : (
                <>
                    <div className="sales-table-responsive">
                        <table className="sales-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Invoice</th>
                                    <th>Internal No</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Payment</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((sale, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={sale.saleId} className="sales-table-row">
                                            <td>{serialNo}</td>
                                            <td className="sales-invoice-number">
                                                <strong>{sale.invoiceNumber}</strong>
                                            </td>
                                            <td className="sales-internal-number">
                                                {sale.internalInvoiceNumber}
                                            </td>
                                            <td>{sale.customerName}</td>
                                            <td>{sale.storeType}</td>
                                            <td>{sale.paymentType}</td>
                                            <td>{sale.items?.length || 0}</td>
                                            <td>
                                                <span className="sales-total-badge">
                                                    ₹{sale.grandTotal?.toFixed(2) || 0}
                                                </span>
                                            </td>
                                            <td>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "N/A"}</td>
                                            <td>
                                                <div className="sales-action-btns">
                                                    <button
                                                        className="sales-view-btn"
                                                        onClick={() => {
                                                            setSelectedSale(sale);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        className="sales-edit-btn"
                                                        onClick={() => handleEditSale(sale)}
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className="sales-delete-btn"
                                                        onClick={() => handleDeleteSale(sale.saleId)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                    <button
                                                        className="sales-pdf-row-btn"
                                                        onClick={() => generatePDF(sale, false)}
                                                        disabled={isGeneratingPDF}
                                                        title="Download PDF"
                                                    >
                                                        <FaFilePdf />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="sales-pagination">
                            <div className="sales-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="sales-pagination-buttons">
                                <button
                                    className="sales-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="sales-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="sales-page-btn"
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
            <div className="sales-module-wrapper">
                <div className="sales-page-header">
                    <h2 className="sales-page-title">Sales Management</h2>
                </div>

                <div className="sales-content-wrapper">
                    {renderTable()}
                </div>

                {showCustomerModal && renderCustomerModal()}
                {showViewModal && renderViewModal()}

                {/* Hidden SalesPrint component for PDF generation */}
                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {saleForPrint && <SalesPrint invoice={saleForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default Sales;