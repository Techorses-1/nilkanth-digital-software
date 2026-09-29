import React, { useState, useEffect, useMemo } from "react";
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
    FaHashtag,
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaFilter,
    FaFileArchive,
    FaExclamationTriangle,
    FaToggleOn,
    FaToggleOff,
    FaLink,
    FaHistory,
    FaPlusCircle,
    FaStamp,
    FaClipboardCheck
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import StampingPrint from "./StampingPrint";
import "./Stamping.scss";
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
        minHeight: '40px',
        borderColor: '#ddd',
        borderRadius: '6px',
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

// ===== Options =====
const TAX_OPTIONS = [
    { value: 0, label: "0%" },
    { value: 5, label: "5%" },
    { value: 12, label: "12%" },
    { value: 18, label: "18%" },
    { value: 28, label: "28%" }
];

const STORE_OPTIONS = [
    { value: "Vadodara", label: "Vadodara" },
    { value: "Padra", label: "Padra" }
];

const PAYMENT_OPTIONS = [
    { value: "Cash", label: "Cash" },
    { value: "Bank", label: "Bank" },
    { value: "UPI", label: "UPI" },
    { value: "Cheque", label: "Cheque" }
];

const PAYMENT_STATUS_OPTIONS = [
    { value: "Paid", label: "Paid" },
    { value: "Pending", label: "Pending" }
];

const FILTER_OPTIONS = [
    { value: "All", label: "All Stampings" },
    { value: "GST", label: "GST Only" },
    { value: "Non-GST", label: "Non-GST Only" }
];

const Stamping = () => {
    // ============= GLOBAL STATE =============
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [stampings, setStampings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterType, setFilterType] = useState("GST");

    // ============= DELETE MODAL =============
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [stampingToDelete, setStampingToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ============= PDF BULK EXPORT =============
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, status: '' });

    // ============= FORM STATE =============
    const [showForm, setShowForm] = useState(false);
    const [linkMode, setLinkMode] = useState("direct"); // "direct" | "sale"
    const [selectedSale, setSelectedSale] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [storeType, setStoreType] = useState("Vadodara");
    const [taxSlab, setTaxSlab] = useState(18);
    const [notes, setNotes] = useState("");
    const [stampDate, setStampDate] = useState(new Date().toISOString().split("T")[0]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editStampingId, setEditStampingId] = useState(null);

    const [paymentType, setPaymentType] = useState("Cash");
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [isGstMode, setIsGstMode] = useState(true);

    // ===== Customer form fields =====
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerGstin, setCustomerGstin] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [isCustomerFieldsReadOnly, setIsCustomerFieldsReadOnly] = useState(false);

    // ===== Previous units panel (from StampingUnit) =====
    const [previousUnits, setPreviousUnits] = useState([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);

    // ============= VIEW MODAL =============
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedStamping, setSelectedStamping] = useState(null);

    // ============= UNIT HISTORY MODAL =============
    const [showUnitHistoryModal, setShowUnitHistoryModal] = useState(false);
    const [unitHistory, setUnitHistory] = useState(null);

    // ============= PDF / PRINT =============
    const [stampingForPrint, setStampingForPrint] = useState(null);

    // ============= PAGINATION =============
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
            fetchStampings();
        }
    }, [debouncedSearch, pagination.page, filterType]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();

            const [customersRes, productsRes, salesRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/products-master/get-products`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/sales/get-sales`, {
                    ...headers,
                    params: { page: 1, limit: 1000 }
                })
            ]);

            const customersData = customersRes.data?.data || customersRes.data || [];
            const productsData = productsRes.data?.data || productsRes.data || [];
            const salesData = salesRes.data?.data || salesRes.data || [];

            setCustomers(Array.isArray(customersData) ? customersData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);
            setSales(Array.isArray(salesData) ? salesData : []);

            await fetchStampings();
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStampings = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/get-stampings`,
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
                setStampings(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setStampings([]);
            }
        } catch (error) {
            console.error("Error fetching stampings:", error);
            setStampings([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= SALE SELECT (From Sale) =============
    const handleSaleSelect = async (option) => {
        const saleId = option?.value;
        if (!saleId) {
            setSelectedSale(null);
            return;
        }

        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/get-sale-products/${saleId}`,
                headers
            );

            if (response.data.success) {
                const data = response.data.data;
                setSelectedSale(data);

                const customer = customers.find(c => c.customerId === data.customerId);
                if (customer) {
                    setSelectedCustomer(customer);
                    setCustomerName(customer.customerName || '');
                    setCustomerEmail(customer.email || '');
                    setCustomerPhone(customer.contactNumber || '');
                    setCustomerGstin(customer.gstNumber || '');
                    setCustomerAddress(customer.address || '');
                    setIsCustomerFieldsReadOnly(true);

                    // Load previous units too
                    await loadCustomerUnits(customer.customerId);
                }

                // Pre-fill line items with sale's unique numbers
                const items = data.products.map(p => ({
                    productId: p.productId,
                    productName: p.productName,
                    productDescription: p.productDescription || '',
                    invoiceDescription: p.invoiceDescription || '',
                    hsnCode: p.hsnCode || '',
                    capacity: p.capacity || '',
                    quantity: p.quantity,
                    unitPrice: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    discountedUnitPrice: 0,
                    finalPrice: 0,
                    uniqueNumbers: (p.uniqueNumbers || []).length > 0
                        ? p.uniqueNumbers
                        : Array.from({ length: p.quantity }, () => ({ number: '', isUsed: true }))
                }));

                setLineItems(items);
                setStoreType(data.storeType || 'Vadodara');
                setIsGstMode(data.isGstMode !== undefined ? data.isGstMode : true);
                setTaxSlab(data.taxSlab || 18);

                toast.success("Sale details loaded");
            }
        } catch (error) {
            console.error("Error loading sale:", error);
            toast.error("Failed to load sale details");
        }
    };

    // ============= LOAD PREVIOUS UNITS =============
    const loadCustomerUnits = async (customerId) => {
        if (!customerId) {
            setPreviousUnits([]);
            return;
        }
        setIsLoadingUnits(true);
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/get-customer-units/${customerId}`,
                headers
            );
            if (response.data.success) {
                setPreviousUnits(response.data.data || []);
            } else {
                setPreviousUnits([]);
            }
        } catch (error) {
            console.error("Error loading customer units:", error);
            setPreviousUnits([]);
        } finally {
            setIsLoadingUnits(false);
        }
    };

    // ============= CUSTOMER SELECT =============
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
            loadCustomerUnits(customer.customerId);
        } else {
            setCustomerName('');
            setCustomerEmail('');
            setCustomerPhone('');
            setCustomerGstin('');
            setCustomerAddress('');
            setIsCustomerFieldsReadOnly(false);
            setPreviousUnits([]);
        }
    };

    // ============= ADD PRODUCT =============
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
            capacity: '',
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            discountAmount: 0,
            discountedUnitPrice: 0,
            finalPrice: 0,
            uniqueNumbers: [{ number: '', isUsed: true }]
        };

        setLineItems(prev => [...prev, newItem]);
        setSelectedProduct(null);
        toast.success(`${product.productName} added`);
    };

    // ============= ADD FROM PREVIOUS UNITS PANEL =============
    const handleAddFromPreviousUnit = (unit) => {
        // Check if product already in lineItems
        const existingIdx = lineItems.findIndex(i => i.productId === unit.productId);

        if (existingIdx >= 0) {
            // Add this unique number to the existing line's uniqueNumbers (if not duplicate)
            const updated = [...lineItems];
            const alreadyThere = updated[existingIdx].uniqueNumbers.some(
                u => (u.number || '').trim().toLowerCase() === unit.uniqueNumber.trim().toLowerCase()
            );
            if (alreadyThere) {
                toast.info("This unique number is already in this stamping");
                return;
            }
            updated[existingIdx].uniqueNumbers.push({ number: unit.uniqueNumber, isUsed: true });
            updated[existingIdx].quantity = updated[existingIdx].uniqueNumbers.length;
            updated[existingIdx].finalPrice = updated[existingIdx].discountedUnitPrice * updated[existingIdx].quantity;
            setLineItems(updated);
            toast.success(`Added ${unit.uniqueNumber} to ${unit.productName}`);
        } else {
            // New product row
            const newItem = {
                productId: unit.productId,
                productName: unit.productName,
                productDescription: '',
                invoiceDescription: '',
                hsnCode: unit.hsnCode || '',
                capacity: unit.capacity || '',
                quantity: 1,
                unitPrice: 0,
                discountPercent: 0,
                discountAmount: 0,
                discountedUnitPrice: 0,
                finalPrice: 0,
                uniqueNumbers: [{ number: unit.uniqueNumber, isUsed: true }]
            };
            setLineItems(prev => [...prev, newItem]);
            toast.success(`Added ${unit.productName} (${unit.uniqueNumber})`);
        }
    };

    // ============= LINE ITEM UPDATES =============
    const handleUpdateLineItem = (index, field, value) => {
        const updated = [...lineItems];
        updated[index][field] = Number(value) || 0;

        const discountFactor = (100 - updated[index].discountPercent) / 100;
        updated[index].discountedUnitPrice = updated[index].unitPrice * discountFactor;
        updated[index].discountAmount = updated[index].unitPrice - updated[index].discountedUnitPrice;
        updated[index].finalPrice = updated[index].discountedUnitPrice * updated[index].quantity;

        // Adjust uniqueNumbers length to match quantity
        const qty = updated[index].quantity;
        const current = updated[index].uniqueNumbers || [];
        if (current.length < qty) {
            const diff = qty - current.length;
            for (let i = 0; i < diff; i++) {
                updated[index].uniqueNumbers.push({ number: '', isUsed: true });
            }
        } else if (current.length > qty) {
            updated[index].uniqueNumbers = current.slice(0, qty);
        }

        setLineItems(updated);
    };

    const handleUpdateLineItemText = (index, field, value) => {
        const updated = [...lineItems];
        updated[index][field] = value;
        setLineItems(updated);
    };

    const handleUniqueNumberChange = (productIndex, numberIndex, value) => {
        const updated = [...lineItems];
        updated[productIndex].uniqueNumbers[numberIndex].number = value;
        setLineItems(updated);
    };

    const handleRemoveUniqueNumber = (productIndex, numberIndex) => {
        const updated = [...lineItems];
        const item = updated[productIndex];

        if (item.uniqueNumbers.length <= 1) {
            toast.warning("At least one unique number is required");
            return;
        }

        item.uniqueNumbers.splice(numberIndex, 1);
        // Update quantity to match unique numbers count
        item.quantity = item.uniqueNumbers.length;
        item.finalPrice = item.discountedUnitPrice * item.quantity;

        setLineItems(updated);
    };

    const handleAddUniqueNumber = (productIndex) => {
        const updated = [...lineItems];
        updated[productIndex].uniqueNumbers.push({ number: '', isUsed: true });
        updated[productIndex].quantity = updated[productIndex].uniqueNumbers.length;
        updated[productIndex].finalPrice = updated[productIndex].discountedUnitPrice * updated[productIndex].quantity;
        setLineItems(updated);
    };

    const handleRemoveLineItem = (index) => {
        if (lineItems.length <= 1) {
            toast.warning("Cannot remove the last product");
            return;
        }
        setLineItems(prev => prev.filter((_, i) => i !== index));
    };

    // ============= TOTALS =============
    const calculateTotals = () => {
        let subtotal = 0;
        let totalDiscount = 0;

        lineItems.forEach(item => {
            subtotal += (item.unitPrice || 0) * (item.quantity || 0);
            totalDiscount += (item.discountAmount || 0) * (item.quantity || 0);
        });

        const taxableAmount = subtotal - totalDiscount;

        if (!isGstMode) {
            return {
                subtotal,
                totalDiscount,
                totalTax: 0,
                grandTotal: taxableAmount,
                taxableAmount
            };
        }

        const taxRate = taxSlab / 100;
        const totalTax = taxableAmount * taxRate;
        const grandTotal = taxableAmount + totalTax;

        return { subtotal, totalDiscount, totalTax, grandTotal, taxableAmount };
    };

    const totals = calculateTotals();

    // ============= SINGLE PDF =============
    const generatePDF = async (stamping, openWhatsApp = false) => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);

        try {
            setStampingForPrint(stamping);
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = document.getElementById("stamping-pdf");
            if (!element) throw new Error("PDF element not found");

            const opt = {
                filename: `${stamping.stampingNumber}_${(stamping.customerName || "customer").replace(/\s+/g, "_")}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                margin: [0, 0, 20, 0],
                pagebreak: {
                    mode: ['css', 'legacy'],
                    avoid: ['.avoid-break', '.stamping-footer', '.declaration-terms-section', '.totals-row']
                }
            };

            await html2pdf().set(opt).from(element).save();

            toast.success("PDF generated successfully!");

            if (openWhatsApp && stamping.customerPhone) {
                const phone = stamping.customerPhone.replace(/\D/g, "");
                if (phone) {
                    const message = `Hello ${stamping.customerName || ""}, your STAMPING RECEIPT (No: ${stamping.stampingNumber}) has been generated.`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                }
            }

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
            setStampingForPrint(null);
        }
    };

    // ============= BULK PDF (ZIP) =============
    const exportPDFsAsZip = async () => {
        if (isExportingPDF) return;
        setIsExportingPDF(true);
        setPdfProgress({ current: 0, total: 0, status: 'Fetching stampings...' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                setIsExportingPDF(false);
                return;
            }

            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/get-all-filtered`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || '',
                        filterType: filterType
                    }
                }
            );

            if (!response.data.success || !response.data.data || response.data.data.length === 0) {
                toast.warning("No stampings found to export");
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
                return;
            }

            const allStampings = response.data.data;
            const total = allStampings.length;

            setPdfProgress({ current: 0, total, status: `Preparing ${total} stampings...` });

            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < allStampings.length; i++) {
                const stamping = allStampings[i];

                setPdfProgress({
                    current: i + 1,
                    total,
                    status: `Generating PDF ${i + 1} of ${total}...`
                });

                try {
                    setStampingForPrint(stamping);
                    await new Promise(resolve => setTimeout(resolve, 700));

                    const element = document.getElementById("stamping-pdf");
                    if (!element) {
                        failCount++;
                        continue;
                    }

                    const opt = {
                        image: { type: "jpeg", quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
                        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                        margin: [0, 0, 20, 0],
                        pagebreak: {
                            mode: ['css', 'legacy'],
                            avoid: ['.avoid-break', '.stamping-footer', '.declaration-terms-section', '.totals-row']
                        }
                    };

                    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');

                    const fileName = `${stamping.stampingNumber}_${(stamping.customerName || "customer").replace(/\s+/g, "_")}.pdf`;
                    zip.file(fileName, pdfBlob);

                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (err) {
                    console.error(`Error generating PDF for ${stamping.stampingNumber}:`, err);
                    failCount++;
                }
            }

            setStampingForPrint(null);
            setPdfProgress({ current: total, total, status: 'Creating ZIP file...' });

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 3 }
            });

            const zipFileName = `stampings_${new Date().toISOString().split("T")[0]}.zip`;
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

    // ============= VALIDATION =============
    const validateCustomerFields = () => {
        if (selectedCustomer) return true;

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

    const validateUniqueNumbers = () => {
        for (const item of lineItems) {
            const nums = (item.uniqueNumbers || []).map(u => (u.number || '').trim());
            const empty = nums.filter(n => n.length === 0).length;
            if (empty > 0) {
                toast.error(`Please enter all unique numbers for ${item.productName}`);
                return false;
            }
            // Check duplicates within this product
            const lower = nums.map(n => n.toLowerCase());
            const setLower = new Set(lower);
            if (setLower.size !== lower.length) {
                toast.error(`Duplicate unique numbers in ${item.productName}`);
                return false;
            }
            if (nums.length !== item.quantity) {
                toast.error(`Unique numbers count must match quantity for ${item.productName}`);
                return false;
            }
        }
        return true;
    };

    // ============= CHECK DUPLICATE (per unique number) =============
    const checkDuplicateUnit = async (productId, uniqueNumber) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/stamping/check-duplicate`,
                {
                    customerId: selectedCustomer?.customerId,
                    productId: productId,
                    uniqueNumber: uniqueNumber,
                    stampDate: stampDate,
                    excludeStampingId: isEditMode ? editStampingId : null
                },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error("Duplicate check error:", error);
            return { isDuplicate: false };
        }
    };

    // ============= SUBMIT =============
    const handleSubmit = async () => {
        if (!validateCustomerFields()) return;

        if (lineItems.length === 0) {
            toast.warning("Please add at least one product");
            return;
        }

        if (!validateUniqueNumbers()) return;

        // Check duplicates for each unique number
        for (const item of lineItems) {
            for (const un of item.uniqueNumbers) {
                const result = await checkDuplicateUnit(item.productId, un.number.trim());
                if (result.isDuplicate) {
                    toast.error(`⚠️ ${result.message}`);
                    return;
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

            let finalCustomerId = selectedCustomer?.customerId;

            if (!selectedCustomer && !isEditMode) {
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
                stampDate: stampDate,
                linkedSaleId: selectedSale?.saleId || null,
                linkedInvoiceNumber: selectedSale?.invoiceNumber || null,
                products: lineItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    hsnCode: item.hsnCode || '',
                    capacity: item.capacity || '',
                    invoiceDescription: item.invoiceDescription || '',
                    uniqueNumbers: (item.uniqueNumbers || []).map(u => ({
                        number: (u.number || '').trim(),
                        isUsed: true
                    }))
                })),
                taxSlab: isGstMode ? taxSlab : 0,
                notes: notes
            };

            let response;
            if (isEditMode && editStampingId) {
                response = await axios.put(
                    `${import.meta.env.VITE_API_URL}/stamping/update-stamping/${editStampingId}`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Stamping updated successfully!");
            } else {
                response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/stamping/create-stamping`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "Stamping created successfully!");
            }

            const newStamping = response.data.data || response.data;
            await generatePDF(newStamping, true);

            resetForm();
            await fetchStampings();
        } catch (error) {
            console.error("Error saving stamping:", error);
            toast.error(error.response?.data?.message || "Failed to save stamping");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setLineItems([]);
        setSelectedCustomer(null);
        setSelectedProduct(null);
        setSelectedSale(null);
        setLinkMode("direct");
        setNotes("");
        setStoreType("Vadodara");
        setTaxSlab(18);
        setPaymentType("Cash");
        setPaymentStatus("Paid");
        setIsGstMode(true);
        setStampDate(new Date().toISOString().split("T")[0]);
        setIsEditMode(false);
        setEditStampingId(null);
        setShowForm(false);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerGstin("");
        setCustomerAddress("");
        setIsCustomerFieldsReadOnly(false);
        setPreviousUnits([]);
    };

    // ============= EDIT =============
    const handleEditStamping = async (stamping) => {
        setIsEditMode(true);
        setEditStampingId(stamping.stampingId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === stamping.customerId);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
            await loadCustomerUnits(customer.customerId);
        }

        setStoreType(stamping.storeType || "Vadodara");
        setTaxSlab(stamping.taxSlab || 18);
        setPaymentType(stamping.paymentType || "Cash");
        setPaymentStatus(stamping.paymentStatus || "Paid");
        setIsGstMode(stamping.isGstMode !== undefined ? stamping.isGstMode : true);
        setNotes(stamping.notes || "");
        setStampDate(stamping.stampDate ? new Date(stamping.stampDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

        const items = stamping.products.map(item => ({
            ...item,
            capacity: item.capacity || '',
            invoiceDescription: item.invoiceDescription || '',
            uniqueNumbers: item.uniqueNumbers && item.uniqueNumbers.length > 0
                ? item.uniqueNumbers
                : Array.from({ length: item.quantity }, () => ({ number: '', isUsed: true }))
        }));
        setLineItems(items);
    };

    // ============= DELETE =============
    const openDeleteModal = (stamping) => {
        setStampingToDelete(stamping);
        setShowDeleteModal(true);
    };

    const confirmDeleteStamping = async () => {
        if (!stampingToDelete) return;
        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/stamping/delete-stamping/${stampingToDelete.stampingId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("Stamping deleted successfully!");
            setShowDeleteModal(false);
            setStampingToDelete(null);
            await fetchStampings();
        } catch (error) {
            console.error("Error deleting stamping:", error);
            toast.error(error.response?.data?.message || "Failed to delete stamping");
        } finally {
            setIsDeleting(false);
        }
    };

    // ============= EXPORT EXCEL =============
    const exportToExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/export-stampings`,
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

                const exportData = data.map((s) => ({
                    "Stamping No": s.stampingNumber,
                    "Customer": s.customerName,
                    "Store": s.storeType,
                    "Stamp Date": s.stampDate ? new Date(s.stampDate).toLocaleDateString() : "N/A",
                    "Linked Invoice": s.linkedInvoiceNumber || '-',
                    "Products": s.products?.length || 0,
                    "GST Mode": s.isGstMode ? "GST" : "Non-GST",
                    "Payment Status": s.paymentStatus || 'Paid',
                    "Payment Type": s.paymentType || '-',
                    "Subtotal": s.subtotal || 0,
                    "Discount": s.totalDiscount || 0,
                    "Tax": s.totalTax || 0,
                    "Grand Total": s.grandTotal || 0,
                    "Unique Numbers": s.products?.map(item =>
                        item.uniqueNumbers?.filter(u => u.number).map(u => u.number).join(', ') || ''
                    ).filter(Boolean).join('; ') || ''
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Stampings");
                XLSX.writeFile(workbook, `stampings_${new Date().toISOString().split("T")[0]}.xlsx`);
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
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // ============= PAGINATION =============
    const nextPage = () => {
        if (pagination.hasNext) setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    };
    const prevPage = () => {
        if (pagination.hasPrev) setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    };

    // ============= UNIT HISTORY MODAL =============
    const openUnitHistory = async (unit) => {
        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/stamping/get-unit-history`,
                {
                    ...headers,
                    params: {
                        customerId: unit.customerId,
                        productId: unit.productId,
                        uniqueNumber: unit.uniqueNumber
                    }
                }
            );
            if (response.data.success) {
                setUnitHistory(response.data.data);
                setShowUnitHistoryModal(true);
            }
        } catch (error) {
            console.error("Error fetching unit history:", error);
            toast.error("Failed to fetch unit history");
        }
    };

    // ============= RENDER PREVIOUS UNITS PANEL =============
    const renderPreviousUnitsPanel = () => {
        if (!selectedCustomer) return null;

        // Determine which units are already in the current stamping
        const currentNumbers = new Set();
        lineItems.forEach(item => {
            (item.uniqueNumbers || []).forEach(u => {
                const key = `${item.productId}::${(u.number || '').trim().toLowerCase()}`;
                currentNumbers.add(key);
            });
        });

        return (
            <div className="stamping-previous-section">
                <h3 className="stamping-section-title">
                    <FaHistory style={{ color: '#7366ff' }} /> Previous Stamped Units of {selectedCustomer.customerName}
                    {isLoadingUnits && <span className="stamping-loading-inline"> (loading...)</span>}
                </h3>

                {previousUnits.length === 0 ? (
                    <p className="stamping-previous-empty">
                        No previous stampings for this customer.
                    </p>
                ) : (
                    <div className="stamping-previous-grid">
                        {previousUnits.map((unit) => {
                            const key = `${unit.productId}::${unit.uniqueNumber.toLowerCase()}`;
                            const isAlreadyAdded = currentNumbers.has(key);

                            return (
                                <div
                                    key={unit.unitId}
                                    className={`stamping-previous-card ${isAlreadyAdded ? 'stamping-previous-added' : ''}`}
                                >
                                    <div className="stamping-previous-card-header">
                                        <span className="stamping-previous-product">{unit.productName}</span>
                                        {isAlreadyAdded && (
                                            <span className="stamping-previous-badge">Added</span>
                                        )}
                                    </div>
                                    <div className="stamping-previous-row">
                                        <span className="stamping-previous-label">Unique No:</span>
                                        <span className="stamping-previous-value">{unit.uniqueNumber}</span>
                                    </div>
                                    <div className="stamping-previous-row">
                                        <span className="stamping-previous-label">Last Stamped:</span>
                                        <span className="stamping-previous-value">{formatDate(unit.lastStampDate)}</span>
                                    </div>
                                    <div className="stamping-previous-row">
                                        <span className="stamping-previous-label">Total Stamps:</span>
                                        <span className="stamping-previous-value">{unit.totalStamps}</span>
                                    </div>
                                    <div className="stamping-previous-actions">
                                        {!isAlreadyAdded && (
                                            <button
                                                type="button"
                                                className="stamping-previous-add-btn"
                                                onClick={() => handleAddFromPreviousUnit(unit)}
                                            >
                                                <FaPlus /> Add to Stamping
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="stamping-previous-history-btn"
                                            onClick={() => openUnitHistory(unit)}
                                        >
                                            <FaEye /> History
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER UNIQUE NUMBERS SECTION =============
    const renderUniqueNumbers = () => {
        if (lineItems.length === 0) return null;

        return (
            <div className="stamping-unique-section">
                <h3 className="stamping-section-title">
                    <FaHashtag style={{ color: '#7366ff' }} /> Unique Numbers (Required — one per unit)
                </h3>
                <div className="stamping-unique-grid">
                    {lineItems.map((item, productIndex) => {
                        const displayNumbers = item.uniqueNumbers || [];

                        return (
                            <div key={productIndex} className="stamping-unique-product">
                                <div className="stamping-unique-product-header">
                                    <span className="stamping-unique-product-name">
                                        {item.productName}
                                    </span>
                                    <button
                                        type="button"
                                        className="stamping-unique-add-btn"
                                        onClick={() => handleAddUniqueNumber(productIndex)}
                                    >
                                        <FaPlus /> Add
                                    </button>
                                </div>
                                <div className="stamping-unique-numbers-row">
                                    {displayNumbers.map((un, numberIndex) => (
                                        <div key={numberIndex} className="stamping-unique-number-item">
                                            <input
                                                type="text"
                                                className="stamping-unique-input"
                                                placeholder={`Unit ${numberIndex + 1}`}
                                                value={un.number || ''}
                                                onChange={(e) => handleUniqueNumberChange(productIndex, numberIndex, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="stamping-unique-remove-btn"
                                                onClick={() => handleRemoveUniqueNumber(productIndex, numberIndex)}
                                                title="Remove"
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

    // ============= RENDER VIEW MODAL =============
    const renderViewModal = () => {
        if (!selectedStamping) return null;

        return (
            <div className="stamping-modal-overlay" onClick={() => setShowViewModal(false)}>
                <div className="stamping-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="stamping-modal-header">
                        <h3 className="stamping-modal-title">
                            <FaStamp /> Stamping Receipt - {selectedStamping.stampingNumber}
                        </h3>
                        <button className="stamping-modal-close" onClick={() => setShowViewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="stamping-modal-body">
                        <div className="stamping-view-grid">
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Stamping No:</span>
                                <span className="stamping-view-value">{selectedStamping.stampingNumber}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Stamp Date:</span>
                                <span className="stamping-view-value">{formatDate(selectedStamping.stampDate)}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Customer:</span>
                                <span className="stamping-view-value">{selectedStamping.customerName}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Store:</span>
                                <span className="stamping-view-value">{selectedStamping.storeType}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">GST Mode:</span>
                                <span className="stamping-view-value">{selectedStamping.isGstMode ? "GST" : "Non-GST"}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Payment Status:</span>
                                <span className="stamping-view-value">{selectedStamping.paymentStatus || 'Paid'}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Payment Type:</span>
                                <span className="stamping-view-value">{selectedStamping.paymentType || '-'}</span>
                            </div>
                            {selectedStamping.linkedInvoiceNumber && (
                                <div className="stamping-view-item">
                                    <span className="stamping-view-label">Linked Invoice:</span>
                                    <span className="stamping-view-value">{selectedStamping.linkedInvoiceNumber}</span>
                                </div>
                            )}
                            <div className="stamping-view-item stamping-view-item-full">
                                <span className="stamping-view-label">Notes:</span>
                                <span className="stamping-view-value">{selectedStamping.notes || 'No notes'}</span>
                            </div>
                        </div>

                        <h4 className="stamping-view-subtitle">Products & Unique Numbers</h4>
                        <div className="stamping-view-table-wrap">
                            <table className="stamping-view-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Product Desc</th>
                                        <th>Qty</th>
                                        <th>Capacity</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th>HSN</th>
                                        <th>Unique Numbers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedStamping.products?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>{item.productName}</td>
                                            <td>{item.invoiceDescription || '-'}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.capacity || '-'}</td>
                                            <td>₹{item.unitPrice?.toFixed(2) || 0}</td>
                                            <td>₹{item.finalPrice?.toFixed(2) || 0}</td>
                                            <td>{item.hsnCode || '-'}</td>
                                            <td>
                                                {item.uniqueNumbers?.filter(u => u.number).map((u, i) => (
                                                    <span key={i} className="stamping-unique-tag">
                                                        {u.number}
                                                    </span>
                                                )) || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="stamping-view-summary">
                            <div className="stamping-view-total">
                                <span>Subtotal:</span>
                                <span>₹{selectedStamping.subtotal?.toFixed(2) || 0}</span>
                            </div>
                            <div className="stamping-view-total">
                                <span>Discount:</span>
                                <span>₹{selectedStamping.totalDiscount?.toFixed(2) || 0}</span>
                            </div>
                            {selectedStamping.isGstMode && (
                                <div className="stamping-view-total">
                                    <span>Tax ({selectedStamping.taxSlab}%):</span>
                                    <span>₹{selectedStamping.totalTax?.toFixed(2) || 0}</span>
                                </div>
                            )}
                            <div className="stamping-view-total stamping-view-grand">
                                <span>Grand Total:</span>
                                <span>₹{selectedStamping.grandTotal?.toFixed(2) || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="stamping-modal-footer">
                        <button
                            className="stamping-pdf-btn"
                            onClick={() => generatePDF(selectedStamping, false)}
                            disabled={isGeneratingPDF}
                        >
                            <FaFilePdf /> {isGeneratingPDF ? "Generating..." : "PDF"}
                        </button>
                        <button className="stamping-modal-close-btn" onClick={() => setShowViewModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER UNIT HISTORY MODAL =============
    const renderUnitHistoryModal = () => {
        if (!showUnitHistoryModal || !unitHistory) return null;

        return (
            <div className="stamping-modal-overlay" onClick={() => setShowUnitHistoryModal(false)}>
                <div className="stamping-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="stamping-modal-header">
                        <h3 className="stamping-modal-title">
                            <FaHistory /> Unit History — {unitHistory.productName} ({unitHistory.uniqueNumber})
                        </h3>
                        <button className="stamping-modal-close" onClick={() => setShowUnitHistoryModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="stamping-modal-body">
                        <div className="stamping-view-grid">
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Customer:</span>
                                <span className="stamping-view-value">{unitHistory.customerName}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Product:</span>
                                <span className="stamping-view-value">{unitHistory.productName}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Unique No:</span>
                                <span className="stamping-view-value">{unitHistory.uniqueNumber}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Total Stamps:</span>
                                <span className="stamping-view-value">{unitHistory.totalStamps}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Last Stamped:</span>
                                <span className="stamping-view-value">{formatDate(unitHistory.lastStampDate)}</span>
                            </div>
                            <div className="stamping-view-item">
                                <span className="stamping-view-label">Next Due:</span>
                                <span className="stamping-view-value">{formatDate(unitHistory.nextDueDate)}</span>
                            </div>
                        </div>

                        <h4 className="stamping-view-subtitle">Full History</h4>
                        <div className="stamping-view-table-wrap">
                            <table className="stamping-view-table">
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
                                    {unitHistory.stampHistory?.map((h, idx) => (
                                        <tr key={h.stampingId || idx}>
                                            <td>{idx + 1}</td>
                                            <td>{h.stampingNumber}</td>
                                            <td>{formatDate(h.stampDate)}</td>
                                            <td>{h.storeType}</td>
                                            <td>{h.stampedBy || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="stamping-modal-footer">
                        <button className="stamping-modal-close-btn" onClick={() => setShowUnitHistoryModal(false)}>
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
            <div className="stamping-form-container">
                <div className="stamping-form-header">
                    <h2 className="stamping-form-title">
                        <FaStamp style={{ color: '#7366ff' }} />
                        {isEditMode ? "Edit Stamping Receipt" : "Create New Stamping Receipt"}
                    </h2>
                    <button className="stamping-form-close" onClick={resetForm}>
                        <FaTimes />
                    </button>
                </div>

                {/* Link mode + GST toggles */}
                {!isEditMode && (
                    <div className="stamping-toggle-section">
                        <div className="stamping-toggle-row">
                            <div className="stamping-toggle-container">
                                <span className="stamping-toggle-label">
                                    <FaLink /> Source
                                </span>
                                <button
                                    className={`stamping-toggle-btn ${linkMode === 'direct' ? 'active' : ''}`}
                                    onClick={() => {
                                        setLinkMode('direct');
                                        setSelectedSale(null);
                                        setLineItems([]);
                                    }}
                                    type="button"
                                >
                                    {linkMode === 'direct' ? <FaToggleOn /> : <FaToggleOff />}
                                    <span>Direct</span>
                                </button>
                                <button
                                    className={`stamping-toggle-btn ${linkMode === 'sale' ? 'active' : ''}`}
                                    onClick={() => {
                                        setLinkMode('sale');
                                        setLineItems([]);
                                    }}
                                    type="button"
                                >
                                    {linkMode === 'sale' ? <FaToggleOn /> : <FaToggleOff />}
                                    <span>From Sale</span>
                                </button>
                            </div>

                            <div className="stamping-toggle-container">
                                <span className="stamping-toggle-label">GST Mode</span>
                                <button
                                    className={`stamping-toggle-btn ${isGstMode ? 'active' : ''}`}
                                    onClick={() => {
                                        const newGst = !isGstMode;
                                        setIsGstMode(newGst);
                                        setTaxSlab(newGst ? 18 : 0);
                                    }}
                                    type="button"
                                >
                                    {isGstMode ? <FaToggleOn /> : <FaToggleOff />}
                                    <span>{isGstMode ? "GST" : "Non-GST"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sale selector */}
                {!isEditMode && linkMode === 'sale' && (
                    <div className="stamping-section">
                        <div className="stamping-form-row">
                            <div className="stamping-form-field stamping-form-field-full">
                                <label className="stamping-form-label">
                                    <FaFileInvoice /> Select Sale / Invoice
                                </label>
                                <Select
                                    options={sales.map(s => ({
                                        value: s.saleId,
                                        label: `${s.invoiceNumber} - ${s.customerName} (₹${s.grandTotal?.toFixed(2) || 0})`
                                    }))}
                                    styles={selectStyles}
                                    className="stamping-react-select"
                                    classNamePrefix="stamping-select"
                                    placeholder="Search sale by invoice or customer..."
                                    isSearchable
                                    isClearable
                                    value={selectedSale ? {
                                        value: selectedSale.saleId,
                                        label: `${selectedSale.invoiceNumber} - ${selectedSale.customerName}`
                                    } : null}
                                    onChange={handleSaleSelect}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Customer + stamp date */}
                <div className="stamping-section">
                    <div className="stamping-form-row">
                        {!isEditMode && linkMode === 'direct' && (
                            <div className="stamping-form-field" style={{ flex: 7 }}>
                                <label className="stamping-form-label">
                                    <FaUser /> Select Customer
                                </label>
                                <Select
                                    options={customers.map(c => ({
                                        value: c.customerId,
                                        label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                                    }))}
                                    styles={selectStyles}
                                    className="stamping-react-select"
                                    classNamePrefix="stamping-select"
                                    placeholder="Search Customer..."
                                    isSearchable
                                    isClearable
                                    value={selectedCustomer ? {
                                        value: selectedCustomer.customerId,
                                        label: `${selectedCustomer.customerName} ${selectedCustomer.contactNumber ? `(${selectedCustomer.contactNumber})` : ''}`
                                    } : null}
                                    onChange={handleCustomerSelect}
                                />
                            </div>
                        )}

                        <div className="stamping-form-field" style={{ flex: isEditMode ? 1 : 3 }}>
                            <label className="stamping-form-label">
                                <FaCalendarAlt /> Stamp Date *
                            </label>
                            <input
                                type="date"
                                className="stamping-input-field"
                                value={stampDate}
                                onChange={(e) => setStampDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {(!isEditMode || (isEditMode && selectedCustomer)) && (
                        <div className="stamping-customer-details">
                            <div className="stamping-form-row">
                                <div className="stamping-form-field">
                                    <label className="stamping-form-label">
                                        <FaUser /> Customer Name {!selectedCustomer && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="stamping-input-field"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "Enter customer name"}
                                    />
                                </div>
                                <div className="stamping-form-field">
                                    <label className="stamping-form-label">
                                        <FaEnvelope /> Email
                                    </label>
                                    <input
                                        type="email"
                                        className="stamping-input-field"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "Enter email"}
                                    />
                                </div>
                            </div>

                            <div className="stamping-form-row">
                                <div className="stamping-form-field">
                                    <label className="stamping-form-label">
                                        <FaPhone /> Phone Number {!selectedCustomer && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="stamping-input-field"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "10 digits"}
                                        maxLength="10"
                                    />
                                </div>
                                <div className="stamping-form-field">
                                    <label className="stamping-form-label">
                                        <FaInfoCircle /> GSTIN {isGstMode && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="stamping-input-field"
                                        value={customerGstin}
                                        onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "15 characters"}
                                        maxLength="15"
                                    />
                                </div>
                            </div>

                            <div className="stamping-form-row">
                                <div className="stamping-form-field stamping-form-field-full">
                                    <label className="stamping-form-label">
                                        <FaMapMarkerAlt /> Address
                                    </label>
                                    <input
                                        type="text"
                                        className="stamping-input-field"
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "Enter address"}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Previous units panel */}
                {selectedCustomer && renderPreviousUnitsPanel()}

                {/* Product add (direct mode only, or edit) */}
                {(!isEditMode && linkMode === 'direct') || isEditMode ? (
                    <div className="stamping-section">
                        <div className="stamping-product-row">
                            <div className="stamping-product-select" style={{ flex: 1 }}>
                                <label className="stamping-form-label">
                                    <FaBox /> Select Product
                                </label>
                                <Select
                                    options={products.map(p => ({
                                        value: p.productId,
                                        label: `${p.productName}`
                                    }))}
                                    styles={selectStyles}
                                    className="stamping-react-select"
                                    classNamePrefix="stamping-select"
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
                ) : null}

                {/* Line items table */}
                {lineItems.length > 0 && (
                    <div className="stamping-section">
                        <div className="stamping-items-table-wrap">
                            <table className="stamping-items-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Product Desc</th>
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
                                            <td className="stamping-item-name">{item.productName}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="stamping-item-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Desc"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="stamping-item-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="stamping-item-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="stamping-item-input"
                                                    value={item.quantity}
                                                    min="1"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="stamping-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                                />
                                            </td>
                                            <td className="stamping-item-final">
                                                ₹{item.finalPrice.toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="stamping-item-remove"
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

                {/* Unique numbers section */}
                {lineItems.length > 0 && renderUniqueNumbers()}

                {/* Store, Tax, Payment */}
                <div className="stamping-section">
                    <div className="stamping-form-row">
                        <div className="stamping-form-field">
                            <label className="stamping-form-label">
                                <FaStore /> Store *
                            </label>
                            <Select
                                options={STORE_OPTIONS}
                                styles={selectStyles}
                                className="stamping-react-select"
                                classNamePrefix="stamping-select"
                                value={STORE_OPTIONS.find(opt => opt.value === storeType)}
                                onChange={(option) => setStoreType(option?.value || "Vadodara")}
                            />
                        </div>

                        {isGstMode && (
                            <div className="stamping-form-field">
                                <label className="stamping-form-label">
                                    <FaInfoCircle /> Tax Slab *
                                </label>
                                <Select
                                    options={TAX_OPTIONS}
                                    styles={selectStyles}
                                    className="stamping-react-select"
                                    classNamePrefix="stamping-select"
                                    value={TAX_OPTIONS.find(opt => opt.value === taxSlab)}
                                    onChange={(option) => setTaxSlab(option?.value || 18)}
                                />
                            </div>
                        )}

                        <div className="stamping-form-field">
                            <label className="stamping-form-label">
                                <FaMoneyBillWave /> Payment Status *
                            </label>
                            <Select
                                options={PAYMENT_STATUS_OPTIONS}
                                styles={selectStyles}
                                className="stamping-react-select"
                                classNamePrefix="stamping-select"
                                value={PAYMENT_STATUS_OPTIONS.find(opt => opt.value === paymentStatus)}
                                onChange={(option) => setPaymentStatus(option?.value || "Paid")}
                            />
                        </div>

                        {paymentStatus === 'Paid' && (
                            <div className="stamping-form-field">
                                <label className="stamping-form-label">
                                    <FaRupeeSign /> Payment Type *
                                </label>
                                <Select
                                    options={PAYMENT_OPTIONS}
                                    styles={selectStyles}
                                    className="stamping-react-select"
                                    classNamePrefix="stamping-select"
                                    value={PAYMENT_OPTIONS.find(opt => opt.value === paymentType)}
                                    onChange={(option) => setPaymentType(option?.value || "Cash")}
                                />
                            </div>
                        )}
                    </div>

                    <div className="stamping-form-row">
                        <div className="stamping-form-field stamping-form-field-full">
                            <label className="stamping-form-label">
                                <FaInfoCircle /> Notes (Optional)
                            </label>
                            <textarea
                                className="stamping-textarea-field"
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
                    <div className="stamping-summary-column">
                        <div className="stamping-summary-title">Summary</div>
                        <div className="stamping-summary-items">
                            <div className="stamping-summary-row">
                                <span>Subtotal</span>
                                <span>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="stamping-summary-row stamping-summary-discount">
                                <span>Discount</span>
                                <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="stamping-summary-row">
                                <span>Taxable Amount</span>
                                <span>₹{totals.taxableAmount.toFixed(2)}</span>
                            </div>
                            {isGstMode && (
                                <div className="stamping-summary-row">
                                    <span>Tax ({taxSlab}%)</span>
                                    <span>₹{totals.totalTax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="stamping-summary-row stamping-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            className="stamping-submit-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitting || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update Stamping" : "Create Stamping"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER DELETE MODAL =============
    const renderDeleteModal = () => {
        if (!showDeleteModal || !stampingToDelete) return null;

        return (
            <div className="stamping-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                <div className="stamping-delete-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="stamping-delete-modal-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h3 className="stamping-delete-modal-title">Confirm Delete</h3>
                    <p className="stamping-delete-modal-text">
                        Are you sure you want to delete this stamping receipt? This action cannot be undone.
                    </p>

                    <div className="stamping-delete-modal-info">
                        <div className="stamping-delete-modal-row">
                            <span className="stamping-delete-modal-label">Stamping No:</span>
                            <span className="stamping-delete-modal-value">{stampingToDelete.stampingNumber}</span>
                        </div>
                        <div className="stamping-delete-modal-row">
                            <span className="stamping-delete-modal-label">Customer:</span>
                            <span className="stamping-delete-modal-value">{stampingToDelete.customerName}</span>
                        </div>
                        <div className="stamping-delete-modal-row">
                            <span className="stamping-delete-modal-label">Amount:</span>
                            <span className="stamping-delete-modal-value">₹{stampingToDelete.grandTotal?.toFixed(2) || 0}</span>
                        </div>
                    </div>

                    <div className="stamping-delete-modal-buttons">
                        <button
                            className="stamping-delete-modal-cancel"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="stamping-delete-modal-confirm"
                            onClick={confirmDeleteStamping}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER PDF PROGRESS =============
    const renderPDFProgress = () => {
        if (!isExportingPDF) return null;

        const percentage = pdfProgress.total > 0
            ? Math.round((pdfProgress.current / pdfProgress.total) * 100)
            : 0;

        return (
            <div className="stamping-pdf-progress-overlay">
                <div className="stamping-pdf-progress-modal">
                    <div className="stamping-pdf-progress-icon">
                        <FaFileArchive />
                    </div>
                    <h3 className="stamping-pdf-progress-title">Exporting Stamping Receipts</h3>
                    <p className="stamping-pdf-progress-status">{pdfProgress.status}</p>
                    {pdfProgress.total > 0 && (
                        <>
                            <div className="stamping-pdf-progress-bar-container">
                                <div
                                    className="stamping-pdf-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="stamping-pdf-progress-percentage">{percentage}%</div>
                        </>
                    )}
                    <div className="stamping-pdf-progress-spinner"></div>
                    <p className="stamping-pdf-progress-hint">
                        Please don't close this window while PDFs are being generated
                    </p>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="stamping-table-container">
            <div className="stamping-table-header">
                <div className="stamping-search-filter-group">
                    <div className="stamping-search-container">
                        <FaSearch className="stamping-search-icon" />
                        <input
                            type="text"
                            className="stamping-search-input"
                            placeholder="Search by Stamping No, Customer, Unique No..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="stamping-filter-container">
                        <FaFilter className="stamping-filter-icon" />
                        <Select
                            options={FILTER_OPTIONS}
                            styles={selectStyles}
                            className="stamping-filter-select"
                            classNamePrefix="stamping-filter"
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

                <div className="stamping-action-buttons">
                    <button
                        className="stamping-create-btn"
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
                        className="stamping-pdf-export-btn"
                        onClick={exportPDFsAsZip}
                        disabled={isExportingPDF || isLoading || stampings.length === 0}
                        title="Export all filtered stampings as PDF (ZIP)"
                    >
                        {isExportingPDF ? (
                            <span className="stamping-loading-spinner-small"></span>
                        ) : (
                            <FaFilePdf />
                        )}
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
                    </button>
                    <button
                        className="stamping-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="stamping-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export Excel"}
                    </button>
                </div>
            </div>

            {showForm && renderForm()}

            {isLoading ? (
                <div className="stamping-loading-container">
                    <div className="stamping-loading-spinner"></div>
                    <p>Loading stampings...</p>
                </div>
            ) : stampings.length === 0 ? (
                <div className="stamping-empty-state">
                    <FaStamp size={50} color="#ccc" />
                    <p>No stampings found</p>
                </div>
            ) : (
                <>
                    <div className="stamping-table-responsive">
                        <table className="stamping-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Stamping No</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Stamp Date</th>
                                    <th>Products</th>
                                    <th>GST Mode</th>
                                    <th>Payment</th>
                                    <th>Total</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stampings.map((s, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={s.stampingId} className="stamping-table-row">
                                            <td>{serialNo}</td>
                                            <td className="stamping-number">
                                                <strong>{s.stampingNumber}</strong>
                                            </td>
                                            <td>{s.customerName}</td>
                                            <td>{s.storeType}</td>
                                            <td>{s.stampDate ? new Date(s.stampDate).toLocaleDateString() : "N/A"}</td>
                                            <td>{s.products?.length || 0}</td>
                                            <td>{s.isGstMode ? "GST" : "Non-GST"}</td>
                                            <td>
                                                <span className={`stamping-status-badge ${s.paymentStatus === 'Paid' ? 'stamping-status-paid' : 'stamping-status-pending'}`}>
                                                    {s.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />}
                                                    {' '}{s.paymentStatus || 'Paid'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="stamping-total-badge">
                                                    ₹{s.grandTotal?.toFixed(2) || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="stamping-action-btns">
                                                    <button
                                                        className="stamping-view-btn"
                                                        onClick={() => {
                                                            setSelectedStamping(s);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        className="stamping-edit-btn"
                                                        onClick={() => handleEditStamping(s)}
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className="stamping-delete-btn"
                                                        onClick={() => openDeleteModal(s)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                    <button
                                                        className="stamping-pdf-row-btn"
                                                        onClick={() => generatePDF(s, false)}
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
                        <div className="stamping-pagination">
                            <div className="stamping-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="stamping-pagination-buttons">
                                <button
                                    className="stamping-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="stamping-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="stamping-page-btn"
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
            <div className="stamping-module-wrapper">
                {/* <div className="stamping-page-header">
                    <h2 className="stamping-page-title">Stamping Management</h2>
                </div> */}

                <div className="stamping-content-wrapper">
                    {renderTable()}
                </div>

                {showViewModal && renderViewModal()}
                {showUnitHistoryModal && renderUnitHistoryModal()}
                {renderDeleteModal()}
                {renderPDFProgress()}

                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {stampingForPrint && <StampingPrint stamping={stampingForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default Stamping;