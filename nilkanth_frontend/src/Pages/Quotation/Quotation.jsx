import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FaUser,
    FaBox,
    FaPlus,
    FaSearch,
    FaEdit,
    FaTrash,
    FaFileExcel,
    FaEye,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaRupeeSign,
    FaInfoCircle,
    FaFileInvoice,
    FaStore,
    FaCalendarAlt,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaMinus,
    FaFilePdf,
    FaFileArchive,
    FaExclamationTriangle
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import QuotationPrint from "./QuotationPrint";
import "./Quotation.scss";
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
const STORE_OPTIONS = [
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

const Quotation = () => {
    // ============= STATE =============
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // ============= DELETE MODAL STATE =============
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [quotationToDelete, setQuotationToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ============= PDF BULK EXPORT STATE =============
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, status: '' });

    // ============= FORM STATE =============
    const [showForm, setShowForm] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [storeType, setStoreType] = useState("Vadodara");
    const [notes, setNotes] = useState("");
    const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editQuotationId, setEditQuotationId] = useState(null);

    // ============= CUSTOMER FORM FIELDS =============
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerGstin, setCustomerGstin] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [isCustomerFieldsReadOnly, setIsCustomerFieldsReadOnly] = useState(false);

    // ============= MODAL STATES =============
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState(null);

    // ============= PDF/PRINT STATE =============
    const [quotationForPrint, setQuotationForPrint] = useState(null);

    // ============= PAGINATION STATE =============
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
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
            fetchQuotations();
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

            await fetchQuotations();
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

    const fetchQuotations = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/quotation/get-quotations`,
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
                setQuotations(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setQuotations([]);
            }
        } catch (error) {
            console.error("Error fetching quotations:", error);
            setQuotations([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= CUSTOMER HANDLERS =============
    const handleCustomerSelect = (option) => {
        const customer = customers.find(c => c.customerId === option?.value);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
        } else {
            setCustomerName('');
            setCustomerEmail('');
            setCustomerPhone('');
            setCustomerGstin('');
            setCustomerAddress('');
            setIsCustomerFieldsReadOnly(false);
        }
    };

    // ============= PRODUCT HANDLERS =============
    const handleProductSelect = (option) => {
        const product = products.find(p => p.productId === option?.value);
        if (!product) return;

        const exists = lineItems.some(item => item.productId === product.productId);
        if (exists) {
            toast.warning("Product already added");
            setSelectedProduct(null);
            return;
        }

        const newItem = {
            productId: product.productId,
            productName: product.productName,
            productDescription: product.productDescription || '',
            invoiceDescription: '',
            hsnCode: product.hsnCode || '',
            unitName: '',
            capacity: '',
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            discountAmount: 0,
            discountedUnitPrice: 0,
            finalPrice: 0
        };

        setLineItems(prev => [...prev, newItem]);
        setSelectedProduct(null);
        toast.success(`${product.productName} added to cart`);
    };

    const handleUpdateLineItem = (index, field, value) => {
        const updated = [...lineItems];
        updated[index][field] = Number(value) || 0;

        const discountFactor = (100 - updated[index].discountPercent) / 100;
        updated[index].discountedUnitPrice = updated[index].unitPrice * discountFactor;
        updated[index].discountAmount = updated[index].unitPrice - updated[index].discountedUnitPrice;
        updated[index].finalPrice = updated[index].discountedUnitPrice * updated[index].quantity;

        setLineItems(updated);
    };

    const handleUpdateLineItemText = (index, field, value) => {
        const updated = [...lineItems];
        updated[index][field] = value;
        setLineItems(updated);
    };

    const handleRemoveLineItem = (index) => {
        if (lineItems.length <= 1) {
            toast.warning("Cannot remove the last product");
            return;
        }
        setLineItems(prev => prev.filter((_, i) => i !== index));
    };

    // ============= CALCULATIONS (NO TAX) =============
    const calculateTotals = () => {
        let subtotal = 0;
        let totalDiscount = 0;

        lineItems.forEach(item => {
            subtotal += item.unitPrice * item.quantity;
            totalDiscount += item.discountAmount * item.quantity;
        });

        const grandTotal = subtotal - totalDiscount;

        return {
            subtotal,
            totalDiscount,
            grandTotal
        };
    };

    const totals = calculateTotals();

    // ============= SINGLE PDF GENERATION =============
    const generatePDF = async (quotation, openWhatsApp = true) => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);

        try {
            setQuotationForPrint(quotation);
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = document.getElementById("quotation-pdf");
            if (!element) {
                throw new Error("PDF element not found");
            }

            const opt = {
                filename: `${quotation.quotationNumber}_${(quotation.customerName || "customer").replace(/\s+/g, "_")}.pdf`,
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

            await html2pdf()
                .set(opt)
                .from(element)
                .save();

            toast.success("PDF generated successfully!");

            if (openWhatsApp && quotation.customerPhone) {
                const phone = quotation.customerPhone.replace(/\D/g, "");
                if (phone) {
                    const message = `Hello ${quotation.customerName || ""}, your quotation (No: ${quotation.quotationNumber}) has been generated.`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                }
            }

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
            setQuotationForPrint(null);
        }
    };

    // ============= BULK PDF EXPORT (ZIP) =============
    const exportPDFsAsZip = async () => {
        if (isExportingPDF) return;

        setIsExportingPDF(true);
        setPdfProgress({ current: 0, total: 0, status: 'Fetching quotations...' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                setIsExportingPDF(false);
                return;
            }

            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/quotation/get-all-filtered`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || ''
                    }
                }
            );

            if (!response.data.success || !response.data.data || response.data.data.length === 0) {
                toast.warning("No quotations found to export");
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
                return;
            }

            const allQuotations = response.data.data;
            const total = allQuotations.length;

            setPdfProgress({ current: 0, total, status: `Preparing ${total} quotations...` });

            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < allQuotations.length; i++) {
                const quotation = allQuotations[i];

                setPdfProgress({
                    current: i + 1,
                    total,
                    status: `Generating PDF ${i + 1} of ${total}...`
                });

                try {
                    setQuotationForPrint(quotation);
                    await new Promise(resolve => setTimeout(resolve, 700));

                    const element = document.getElementById("quotation-pdf");
                    if (!element) {
                        console.error(`PDF element not found for ${quotation.quotationNumber}`);
                        failCount++;
                        continue;
                    }

                    const opt = {
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

                    const pdfBlob = await html2pdf()
                        .set(opt)
                        .from(element)
                        .outputPdf('blob');

                    const fileName = `${quotation.quotationNumber}_${(quotation.customerName || "customer").replace(/\s+/g, "_")}.pdf`;
                    zip.file(fileName, pdfBlob);

                    successCount++;

                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (err) {
                    console.error(`Error generating PDF for ${quotation.quotationNumber}:`, err);
                    failCount++;
                }
            }

            setQuotationForPrint(null);

            setPdfProgress({
                current: total,
                total,
                status: 'Creating ZIP file...'
            });

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 3 }
            });

            const zipFileName = `quotations_${new Date().toISOString().split("T")[0]}.zip`;

            saveAs(zipBlob, zipFileName);

            setPdfProgress({
                current: total,
                total,
                status: `✅ Done! ${successCount} PDFs exported${failCount > 0 ? `, ${failCount} failed` : ''}`
            });

            toast.success(`ZIP created! ${successCount} PDFs exported${failCount > 0 ? `, ${failCount} failed` : ''}`);

            setTimeout(() => {
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
            }, 2000);

        } catch (error) {
            console.error("ZIP export error:", error);
            toast.error(error.response?.data?.message || "Failed to export PDFs");
            setIsExportingPDF(false);
            setPdfProgress({ current: 0, total: 0, status: '' });
        }
    };

    // ============= VALIDATE CUSTOMER FIELDS =============
    const validateCustomerFields = () => {
        if (selectedCustomer) {
            return true;
        }

        if (!customerName.trim()) {
            toast.error("Customer Name is required");
            return false;
        }

        if (!customerPhone.trim() || customerPhone.trim().length !== 10) {
            toast.error("Valid 10-digit Phone Number is required");
            return false;
        }

        if (customerEmail && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(customerEmail)) {
            toast.error("Invalid email format");
            return false;
        }

        return true;
    };

    // ============= HANDLE SUBMIT =============
    const handleSubmit = async () => {
        if (!validateCustomerFields()) {
            return;
        }

        if (lineItems.length === 0) {
            toast.warning("Please add at least one product");
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                return;
            }

            let finalCustomerId = selectedCustomer?.customerId;

            if (!selectedCustomer) {
                const customerData = {
                    customerName: customerName,
                    email: customerEmail,
                    contactNumber: customerPhone,
                    gstNumber: customerGstin,
                    address: customerAddress
                };

                const customerResponse = await axios.post(
                    `${import.meta.env.VITE_API_URL}/customer/create-customer`,
                    customerData,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (customerResponse.data.success) {
                    const newCustomer = customerResponse.data.data;
                    finalCustomerId = newCustomer.customerId;
                    setCustomers(prev => [...prev, newCustomer]);
                    toast.success("Customer created successfully!");
                } else {
                    throw new Error("Failed to create customer");
                }
            }

            const payload = {
                customerId: finalCustomerId,
                customerGstin: selectedCustomer ? selectedCustomer.gstNumber || '' : customerGstin,
                storeType: storeType,
                quotationDate: quotationDate,
                items: lineItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    hsnCode: item.hsnCode || '',
                    unitName: item.unitName || '',
                    capacity: item.capacity || '',
                    invoiceDescription: item.invoiceDescription || ''
                })),
                notes: notes
            };

            let response;
            if (isEditMode && editQuotationId) {
                response = await axios.put(
                    `${import.meta.env.VITE_API_URL}/quotation/update-quotation/${editQuotationId}`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Quotation updated successfully!");
            } else {
                response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/quotation/create-quotation`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Quotation created successfully!");
            }

            const newQuotation = response.data.data || response.data;
            await generatePDF(newQuotation, true);

            resetForm();
            await fetchQuotations();
        } catch (error) {
            console.error("Error saving quotation:", error);
            toast.error(error.response?.data?.message || "Failed to save quotation");
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
        setQuotationDate(new Date().toISOString().split("T")[0]);
        setIsEditMode(false);
        setEditQuotationId(null);
        setShowForm(false);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerGstin("");
        setCustomerAddress("");
        setIsCustomerFieldsReadOnly(false);
    };

    // ============= EDIT QUOTATION =============
    const handleEditQuotation = (quotation) => {
        setIsEditMode(true);
        setEditQuotationId(quotation.quotationId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === quotation.customerId);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
        }

        setStoreType(quotation.storeType || "Vadodara");
        setNotes(quotation.notes || "");
        setQuotationDate(quotation.quotationDate ? new Date(quotation.quotationDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

        const items = quotation.items.map(item => ({
            ...item,
            capacity: item.capacity || '',
            invoiceDescription: item.invoiceDescription || ''
        }));
        setLineItems(items);
    };

    // ============= OPEN DELETE MODAL =============
    const openDeleteModal = (quotation) => {
        setQuotationToDelete(quotation);
        setShowDeleteModal(true);
    };

    // ============= CONFIRM DELETE =============
    const confirmDeleteQuotation = async () => {
        if (!quotationToDelete) return;

        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/quotation/delete-quotation/${quotationToDelete.quotationId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("Quotation deleted successfully!");
            setShowDeleteModal(false);
            setQuotationToDelete(null);
            await fetchQuotations();
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast.error(error.response?.data?.message || "Failed to delete quotation");
        } finally {
            setIsDeleting(false);
        }
    };

    // ============= EXPORT TO EXCEL =============
    const exportToExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/quotation/export-quotations`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || ''
                    }
                }
            );

            if (response.data.success) {
                const data = response.data.data || [];
                if (data.length === 0) {
                    toast.warning("No data to export");
                    return;
                }

                const exportData = data.map((quotation) => ({
                    "Quotation No": quotation.quotationNumber,
                    "Customer": quotation.customerName,
                    "Store": quotation.storeType,
                    "Date": quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleDateString() : "N/A",
                    "Items": quotation.items?.length || 0,
                    "Subtotal": quotation.subtotal || 0,
                    "Discount": quotation.totalDiscount || 0,
                    "Grand Total": quotation.grandTotal || 0
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Quotations");
                XLSX.writeFile(workbook, `quotations_${new Date().toISOString().split("T")[0]}.xlsx`);
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

    // ============= RENDER VIEW MODAL =============
    const renderViewModal = () => {
        if (!selectedQuotation) return null;

        return (
            <div className="quotation-modal-overlay" onClick={() => setShowViewModal(false)}>
                <div className="quotation-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="quotation-modal-header">
                        <h3 className="quotation-modal-title">
                            <FaFileInvoice /> Quotation Details - {selectedQuotation.quotationNumber}
                        </h3>
                        <button className="quotation-modal-close" onClick={() => setShowViewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="quotation-modal-body">
                        <div className="quotation-view-grid">
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">Quotation No:</span>
                                <span className="quotation-view-value">{selectedQuotation.quotationNumber}</span>
                            </div>
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">Customer:</span>
                                <span className="quotation-view-value">{selectedQuotation.customerName}</span>
                            </div>
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">Store:</span>
                                <span className="quotation-view-value">{selectedQuotation.storeType}</span>
                            </div>
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">Date:</span>
                                <span className="quotation-view-value">{formatDate(selectedQuotation.quotationDate)}</span>
                            </div>
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">Phone:</span>
                                <span className="quotation-view-value">{selectedQuotation.customerPhone || 'N/A'}</span>
                            </div>
                            <div className="quotation-view-item">
                                <span className="quotation-view-label">GSTIN:</span>
                                <span className="quotation-view-value">{selectedQuotation.customerGstin || 'N/A'}</span>
                            </div>
                            <div className="quotation-view-item quotation-view-item-full">
                                <span className="quotation-view-label">Notes:</span>
                                <span className="quotation-view-value">{selectedQuotation.notes || 'No notes'}</span>
                            </div>
                        </div>

                        <div className="quotation-view-table-wrap">
                            <table className="quotation-view-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Invoice Desc</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Capacity</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th>HSN Code</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedQuotation.items?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>{item.productName}</td>
                                            <td>{item.invoiceDescription || '-'}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.unitName || 'NOS'}</td>
                                            <td>{item.capacity || '-'}</td>
                                            <td>₹{item.unitPrice.toFixed(2)}</td>
                                            <td>₹{item.finalPrice.toFixed(2)}</td>
                                            <td>{item.hsnCode || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="quotation-view-summary">
                            <div className="quotation-view-total">
                                <span>Subtotal:</span>
                                <span>₹{selectedQuotation.subtotal?.toFixed(2) || 0}</span>
                            </div>
                            <div className="quotation-view-total">
                                <span>Discount:</span>
                                <span>₹{selectedQuotation.totalDiscount?.toFixed(2) || 0}</span>
                            </div>
                            <div className="quotation-view-total quotation-view-grand">
                                <span>Grand Total:</span>
                                <span>₹{selectedQuotation.grandTotal?.toFixed(2) || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="quotation-modal-footer">
                        <button
                            className="quotation-pdf-btn"
                            onClick={() => generatePDF(selectedQuotation, false)}
                            disabled={isGeneratingPDF}
                        >
                            <FaFilePdf /> {isGeneratingPDF ? "Generating..." : "PDF"}
                        </button>
                        <button className="quotation-modal-close-btn" onClick={() => setShowViewModal(false)}>
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
            <div className="quotation-form-container">
                <div className="quotation-form-header">
                    <h2 className="quotation-form-title">
                        <FaFileInvoice style={{ color: '#7366ff' }} />
                        {isEditMode ? "Edit Quotation" : "Create New Quotation"}
                    </h2>
                    <button className="quotation-form-close" onClick={resetForm}>
                        <FaTimes />
                    </button>
                </div>

                {/* Customer Selection + Date */}
                <div className="quotation-section">
                    <div className="quotation-form-row">
                        <div className="quotation-form-field" style={{ flex: 7 }}>
                            <label className="quotation-form-label">
                                <FaUser /> Select Customer
                            </label>
                            <div className="quotation-customer-row-inline">
                                <div className="quotation-customer-select" style={{ flex: 1 }}>
                                    <Select
                                        options={customers.map(c => ({
                                            value: c.customerId,
                                            label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                                        }))}
                                        styles={selectStyles}
                                        className="quotation-react-select"
                                        classNamePrefix="quotation-select"
                                        placeholder="Search Customer..."
                                        isSearchable
                                        isClearable
                                        value={selectedCustomer ? {
                                            value: selectedCustomer.customerId,
                                            label: `${selectedCustomer.customerName} ${selectedCustomer.contactNumber ? `(${selectedCustomer.contactNumber})` : ''}${selectedCustomer.gstNumber ? ` - GST: ${selectedCustomer.gstNumber}` : ''}`
                                        } : null}
                                        onChange={handleCustomerSelect}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="quotation-form-field" style={{ flex: 3 }}>
                            <label className="quotation-form-label">
                                <FaCalendarAlt /> Quotation Date *
                            </label>
                            <input
                                type="date"
                                className="quotation-input-field"
                                value={quotationDate}
                                onChange={(e) => setQuotationDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Customer Details Fields */}
                    <div className="quotation-customer-details">
                        <div className="quotation-form-row">
                            <div className="quotation-form-field">
                                <label className="quotation-form-label">
                                    <FaUser /> Customer Name {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="quotation-input-field"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter customer name"}
                                />
                            </div>
                            <div className="quotation-form-field">
                                <label className="quotation-form-label">
                                    <FaEnvelope /> Email
                                </label>
                                <input
                                    type="email"
                                    className="quotation-input-field"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter email"}
                                />
                            </div>
                        </div>

                        <div className="quotation-form-row">
                            <div className="quotation-form-field">
                                <label className="quotation-form-label">
                                    <FaPhone /> Phone Number {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="quotation-input-field"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "10 digits"}
                                    maxLength="10"
                                />
                            </div>
                            <div className="quotation-form-field">
                                <label className="quotation-form-label">
                                    <FaInfoCircle /> GSTIN
                                </label>
                                <input
                                    type="text"
                                    className="quotation-input-field"
                                    value={customerGstin}
                                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "15 characters"}
                                    maxLength="15"
                                />
                            </div>
                        </div>

                        <div className="quotation-form-row">
                            <div className="quotation-form-field quotation-form-field-full">
                                <label className="quotation-form-label">
                                    <FaMapMarkerAlt /> Address
                                </label>
                                <input
                                    type="text"
                                    className="quotation-input-field"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter address"}
                                />
                            </div>
                        </div>

                        {selectedCustomer && (
                            <div className="quotation-customer-selected-badge">
                                <span>✅ Customer selected: {selectedCustomer.customerName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Selection */}
                <div className="quotation-section">
                    <div className="quotation-product-row">
                        <div className="quotation-product-select" style={{ flex: 1 }}>
                            <label className="quotation-form-label">
                                <FaBox /> Select Product
                            </label>
                            <Select
                                options={products.map(p => ({
                                    value: p.productId,
                                    label: `${p.productName}`
                                }))}
                                styles={selectStyles}
                                className="quotation-react-select"
                                classNamePrefix="quotation-select"
                                placeholder="Search and select product..."
                                isSearchable
                                value={selectedProduct ? {
                                    value: selectedProduct.productId,
                                    label: `${selectedProduct.productName}`
                                } : null}
                                onChange={handleProductSelect}
                            />
                        </div>
                    </div>
                </div>

                {/* Line Items Table */}
                {lineItems.length > 0 && (
                    <div className="quotation-section">
                        <div className="quotation-items-table-wrap">
                            <table className="quotation-items-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Invoice Desc</th>
                                        <th>Unit</th>
                                        <th>Capacity</th>
                                        <th>HSN</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td className="quotation-item-name">{item.productName}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="quotation-item-input quotation-invoice-desc-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Desc"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="quotation-item-input quotation-unit-input"
                                                    value={item.unitName || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'unitName', e.target.value)}
                                                    placeholder="Unit"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="quotation-item-input quotation-capacity-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="quotation-item-input quotation-hsn-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="quotation-item-input"
                                                    value={item.quantity}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="quotation-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                                />
                                            </td>
                                            <td className="quotation-item-final">
                                                ₹{item.finalPrice.toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="quotation-item-remove"
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

                {/* Store + Notes */}
                <div className="quotation-section">
                    <div className="quotation-form-row">
                        <div className="quotation-form-field">
                            <label className="quotation-form-label">
                                <FaStore /> Store *
                            </label>
                            <Select
                                options={STORE_OPTIONS}
                                styles={selectStyles}
                                className="quotation-react-select"
                                classNamePrefix="quotation-select"
                                placeholder="Select Store"
                                value={STORE_OPTIONS.find(opt => opt.value === storeType)}
                                onChange={(option) => setStoreType(option?.value || "Vadodara")}
                            />
                        </div>
                    </div>

                    <div className="quotation-form-row">
                        <div className="quotation-form-field quotation-form-field-full">
                            <label className="quotation-form-label">
                                <FaInfoCircle /> Notes (Optional)
                            </label>
                            <textarea
                                className="quotation-textarea-field"
                                rows="2"
                                placeholder="Add notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary */}
                {lineItems.length > 0 && (
                    <div className="quotation-summary-column">
                        <div className="quotation-summary-title">Summary</div>
                        <div className="quotation-summary-items">
                            <div className="quotation-summary-row">
                                <span>Subtotal</span>
                                <span>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="quotation-summary-row quotation-summary-discount">
                                <span>Discount</span>
                                <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="quotation-summary-row quotation-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            className="quotation-submit-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitting || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update Quotation" : "Create Quotation"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER DELETE MODAL =============
    const renderDeleteModal = () => {
        if (!showDeleteModal || !quotationToDelete) return null;

        return (
            <div className="quotation-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                <div className="quotation-delete-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="quotation-delete-modal-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h3 className="quotation-delete-modal-title">Confirm Delete</h3>

                    <p className="quotation-delete-modal-text">
                        Are you sure you want to delete this quotation? This action cannot be undone.
                    </p>

                    <div className="quotation-delete-modal-info">
                        <div className="quotation-delete-modal-row">
                            <span className="quotation-delete-modal-label">Quotation No:</span>
                            <span className="quotation-delete-modal-value">{quotationToDelete.quotationNumber}</span>
                        </div>
                        <div className="quotation-delete-modal-row">
                            <span className="quotation-delete-modal-label">Customer:</span>
                            <span className="quotation-delete-modal-value">{quotationToDelete.customerName}</span>
                        </div>
                        <div className="quotation-delete-modal-row">
                            <span className="quotation-delete-modal-label">Amount:</span>
                            <span className="quotation-delete-modal-value">₹{quotationToDelete.grandTotal?.toFixed(2) || 0}</span>
                        </div>
                    </div>

                    <div className="quotation-delete-modal-buttons">
                        <button
                            className="quotation-delete-modal-cancel"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="quotation-delete-modal-confirm"
                            onClick={confirmDeleteQuotation}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER PDF PROGRESS LOADER =============
    const renderPDFProgress = () => {
        if (!isExportingPDF) return null;

        const percentage = pdfProgress.total > 0
            ? Math.round((pdfProgress.current / pdfProgress.total) * 100)
            : 0;

        return (
            <div className="quotation-pdf-progress-overlay">
                <div className="quotation-pdf-progress-modal">
                    <div className="quotation-pdf-progress-icon">
                        <FaFileArchive />
                    </div>

                    <h3 className="quotation-pdf-progress-title">Exporting Quotations</h3>

                    <p className="quotation-pdf-progress-status">{pdfProgress.status}</p>

                    {pdfProgress.total > 0 && (
                        <>
                            <div className="quotation-pdf-progress-bar-container">
                                <div
                                    className="quotation-pdf-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="quotation-pdf-progress-percentage">{percentage}%</div>
                        </>
                    )}

                    <div className="quotation-pdf-progress-spinner"></div>

                    <p className="quotation-pdf-progress-hint">
                        Please don't close this window while PDFs are being generated
                    </p>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="quotation-table-container">
            <div className="quotation-table-header">
                <div className="quotation-search-container">
                    <FaSearch className="quotation-search-icon" />
                    <input
                        type="text"
                        className="quotation-search-input"
                        placeholder="Search by Quotation No, Customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="quotation-action-buttons">
                    <button
                        className="quotation-create-btn"
                        onClick={() => {
                            if (showForm) {
                                resetForm();
                            } else {
                                resetForm();
                                setShowForm(true);
                            }
                        }}
                    >
                        {showForm ? <FaMinus /> : <FaPlus />}
                        {showForm ? "Close" : "Create"}
                    </button>
                    <button
                        className="quotation-pdf-export-btn"
                        onClick={exportPDFsAsZip}
                        disabled={isExportingPDF || isLoading || quotations.length === 0}
                        title="Export all quotations as PDF (ZIP)"
                    >
                        {isExportingPDF ? (
                            <span className="quotation-loading-spinner-small"></span>
                        ) : (
                            <FaFilePdf />
                        )}
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
                    </button>
                    <button
                        className="quotation-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="quotation-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export Excel"}
                    </button>
                </div>
            </div>

            {showForm && renderForm()}

            {isLoading ? (
                <div className="quotation-loading-container">
                    <div className="quotation-loading-spinner"></div>
                    <p>Loading quotations...</p>
                </div>
            ) : quotations.length === 0 ? (
                <div className="quotation-empty-state">
                    <FaFileInvoice size={50} color="#ccc" />
                    <p>No quotations found</p>
                </div>
            ) : (
                <>
                    <div className="quotation-table-responsive">
                        <table className="quotation-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Quotation No</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotations.map((quotation, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={quotation.quotationId} className="quotation-table-row">
                                            <td>{serialNo}</td>
                                            <td className="quotation-number">
                                                <strong>{quotation.quotationNumber}</strong>
                                            </td>
                                            <td>{quotation.customerName}</td>
                                            <td>{quotation.storeType}</td>
                                            <td>{quotation.items?.length || 0}</td>
                                            <td>
                                                <span className="quotation-total-badge">
                                                    ₹{quotation.grandTotal?.toFixed(2) || 0}
                                                </span>
                                            </td>
                                            <td>{quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleDateString() : "N/A"}</td>
                                            <td>
                                                <div className="quotation-action-btns">
                                                    <button
                                                        className="quotation-view-btn"
                                                        onClick={() => {
                                                            setSelectedQuotation(quotation);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        className="quotation-edit-btn"
                                                        onClick={() => handleEditQuotation(quotation)}
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className="quotation-delete-btn"
                                                        onClick={() => openDeleteModal(quotation)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                    <button
                                                        className="quotation-pdf-row-btn"
                                                        onClick={() => generatePDF(quotation, false)}
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
                        <div className="quotation-pagination">
                            <div className="quotation-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="quotation-pagination-buttons">
                                <button
                                    className="quotation-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="quotation-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="quotation-page-btn"
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
            <div className="quotation-module-wrapper">
                <div className="quotation-content-wrapper">
                    {renderTable()}
                </div>

                {showViewModal && renderViewModal()}
                {renderDeleteModal()}
                {renderPDFProgress()}

                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {quotationForPrint && <QuotationPrint quotation={quotationForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default Quotation;