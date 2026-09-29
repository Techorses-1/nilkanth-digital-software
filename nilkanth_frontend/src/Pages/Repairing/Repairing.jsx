import React, { useState, useEffect, useRef } from "react";
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
    FaToggleOn,
    FaToggleOff,
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaFilter,
    FaFileArchive,
    FaExclamationTriangle,
    FaWrench
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import RepairingPrint from "./RepairingPrint";
import "./Repairing.scss";
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

// Payment Status Options
const PAYMENT_STATUS_OPTIONS = [
    { value: "Paid", label: "Paid" },
    { value: "Pending", label: "Pending" }
];

// Filter Options (No Challan)
const FILTER_OPTIONS = [
    { value: "All", label: "All Repairings" },
    { value: "GST", label: "GST Only" },
    { value: "Non-GST", label: "Non-GST Only" }
];

const Repairing = () => {
    // ============= STATE =============
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [repairings, setRepairings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterType, setFilterType] = useState("GST");

    // ============= DELETE MODAL =============
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [repairingToDelete, setRepairingToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ============= PDF BULK EXPORT =============
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, status: '' });

    // ============= FORM STATE =============
    const [showForm, setShowForm] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [storeType, setStoreType] = useState("Vadodara");
    const [taxSlab, setTaxSlab] = useState(18);
    const [repairNotes, setRepairNotes] = useState("");
    const [repairingDate, setRepairingDate] = useState(new Date().toISOString().split("T")[0]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editRepairingId, setEditRepairingId] = useState(null);

    // ============= NEW FIELDS =============
    const [paymentType, setPaymentType] = useState("Cash");
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [isGstMode, setIsGstMode] = useState(true);

    // ============= CUSTOMER FORM FIELDS =============
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerGstin, setCustomerGstin] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [isCustomerFieldsReadOnly, setIsCustomerFieldsReadOnly] = useState(false);

    // ============= MODAL STATES =============
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedRepairing, setSelectedRepairing] = useState(null);

    // ============= PDF/PRINT STATE =============
    const [repairingForPrint, setRepairingForPrint] = useState(null);

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
            fetchRepairings();
        }
    }, [debouncedSearch, pagination.page, filterType]);

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

            await fetchRepairings();
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

    const fetchRepairings = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/repairing/get-repairings`,
                {
                    ...headers,
                    params: {
                        page: pagination.page,
                        limit: pagination.limit,
                        search: debouncedSearch,
                        filterType: filterType
                    }
                }
            );

            if (response.data.success) {
                setRepairings(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setRepairings([]);
            }
        } catch (error) {
            console.error("Error fetching repairings:", error);
            setRepairings([]);
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

    // ============= SINGLE PDF GENERATION =============
    const generatePDF = async (repairing, openWhatsApp = true) => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);

        try {
            setRepairingForPrint(repairing);
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = document.getElementById("repairing-pdf");
            if (!element) {
                throw new Error("PDF element not found");
            }

            const opt = {
                filename: `${repairing.repairingNumber}_${(repairing.customerName || "customer").replace(/\s+/g, "_")}.pdf`,
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
                    mode: ['css', 'legacy'],
                    avoid: ['.avoid-break', '.stamping-footer', '.declaration-terms-section', '.totals-row']
                }
            };

            await html2pdf()
                .set(opt)
                .from(element)
                .save();

            toast.success("PDF generated successfully!");

            if (openWhatsApp && repairing.customerPhone) {
                const phone = repairing.customerPhone.replace(/\D/g, "");
                if (phone) {
                    const message = `Hello ${repairing.customerName || ""}, your repairing invoice (No: ${repairing.repairingNumber}) has been generated.`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                }
            }

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
            setRepairingForPrint(null);
        }
    };

    // ============= BULK PDF EXPORT (ZIP) =============
    const exportPDFsAsZip = async () => {
        if (isExportingPDF) return;

        setIsExportingPDF(true);
        setPdfProgress({ current: 0, total: 0, status: 'Fetching repairings...' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                setIsExportingPDF(false);
                return;
            }

            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/repairing/get-all-filtered`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || '',
                        filterType: filterType
                    }
                }
            );

            if (!response.data.success || !response.data.data || response.data.data.length === 0) {
                toast.warning("No repairings found to export");
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
                return;
            }

            const allRepairings = response.data.data;
            const total = allRepairings.length;

            setPdfProgress({ current: 0, total, status: `Preparing ${total} repairings...` });

            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < allRepairings.length; i++) {
                const repairing = allRepairings[i];

                setPdfProgress({
                    current: i + 1,
                    total,
                    status: `Generating PDF ${i + 1} of ${total}...`
                });

                try {
                    setRepairingForPrint(repairing);
                    await new Promise(resolve => setTimeout(resolve, 700));

                    const element = document.getElementById("repairing-pdf");
                    if (!element) {
                        console.error(`PDF element not found for ${repairing.repairingNumber}`);
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
                            mode: ['css', 'legacy'],
                            avoid: ['.avoid-break', '.stamping-footer', '.declaration-terms-section', '.totals-row']
                        }
                    };

                    const pdfBlob = await html2pdf()
                        .set(opt)
                        .from(element)
                        .outputPdf('blob');

                    const fileName = `${repairing.repairingNumber}_${(repairing.customerName || "customer").replace(/\s+/g, "_")}.pdf`;
                    zip.file(fileName, pdfBlob);

                    successCount++;

                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (err) {
                    console.error(`Error generating PDF for ${repairing.repairingNumber}:`, err);
                    failCount++;
                }
            }

            setRepairingForPrint(null);

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

            const zipFileName = `repairings_${new Date().toISOString().split("T")[0]}.zip`;

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
            if (isGstMode && !selectedCustomer.gstNumber) {
                toast.error("GSTIN is required in GST Mode. Please add GSTIN to customer or switch to Non-GST mode.");
                return false;
            }
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

        if (isGstMode) {
            if (!customerGstin.trim()) {
                toast.error("GSTIN is required in GST Mode");
                return false;
            }
            if (customerGstin.trim().length !== 15) {
                toast.error("GSTIN must be 15 characters");
                return false;
            }
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
                paymentType: paymentStatus === 'Pending' ? null : paymentType,
                paymentStatus: paymentStatus,
                isGstMode: isGstMode,
                repairingDate: repairingDate,
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
                taxSlab: isGstMode ? taxSlab : 0,
                repairNotes: repairNotes
            };

            let response;
            if (isEditMode && editRepairingId) {
                response = await axios.put(
                    `${import.meta.env.VITE_API_URL}/repairing/update-repairing/${editRepairingId}`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Repairing updated successfully!");
            } else {
                response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/repairing/create-repairing`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Repairing created successfully!");
            }

            const newRepairing = response.data.data || response.data;
            await generatePDF(newRepairing, true);

            resetForm();
            await fetchRepairings();
        } catch (error) {
            console.error("Error saving repairing:", error);
            toast.error(error.response?.data?.message || "Failed to save repairing");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setLineItems([]);
        setSelectedCustomer(null);
        setSelectedProduct(null);
        setRepairNotes("");
        setStoreType("Vadodara");
        setTaxSlab(18);
        setPaymentType("Cash");
        setPaymentStatus("Paid");
        setIsGstMode(true);
        setRepairingDate(new Date().toISOString().split("T")[0]);
        setIsEditMode(false);
        setEditRepairingId(null);
        setShowForm(false);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerGstin("");
        setCustomerAddress("");
        setIsCustomerFieldsReadOnly(false);
    };

    // ============= EDIT REPAIRING =============
    const handleEditRepairing = (repairing) => {
        setIsEditMode(true);
        setEditRepairingId(repairing.repairingId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === repairing.customerId);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
        }

        setStoreType(repairing.storeType || "Vadodara");
        setTaxSlab(repairing.taxSlab || 18);
        setPaymentType(repairing.paymentType || "Cash");
        setPaymentStatus(repairing.paymentStatus || "Paid");
        setIsGstMode(repairing.isGstMode !== undefined ? repairing.isGstMode : true);
        setRepairNotes(repairing.repairNotes || "");
        setRepairingDate(repairing.repairingDate ? new Date(repairing.repairingDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

        const items = repairing.items.map(item => ({
            ...item,
            capacity: item.capacity || '',
            invoiceDescription: item.invoiceDescription || ''
        }));
        setLineItems(items);
    };

    // ============= OPEN DELETE MODAL =============
    const openDeleteModal = (repairing) => {
        setRepairingToDelete(repairing);
        setShowDeleteModal(true);
    };

    const confirmDeleteRepairing = async () => {
        if (!repairingToDelete) return;

        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/repairing/delete-repairing/${repairingToDelete.repairingId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("Repairing deleted successfully!");
            setShowDeleteModal(false);
            setRepairingToDelete(null);
            await fetchRepairings();
        } catch (error) {
            console.error("Error deleting repairing:", error);
            toast.error(error.response?.data?.message || "Failed to delete repairing");
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
                `${import.meta.env.VITE_API_URL}/repairing/export-repairings`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || '',
                        filterType: filterType
                    }
                }
            );

            if (response.data.success) {
                const data = response.data.data || [];
                if (data.length === 0) {
                    toast.warning("No data to export");
                    return;
                }

                const exportData = data.map((repairing) => ({
                    "Repairing No": repairing.repairingNumber,
                    "Customer": repairing.customerName,
                    "Store": repairing.storeType,
                    "Payment Status": repairing.paymentStatus || 'Paid',
                    "Payment Type": repairing.paymentType || '-',
                    "GST Mode": repairing.isGstMode ? "GST" : "Non-GST",
                    "Date": repairing.repairingDate ? new Date(repairing.repairingDate).toLocaleDateString() : "N/A",
                    "Items": repairing.items?.length || 0,
                    "Subtotal": repairing.subtotal || 0,
                    "Discount": repairing.totalDiscount || 0,
                    "Tax": repairing.totalTax || 0,
                    "Grand Total": repairing.grandTotal || 0
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Repairings");
                XLSX.writeFile(workbook, `repairings_${new Date().toISOString().split("T")[0]}.xlsx`);
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
        if (!selectedRepairing) return null;

        const getTaxDisplay = () => {
            if (!selectedRepairing.isGstMode) {
                return null;
            }

            const taxBreakdown = selectedRepairing.taxBreakdown || {};
            const taxType = selectedRepairing.taxType || 'IGST';

            if (taxType === 'IGST') {
                return (
                    <div className="repairing-view-total">
                        <span>IGST:</span>
                        <span>₹{(taxBreakdown.igst || selectedRepairing.totalTax || 0).toFixed(2)}</span>
                    </div>
                );
            } else if (taxType === 'CGST_SGST') {
                return (
                    <>
                        <div className="repairing-view-total">
                            <span>CGST:</span>
                            <span>₹{(taxBreakdown.cgst || 0).toFixed(2)}</span>
                        </div>
                        <div className="repairing-view-total">
                            <span>SGST:</span>
                            <span>₹{(taxBreakdown.sgst || 0).toFixed(2)}</span>
                        </div>
                    </>
                );
            } else {
                return (
                    <div className="repairing-view-total">
                        <span>Tax ({selectedRepairing.taxSlab || 0}%):</span>
                        <span>₹{(selectedRepairing.totalTax || 0).toFixed(2)}</span>
                    </div>
                );
            }
        };

        return (
            <div className="repairing-modal-overlay" onClick={() => setShowViewModal(false)}>
                <div className="repairing-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="repairing-modal-header">
                        <h3 className="repairing-modal-title">
                            <FaWrench /> Repairing Details - {selectedRepairing.repairingNumber}
                        </h3>
                        <button className="repairing-modal-close" onClick={() => setShowViewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="repairing-modal-body">
                        <div className="repairing-view-grid">
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Repairing No:</span>
                                <span className="repairing-view-value">{selectedRepairing.repairingNumber}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Customer:</span>
                                <span className="repairing-view-value">{selectedRepairing.customerName}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Store:</span>
                                <span className="repairing-view-value">{selectedRepairing.storeType}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Payment Status:</span>
                                <span className="repairing-view-value">{selectedRepairing.paymentStatus || 'Paid'}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Payment Type:</span>
                                <span className="repairing-view-value">{selectedRepairing.paymentType || '-'}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">GST Mode:</span>
                                <span className="repairing-view-value">{selectedRepairing.isGstMode ? "GST" : "Non-GST"}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Date:</span>
                                <span className="repairing-view-value">{formatDate(selectedRepairing.repairingDate)}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Tax Type:</span>
                                <span className="repairing-view-value">{selectedRepairing.taxType}</span>
                            </div>
                            <div className="repairing-view-item">
                                <span className="repairing-view-label">Tax Slab:</span>
                                <span className="repairing-view-value">{selectedRepairing.taxSlab}%</span>
                            </div>
                            <div className="repairing-view-item repairing-view-item-full">
                                <span className="repairing-view-label">Repair Notes:</span>
                                <span className="repairing-view-value">{selectedRepairing.repairNotes || 'No notes'}</span>
                            </div>
                        </div>

                        <div className="repairing-view-table-wrap">
                            <table className="repairing-view-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Product Desc</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Capacity</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th>HSN Code</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRepairing.items?.map((item, idx) => (
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

                        <div className="repairing-view-summary">
                            <div className="repairing-view-total">
                                <span>Subtotal:</span>
                                <span>₹{selectedRepairing.subtotal?.toFixed(2) || 0}</span>
                            </div>
                            <div className="repairing-view-total">
                                <span>Discount:</span>
                                <span>₹{selectedRepairing.totalDiscount?.toFixed(2) || 0}</span>
                            </div>
                            {selectedRepairing.isGstMode && getTaxDisplay()}
                            <div className="repairing-view-total repairing-view-grand">
                                <span>Grand Total:</span>
                                <span>₹{selectedRepairing.grandTotal?.toFixed(2) || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="repairing-modal-footer">
                        <button
                            className="repairing-pdf-btn"
                            onClick={() => generatePDF(selectedRepairing, false)}
                            disabled={isGeneratingPDF}
                        >
                            <FaFilePdf /> {isGeneratingPDF ? "Generating..." : "PDF"}
                        </button>
                        <button className="repairing-modal-close-btn" onClick={() => setShowViewModal(false)}>
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
            <div className="repairing-form-container">
                <div className="repairing-form-header">
                    <h2 className="repairing-form-title">
                        <FaWrench style={{ color: '#7366ff' }} />
                        {isEditMode ? "Edit Repairing" : "Create New Repairing"}
                    </h2>
                    <button className="repairing-form-close" onClick={resetForm}>
                        <FaTimes />
                    </button>
                </div>

                {/* GST Toggle */}
                <div className="repairing-toggle-section">
                    <div className="repairing-toggle-row">
                        <div className="repairing-toggle-container">
                            <span className="repairing-toggle-label">GST Mode</span>
                            <button
                                className={`repairing-toggle-btn ${isGstMode ? 'active' : ''}`}
                                onClick={() => {
                                    setIsGstMode(!isGstMode);
                                    if (!isGstMode) {
                                        setTaxSlab(0);
                                    } else {
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
                </div>

                {/* Customer Selection + Date */}
                <div className="repairing-section">
                    <div className="repairing-form-row">
                        <div className="repairing-form-field" style={{ flex: 7 }}>
                            <label className="repairing-form-label">
                                <FaUser /> Select Customer
                            </label>
                            <div className="repairing-customer-row-inline">
                                <div className="repairing-customer-select" style={{ flex: 1 }}>
                                    <Select
                                        options={customers.map(c => ({
                                            value: c.customerId,
                                            label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                                        }))}
                                        styles={selectStyles}
                                        className="repairing-react-select"
                                        classNamePrefix="repairing-select"
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

                        <div className="repairing-form-field" style={{ flex: 3 }}>
                            <label className="repairing-form-label">
                                <FaCalendarAlt /> Repairing Date *
                            </label>
                            <input
                                type="date"
                                className="repairing-input-field"
                                value={repairingDate}
                                onChange={(e) => setRepairingDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="repairing-customer-details">
                        <div className="repairing-form-row">
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaUser /> Customer Name {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="repairing-input-field"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter customer name"}
                                />
                            </div>
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaEnvelope /> Email
                                </label>
                                <input
                                    type="email"
                                    className="repairing-input-field"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter email"}
                                />
                            </div>
                        </div>

                        <div className="repairing-form-row">
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaPhone /> Phone Number {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="repairing-input-field"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "10 digits"}
                                    maxLength="10"
                                />
                            </div>
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaInfoCircle /> GSTIN {isGstMode && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="repairing-input-field"
                                    value={customerGstin}
                                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "15 characters"}
                                    maxLength="15"
                                />
                            </div>
                        </div>

                        <div className="repairing-form-row">
                            <div className="repairing-form-field repairing-form-field-full">
                                <label className="repairing-form-label">
                                    <FaMapMarkerAlt /> Address
                                </label>
                                <input
                                    type="text"
                                    className="repairing-input-field"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter address"}
                                />
                            </div>
                        </div>

                        {selectedCustomer && (
                            <div className="repairing-customer-selected-badge">
                                <span>✅ Customer selected: {selectedCustomer.customerName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Selection */}
                <div className="repairing-section">
                    <div className="repairing-product-row">
                        <div className="repairing-product-select" style={{ flex: 1 }}>
                            <label className="repairing-form-label">
                                <FaBox /> Select Product
                            </label>
                            <Select
                                options={products.map(p => ({
                                    value: p.productId,
                                    label: `${p.productName}`
                                }))}
                                styles={selectStyles}
                                className="repairing-react-select"
                                classNamePrefix="repairing-select"
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
                    <div className="repairing-section">
                        <div className="repairing-items-table-wrap">
                            <table className="repairing-items-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Product Desc</th>
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
                                            <td className="repairing-item-name">{item.productName}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="repairing-item-input repairing-invoice-desc-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Desc"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="repairing-item-input repairing-unit-input"
                                                    value={item.unitName || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'unitName', e.target.value)}
                                                    placeholder="Unit"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="repairing-item-input repairing-capacity-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="repairing-item-input repairing-hsn-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="repairing-item-input"
                                                    value={item.quantity}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="repairing-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                                />
                                            </td>
                                            <td className="repairing-item-final">
                                                ₹{item.finalPrice.toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="repairing-item-remove"
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

                {/* Store, Tax, Payment, Repair Notes */}
                <div className="repairing-section">
                    <div className="repairing-form-row">
                        <div className="repairing-form-field">
                            <label className="repairing-form-label">
                                <FaStore /> Store *
                            </label>
                            <Select
                                options={STORE_OPTIONS}
                                styles={selectStyles}
                                className="repairing-react-select"
                                classNamePrefix="repairing-select"
                                placeholder="Select Store"
                                value={STORE_OPTIONS.find(opt => opt.value === storeType)}
                                onChange={(option) => setStoreType(option?.value || "Vadodara")}
                            />
                        </div>

                        {isGstMode && (
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaFilter /> Tax Slab *
                                </label>
                                <Select
                                    options={TAX_OPTIONS}
                                    styles={selectStyles}
                                    className="repairing-react-select"
                                    classNamePrefix="repairing-select"
                                    placeholder="Select Tax"
                                    value={TAX_OPTIONS.find(opt => opt.value === taxSlab)}
                                    onChange={(option) => setTaxSlab(option?.value || 18)}
                                />
                            </div>
                        )}

                        <div className="repairing-form-field">
                            <label className="repairing-form-label">
                                <FaMoneyBillWave /> Payment Status *
                            </label>
                            <Select
                                options={PAYMENT_STATUS_OPTIONS}
                                styles={selectStyles}
                                className="repairing-react-select"
                                classNamePrefix="repairing-select"
                                placeholder="Select Status"
                                value={PAYMENT_STATUS_OPTIONS.find(opt => opt.value === paymentStatus)}
                                onChange={(option) => setPaymentStatus(option?.value || "Paid")}
                            />
                        </div>

                        {paymentStatus === 'Paid' && (
                            <div className="repairing-form-field">
                                <label className="repairing-form-label">
                                    <FaRupeeSign /> Payment Type *
                                </label>
                                <Select
                                    options={PAYMENT_OPTIONS}
                                    styles={selectStyles}
                                    className="repairing-react-select"
                                    classNamePrefix="repairing-select"
                                    placeholder="Select Payment"
                                    value={PAYMENT_OPTIONS.find(opt => opt.value === paymentType)}
                                    onChange={(option) => setPaymentType(option?.value || "Cash")}
                                />
                            </div>
                        )}
                    </div>

                    <div className="repairing-form-row">
                        <div className="repairing-form-field repairing-form-field-full">
                            <label className="repairing-form-label">
                                <FaWrench /> Repair Notes (Optional)
                            </label>
                            <textarea
                                className="repairing-textarea-field"
                                rows="2"
                                placeholder="Add repair notes..."
                                value={repairNotes}
                                onChange={(e) => setRepairNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary */}
                {lineItems.length > 0 && (
                    <div className="repairing-summary-column">
                        <div className="repairing-summary-title">Summary</div>
                        <div className="repairing-summary-items">
                            <div className="repairing-summary-row">
                                <span>Subtotal</span>
                                <span>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="repairing-summary-row repairing-summary-discount">
                                <span>Discount</span>
                                <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="repairing-summary-row">
                                <span>Taxable Amount</span>
                                <span>₹{totals.taxableAmount.toFixed(2)}</span>
                            </div>
                            {isGstMode && (
                                <div className="repairing-summary-row">
                                    <span>Tax ({taxSlab}%)</span>
                                    <span>₹{totals.totalTax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="repairing-summary-row repairing-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            className="repairing-submit-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitting || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update Repairing" : "Create Repairing"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER DELETE MODAL =============
    const renderDeleteModal = () => {
        if (!showDeleteModal || !repairingToDelete) return null;

        return (
            <div className="repairing-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                <div className="repairing-delete-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="repairing-delete-modal-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h3 className="repairing-delete-modal-title">Confirm Delete</h3>

                    <p className="repairing-delete-modal-text">
                        Are you sure you want to delete this repairing? This action cannot be undone.
                    </p>

                    <div className="repairing-delete-modal-info">
                        <div className="repairing-delete-modal-row">
                            <span className="repairing-delete-modal-label">Repairing No:</span>
                            <span className="repairing-delete-modal-value">{repairingToDelete.repairingNumber}</span>
                        </div>
                        <div className="repairing-delete-modal-row">
                            <span className="repairing-delete-modal-label">Customer:</span>
                            <span className="repairing-delete-modal-value">{repairingToDelete.customerName}</span>
                        </div>
                        <div className="repairing-delete-modal-row">
                            <span className="repairing-delete-modal-label">Amount:</span>
                            <span className="repairing-delete-modal-value">₹{repairingToDelete.grandTotal?.toFixed(2) || 0}</span>
                        </div>
                    </div>

                    <div className="repairing-delete-modal-buttons">
                        <button
                            className="repairing-delete-modal-cancel"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="repairing-delete-modal-confirm"
                            onClick={confirmDeleteRepairing}
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
            <div className="repairing-pdf-progress-overlay">
                <div className="repairing-pdf-progress-modal">
                    <div className="repairing-pdf-progress-icon">
                        <FaFileArchive />
                    </div>

                    <h3 className="repairing-pdf-progress-title">Exporting Repairings</h3>

                    <p className="repairing-pdf-progress-status">{pdfProgress.status}</p>

                    {pdfProgress.total > 0 && (
                        <>
                            <div className="repairing-pdf-progress-bar-container">
                                <div
                                    className="repairing-pdf-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="repairing-pdf-progress-percentage">{percentage}%</div>
                        </>
                    )}

                    <div className="repairing-pdf-progress-spinner"></div>

                    <p className="repairing-pdf-progress-hint">
                        Please don't close this window while PDFs are being generated
                    </p>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="repairing-table-container">
            <div className="repairing-table-header">
                <div className="repairing-search-filter-group">
                    <div className="repairing-search-container">
                        <FaSearch className="repairing-search-icon" />
                        <input
                            type="text"
                            className="repairing-search-input"
                            placeholder="Search by Repairing No, Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="repairing-filter-container">
                        <FaFilter className="repairing-filter-icon" />
                        <Select
                            options={FILTER_OPTIONS}
                            styles={selectStyles}
                            className="repairing-filter-select"
                            classNamePrefix="repairing-filter"
                            placeholder="Filter"
                            isSearchable={false}
                            value={FILTER_OPTIONS.find(opt => opt.value === filterType)}
                            onChange={(option) => {
                                setFilterType(option?.value || "All");
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        />
                    </div>
                </div>

                <div className="repairing-action-buttons">
                    <button
                        className="repairing-create-btn"
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
                        className="repairing-pdf-export-btn"
                        onClick={exportPDFsAsZip}
                        disabled={isExportingPDF || isLoading || repairings.length === 0}
                        title="Export all filtered repairings as PDF (ZIP)"
                    >
                        {isExportingPDF ? (
                            <span className="repairing-loading-spinner-small"></span>
                        ) : (
                            <FaFilePdf />
                        )}
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
                    </button>
                    <button
                        className="repairing-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="repairing-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export Excel"}
                    </button>
                </div>
            </div>

            {showForm && renderForm()}

            {isLoading ? (
                <div className="repairing-loading-container">
                    <div className="repairing-loading-spinner"></div>
                    <p>Loading repairings...</p>
                </div>
            ) : repairings.length === 0 ? (
                <div className="repairing-empty-state">
                    <FaWrench size={50} color="#ccc" />
                    <p>No repairings found</p>
                </div>
            ) : (
                <>
                    <div className="repairing-table-responsive">
                        <table className="repairing-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Repairing No</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Payment Status</th>
                                    <th>Payment Type</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repairings.map((repairing, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={repairing.repairingId} className="repairing-table-row">
                                            <td>{serialNo}</td>
                                            <td className="repairing-number">
                                                <strong>{repairing.repairingNumber}</strong>
                                            </td>
                                            <td>{repairing.customerName}</td>
                                            <td>{repairing.storeType}</td>
                                            <td>
                                                <span className={`repairing-status-badge ${repairing.paymentStatus === 'Paid' ? 'repairing-status-paid' : 'repairing-status-pending'}`}>
                                                    {repairing.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />}
                                                    {' '}{repairing.paymentStatus || 'Paid'}
                                                </span>
                                            </td>
                                            <td>{repairing.paymentType || '-'}</td>
                                            <td>{repairing.items?.length || 0}</td>
                                            <td>
                                                <span className="repairing-total-badge">
                                                    ₹{repairing.grandTotal?.toFixed(2) || 0}
                                                </span>
                                            </td>
                                            <td>{repairing.repairingDate ? new Date(repairing.repairingDate).toLocaleDateString() : "N/A"}</td>
                                            <td>
                                                <div className="repairing-action-btns">
                                                    <button
                                                        className="repairing-view-btn"
                                                        onClick={() => {
                                                            setSelectedRepairing(repairing);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        className="repairing-edit-btn"
                                                        onClick={() => handleEditRepairing(repairing)}
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className="repairing-delete-btn"
                                                        onClick={() => openDeleteModal(repairing)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                    <button
                                                        className="repairing-pdf-row-btn"
                                                        onClick={() => generatePDF(repairing, false)}
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
                        <div className="repairing-pagination">
                            <div className="repairing-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="repairing-pagination-buttons">
                                <button
                                    className="repairing-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="repairing-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="repairing-page-btn"
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
            <div className="repairing-module-wrapper">
                {/* <div className="repairing-page-header">
                    <h2 className="repairing-page-title">Repairing Management</h2>
                </div> */}

                <div className="repairing-content-wrapper">
                    {renderTable()}
                </div>

                {showViewModal && renderViewModal()}
                {renderDeleteModal()}
                {renderPDFProgress()}

                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {repairingForPrint && <RepairingPrint repairing={repairingForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default Repairing;