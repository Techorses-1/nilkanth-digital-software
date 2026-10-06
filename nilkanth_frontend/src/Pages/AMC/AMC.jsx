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
    FaHashtag,
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaFileAlt,
    FaFilter,
    FaFileArchive,
    FaExclamationTriangle,
    FaSyncAlt,
    FaTools,
    FaToggleOn,
    FaToggleOff,
    FaLink,
    FaHistory,
    FaPlusCircle
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import AMCPrint from "./AMCPrint";
import "./AMC.scss";
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

// Duration Options
const DURATION_OPTIONS = [
    { value: 1, label: "1 Year" },
    { value: 2, label: "2 Years" },
    { value: 3, label: "3 Years" },
    { value: 5, label: "5 Years" }
];

// Filter Options
const FILTER_OPTIONS = [
    { value: "All", label: "All AMCs" },
    { value: "Active", label: "Active Only" },
    { value: "Expired", label: "Expired Only" },
    { value: "GST", label: "GST Only" },
    { value: "Non-GST", label: "Non-GST Only" }
];

const AMC = () => {
    // ============= STATE =============
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [amcs, setAmcs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterType, setFilterType] = useState("GST");

    // ============= DELETE MODAL STATE =============
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [amcToDelete, setAmcToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ============= PDF BULK EXPORT STATE =============
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
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [durationYears, setDurationYears] = useState(1);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editAmcId, setEditAmcId] = useState(null);

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
    const [selectedAmc, setSelectedAmc] = useState(null);

    // ============= SERVICE MODAL STATE =============
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [serviceAmc, setServiceAmc] = useState(null);
    const [serviceProductId, setServiceProductId] = useState("");
    const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
    const [serviceQty, setServiceQty] = useState(1);
    const [serviceStore, setServiceStore] = useState("Vadodara");
    const [serviceNotes, setServiceNotes] = useState("");
    const [isAddingService, setIsAddingService] = useState(false);

    // ============= RENEW MODAL STATE =============
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [renewAmc, setRenewAmc] = useState(null);
    const [renewDuration, setRenewDuration] = useState(1);
    const [renewStartDate, setRenewStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [renewNotes, setRenewNotes] = useState("");
    const [renewProducts, setRenewProducts] = useState([]); // { ...product, _selected: true, _isNew: false }
    const [renewNewProductId, setRenewNewProductId] = useState(null);
    const [isRenewing, setIsRenewing] = useState(false);

    // ============= PDF/PRINT STATE =============
    const [amcForPrint, setAmcForPrint] = useState(null);

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
            fetchAmcs();
        }
    }, [debouncedSearch, pagination.page, filterType]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();

            const [customersRes, productsRes, salesRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers?limit=1000`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/products-master/get-products`, headers),
                axios.get(`${import.meta.env.VITE_API_URL}/sales/get-sales`, {
                    ...headers,
                    params: { page: 1, limit: 1000 }
                }),
            ]);

            const customersData = customersRes.data?.data || customersRes.data || [];
            const productsData = productsRes.data?.data || productsRes.data || [];
            const salesData = salesRes.data?.data || salesRes.data || [];

            setCustomers(Array.isArray(customersData) ? customersData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);
            setSales(Array.isArray(salesData) ? salesData : []);

            await fetchAmcs();
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data.");
            }
            setCustomers([]);
            setProducts([]);
            setSales([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAmcs = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/amc/get-amcs`,
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
                setAmcs(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                });
            } else {
                setAmcs([]);
            }
        } catch (error) {
            console.error("Error fetching AMCs:", error);
            setAmcs([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============= SALE SELECT (Link Mode) =============
    const handleSaleSelect = async (option) => {
        const saleId = option?.value;
        if (!saleId) {
            setSelectedSale(null);
            return;
        }

        try {
            const headers = getAuthHeaders();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/amc/get-sale-products/${saleId}`,
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
                }

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
                    finalPrice: 0
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

        // const exists = lineItems.some(item => item.productId === product.productId);
        // if (exists) {
        //     toast.warning("Product already added");
        //     setSelectedProduct(null);
        //     return;
        // }

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
            finalPrice: 0
        };

        setLineItems(prev => [...prev, newItem]);
        setSelectedProduct(null);
        toast.success(`${product.productName} added`);
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

    // ============= CALCULATE END DATE (preview) =============
    const previewEndDate = useMemo(() => {
        if (!startDate || !durationYears) return "-";
        const end = new Date(startDate);
        end.setFullYear(end.getFullYear() + durationYears);
        end.setDate(end.getDate() - 1);
        return end.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }, [startDate, durationYears]);

    // ============= RENEW: PRODUCT HELPERS =============
    const renewProductsCalc = useMemo(() => {
        const selected = renewProducts.filter(p => p._selected);

        let subtotal = 0;
        let totalDiscount = 0;

        selected.forEach(item => {
            const discountFactor = (100 - (item.discountPercent || 0)) / 100;
            const discountedUnitPrice = (item.unitPrice || 0) * discountFactor;
            const discountAmount = (item.unitPrice || 0) - discountedUnitPrice;
            subtotal += (item.unitPrice || 0) * (item.quantity || 0);
            totalDiscount += discountAmount * (item.quantity || 0);
        });

        const taxableAmount = subtotal - totalDiscount;

        if (!renewAmc?.isGstMode) {
            return { subtotal, totalDiscount, totalTax: 0, grandTotal: taxableAmount, taxableAmount };
        }

        const taxRate = (renewAmc?.taxSlab || 0) / 100;
        const totalTax = taxableAmount * taxRate;
        const grandTotal = taxableAmount + totalTax;

        return { subtotal, totalDiscount, totalTax, grandTotal, taxableAmount };
    }, [renewProducts, renewAmc]);

    const toggleRenewProduct = (index) => {
        const updated = [...renewProducts];
        updated[index]._selected = !updated[index]._selected;
        setRenewProducts(updated);
    };

    const updateRenewProduct = (index, field, value) => {
        const updated = [...renewProducts];

        if (field === 'quantity' || field === 'unitPrice' || field === 'discountPercent') {
            updated[index][field] = Number(value) || 0;
            const discountFactor = (100 - (updated[index].discountPercent || 0)) / 100;
            updated[index].discountedUnitPrice = (updated[index].unitPrice || 0) * discountFactor;
            updated[index].discountAmount = (updated[index].unitPrice || 0) - updated[index].discountedUnitPrice;
            updated[index].finalPrice = updated[index].discountedUnitPrice * (updated[index].quantity || 0);
        } else {
            updated[index][field] = value;
        }

        setRenewProducts(updated);
    };

    const removeRenewProduct = (index) => {
        setRenewProducts(prev => prev.filter((_, i) => i !== index));
    };

    const addNewProductToRenew = (option) => {
        if (!option) return;
        const product = products.find(p => p.productId === option.value);
        if (!product) return;

        const exists = renewProducts.some(p => p.productId === product.productId);
        if (exists) {
            toast.warning("Product already in renewal list");
            setRenewNewProductId(null);
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
            _selected: true,
            _isNew: true
        };

        setRenewProducts(prev => [...prev, newItem]);
        setRenewNewProductId(null);
        toast.success(`${product.productName} added to renewal`);
    };

    // ============= SINGLE PDF GENERATION =============
    const generatePDF = async (amc, openWhatsApp = false) => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);

        try {
            setAmcForPrint(amc);
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = document.getElementById("amc-pdf");
            if (!element) {
                throw new Error("PDF element not found");
            }

            const opt = {
                filename: `${amc.amcNumber}_${(amc.customerName || "customer").replace(/\s+/g, "_")}.pdf`,
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

            if (openWhatsApp && amc.customerPhone) {
                const phone = amc.customerPhone.replace(/\D/g, "");
                if (phone) {
                    const message = `Hello ${amc.customerName || ""}, your AMC (No: ${amc.amcNumber}) has been generated.`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                }
            }

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
            setAmcForPrint(null);
        }
    };

    // ============= BULK PDF EXPORT (ZIP) =============
    const exportPDFsAsZip = async () => {
        if (isExportingPDF) return;

        setIsExportingPDF(true);
        setPdfProgress({ current: 0, total: 0, status: 'Fetching AMCs...' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                setIsExportingPDF(false);
                return;
            }

            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/amc/get-all-filtered`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || '',
                        filterType: filterType
                    }
                }
            );

            if (!response.data.success || !response.data.data || response.data.data.length === 0) {
                toast.warning("No AMCs found to export");
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
                return;
            }

            const allAmcs = response.data.data;
            const total = allAmcs.length;

            setPdfProgress({ current: 0, total, status: `Preparing ${total} AMCs...` });

            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < allAmcs.length; i++) {
                const amc = allAmcs[i];

                setPdfProgress({
                    current: i + 1,
                    total,
                    status: `Generating PDF ${i + 1} of ${total}...`
                });

                try {
                    setAmcForPrint(amc);
                    await new Promise(resolve => setTimeout(resolve, 700));

                    const element = document.getElementById("amc-pdf");
                    if (!element) {
                        console.error(`PDF element not found for ${amc.amcNumber}`);
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

                    const fileName = `${amc.amcNumber}_${(amc.customerName || "customer").replace(/\s+/g, "_")}.pdf`;
                    zip.file(fileName, pdfBlob);

                    successCount++;

                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (err) {
                    console.error(`Error generating PDF for ${amc.amcNumber}:`, err);
                    failCount++;
                }
            }

            setAmcForPrint(null);

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

            const zipFileName = filterType === 'Active'
                ? `active_amcs_${new Date().toISOString().split("T")[0]}.zip`
                : filterType === 'Expired'
                    ? `expired_amcs_${new Date().toISOString().split("T")[0]}.zip`
                    : `amcs_${new Date().toISOString().split("T")[0]}.zip`;

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

    // ============= HANDLE SUBMIT (CREATE / UPDATE) =============
    const handleSubmit = async () => {
        if (!validateCustomerFields()) return;

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

            const productsPayload = lineItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent,
                hsnCode: item.hsnCode || '',
                capacity: item.capacity || '',
                invoiceDescription: item.invoiceDescription || ''
            }));

            const payload = {
                customerId: finalCustomerId,
                customerGstin: selectedCustomer ? selectedCustomer.gstNumber || '' : customerGstin,
                storeType: storeType,
                paymentType: paymentStatus === 'Pending' ? null : paymentType,
                paymentStatus: paymentStatus,
                isGstMode: isGstMode,
                startDate: startDate,
                durationYears: durationYears,
                linkedSaleId: selectedSale?.saleId || null,
                linkedInvoiceNumber: selectedSale?.invoiceNumber || null,
                products: productsPayload,
                taxSlab: isGstMode ? taxSlab : 0,
                notes: notes
            };

            let response;
            if (isEditMode && editAmcId) {
                // Edit — send everything
                response = await axios.put(
                    `${import.meta.env.VITE_API_URL}/amc/update-amc/${editAmcId}`,
                    {
                        startDate: startDate,
                        durationYears: durationYears,
                        notes: notes,
                        paymentStatus: paymentStatus,
                        paymentType: paymentStatus === 'Pending' ? null : paymentType,
                        products: productsPayload
                    },
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "AMC updated successfully!");
            } else {
                response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/amc/create-amc`,
                    payload,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                toast.success(response.data.message || "AMC created successfully!");
            }

            const newAmc = response.data.data || response.data;
            // ✅ WhatsApp opens here on submit (same as Sales)
            await generatePDF(newAmc, true);

            resetForm();
            await fetchAmcs();
        } catch (error) {
            console.error("Error saving AMC:", error);
            toast.error(error.response?.data?.message || "Failed to save AMC");
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
        setStartDate(new Date().toISOString().split("T")[0]);
        setDurationYears(1);
        setIsEditMode(false);
        setEditAmcId(null);
        setShowForm(false);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerGstin("");
        setCustomerAddress("");
        setIsCustomerFieldsReadOnly(false);
    };

    // ============= EDIT AMC =============
    const handleEditAmc = (amc) => {
        if (amc.status === 'Expired' || amc.status === 'Cancelled') {
            toast.error("Cannot edit expired or cancelled AMC. Please create a renewal instead.");
            return;
        }

        setIsEditMode(true);
        setEditAmcId(amc.amcId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === amc.customerId);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
        }

        setStoreType(amc.storeType || "Vadodara");
        setTaxSlab(amc.taxSlab || 18);
        setPaymentType(amc.paymentType || "Cash");
        setPaymentStatus(amc.paymentStatus || "Paid");
        setIsGstMode(amc.isGstMode !== undefined ? amc.isGstMode : true);
        setNotes(amc.notes || "");
        setStartDate(amc.startDate ? new Date(amc.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        setDurationYears(amc.durationYears || 1);

        const items = amc.products.map(item => ({
            ...item,
            capacity: item.capacity || '',
            invoiceDescription: item.invoiceDescription || ''
        }));
        setLineItems(items);
    };

    // ============= DELETE =============
    const openDeleteModal = (amc) => {
        setAmcToDelete(amc);
        setShowDeleteModal(true);
    };

    const confirmDeleteAmc = async () => {
        if (!amcToDelete) return;

        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/amc/delete-amc/${amcToDelete.amcId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("AMC deleted successfully!");
            setShowDeleteModal(false);
            setAmcToDelete(null);
            await fetchAmcs();
        } catch (error) {
            console.error("Error deleting AMC:", error);
            toast.error(error.response?.data?.message || "Failed to delete AMC");
        } finally {
            setIsDeleting(false);
        }
    };

    // ============= SERVICE MODAL =============
    const openServiceModal = (amc) => {
        if (amc.status !== 'Active') {
            toast.warning(`Cannot add service. AMC is ${amc.status}.`);
            return;
        }
        setServiceAmc(amc);
        setServiceProductId(amc.products[0]?.productId || "");
        setServiceDate(new Date().toISOString().split("T")[0]);
        setServiceQty(1);
        setServiceStore(amc.storeType || "Vadodara");
        setServiceNotes("");
        setShowServiceModal(true);
    };

    const handleAddService = async () => {
        if (!serviceProductId) {
            toast.error("Please select a product");
            return;
        }

        setIsAddingService(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/amc/add-service/${serviceAmc.amcId}`,
                {
                    productId: serviceProductId,
                    serviceDate: serviceDate,
                    quantity: Number(serviceQty),
                    storeType: serviceStore,
                    notes: serviceNotes
                },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            toast.success("Service entry added successfully!");
            setShowServiceModal(false);
            setServiceAmc(null);
            await fetchAmcs();

            if (showViewModal && selectedAmc && selectedAmc.amcId === serviceAmc?.amcId) {
                const fresh = response.data.data;
                setSelectedAmc(fresh);
            }
        } catch (error) {
            console.error("Error adding service:", error);
            toast.error(error.response?.data?.message || "Failed to add service entry");
        } finally {
            setIsAddingService(false);
        }
    };

    // ============= RENEW MODAL =============
    const openRenewModal = (amc) => {
        setRenewAmc(amc);
        setRenewDuration(1);
        setRenewNotes("");

        // Preload products from old AMC
        const preloaded = (amc.products || []).map(p => ({
            ...p,
            _selected: true,
            _isNew: false
        }));
        setRenewProducts(preloaded);
        setRenewNewProductId(null);

        // Default start date
        if (amc.status === 'Active') {
            const nextDay = new Date(amc.endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            setRenewStartDate(nextDay.toISOString().split("T")[0]);
        } else {
            setRenewStartDate(new Date().toISOString().split("T")[0]);
        }

        setShowRenewModal(true);
    };

    const handleRenewAmc = async () => {
        if (!renewAmc) return;

        const selectedProducts = renewProducts.filter(p => p._selected);
        if (selectedProducts.length === 0) {
            toast.error("Please select at least one product for renewal");
            return;
        }

        setIsRenewing(true);
        try {
            const token = localStorage.getItem('token');

            const productsPayload = selectedProducts.map(item => ({
                productId: item.productId,
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                discountPercent: Number(item.discountPercent) || 0,
                hsnCode: item.hsnCode || '',
                capacity: item.capacity || '',
                invoiceDescription: item.invoiceDescription || ''
            }));

            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/amc/renew-amc/${renewAmc.amcId}`,
                {
                    durationYears: renewDuration,
                    startDate: renewStartDate,
                    notes: renewNotes,
                    products: productsPayload
                },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            toast.success(response.data.message || "AMC renewed successfully!");
            setShowRenewModal(false);
            setRenewAmc(null);
            setRenewProducts([]);
            await fetchAmcs();

            const newAmc = response.data.data;
            if (newAmc) {
                // ✅ WhatsApp on renewal too
                await generatePDF(newAmc, true);
            }
        } catch (error) {
            console.error("Error renewing AMC:", error);
            toast.error(error.response?.data?.message || "Failed to renew AMC");
        } finally {
            setIsRenewing(false);
        }
    };

    // ============= EXPORT EXCEL =============
    const exportToExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/amc/export-amcs`,
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

                const exportData = data.map((amc) => ({
                    "AMC No": amc.amcNumber,
                    "Renewal Of": amc.renewalOf || '-',
                    "Customer": amc.customerName,
                    "Store": amc.storeType,
                    "Status": amc.status,
                    "Products": amc.products?.length || 0,
                    "Start Date": amc.startDate ? new Date(amc.startDate).toLocaleDateString() : "N/A",
                    "End Date": amc.endDate ? new Date(amc.endDate).toLocaleDateString() : "N/A",
                    "Duration (Yrs)": amc.durationYears,
                    "GST Mode": amc.isGstMode ? "GST" : "Non-GST",
                    "Payment Status": amc.paymentStatus || 'Paid',
                    "Payment Type": amc.paymentType || '-',
                    "Subtotal": amc.subtotal || 0,
                    "Discount": amc.totalDiscount || 0,
                    "Tax": amc.totalTax || 0,
                    "Grand Total": amc.grandTotal || 0,
                    "Service Visits": amc.serviceHistory?.length || 0
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "AMCs");
                XLSX.writeFile(workbook, `amcs_${new Date().toISOString().split("T")[0]}.xlsx`);
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
        if (!selectedAmc) return null;

        return (
            <div className="amc-modal-overlay" onClick={() => setShowViewModal(false)}>
                <div className="amc-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="amc-modal-header">
                        <h3 className="amc-modal-title">
                            <FaFileInvoice /> AMC Details - {selectedAmc.amcNumber}
                        </h3>
                        <button className="amc-modal-close" onClick={() => setShowViewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="amc-modal-body">
                        <div className="amc-view-grid">
                            <div className="amc-view-item">
                                <span className="amc-view-label">AMC No:</span>
                                <span className="amc-view-value">{selectedAmc.amcNumber}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Status:</span>
                                <span className={`amc-view-value amc-status-${selectedAmc.status?.toLowerCase()}`}>
                                    {selectedAmc.status}
                                </span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Customer:</span>
                                <span className="amc-view-value">{selectedAmc.customerName}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Store:</span>
                                <span className="amc-view-value">{selectedAmc.storeType}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Start Date:</span>
                                <span className="amc-view-value">{formatDate(selectedAmc.startDate)}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">End Date:</span>
                                <span className="amc-view-value">{formatDate(selectedAmc.endDate)}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Duration:</span>
                                <span className="amc-view-value">{selectedAmc.durationYears} Year(s)</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">GST Mode:</span>
                                <span className="amc-view-value">{selectedAmc.isGstMode ? "GST" : "Non-GST"}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Payment Status:</span>
                                <span className="amc-view-value">{selectedAmc.paymentStatus || 'Paid'}</span>
                            </div>
                            <div className="amc-view-item">
                                <span className="amc-view-label">Payment Type:</span>
                                <span className="amc-view-value">{selectedAmc.paymentType || '-'}</span>
                            </div>
                            {selectedAmc.linkedInvoiceNumber && (
                                <div className="amc-view-item">
                                    <span className="amc-view-label">Linked Invoice:</span>
                                    <span className="amc-view-value">{selectedAmc.linkedInvoiceNumber}</span>
                                </div>
                            )}
                            {selectedAmc.renewalOf && (
                                <div className="amc-view-item">
                                    <span className="amc-view-label">Renewal Of:</span>
                                    <span className="amc-view-value">
                                        {selectedAmc.renewalOfNumber || selectedAmc.renewalOf}
                                    </span>
                                </div>
                            )}

                            <div className="amc-view-item amc-view-item-full">
                                <span className="amc-view-label">Notes:</span>
                                <span className="amc-view-value">{selectedAmc.notes || 'No notes'}</span>
                            </div>
                        </div>

                        <h4 className="amc-view-subtitle">Products</h4>
                        <div className="amc-view-table-wrap">
                            <table className="amc-view-table">
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedAmc.products?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>{item.productName}</td>
                                            <td>{item.invoiceDescription || '-'}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.capacity || '-'}</td>
                                            <td>₹{item.unitPrice?.toFixed(2) || 0}</td>
                                            <td>₹{item.finalPrice?.toFixed(2) || 0}</td>
                                            <td>{item.hsnCode || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="amc-view-summary">
                            <div className="amc-view-total">
                                <span>Subtotal:</span>
                                <span>₹{selectedAmc.subtotal?.toFixed(2) || 0}</span>
                            </div>
                            <div className="amc-view-total">
                                <span>Discount:</span>
                                <span>₹{selectedAmc.totalDiscount?.toFixed(2) || 0}</span>
                            </div>
                            {selectedAmc.isGstMode && (
                                <div className="amc-view-total">
                                    <span>Tax ({selectedAmc.taxSlab}%):</span>
                                    <span>₹{selectedAmc.totalTax?.toFixed(2) || 0}</span>
                                </div>
                            )}
                            <div className="amc-view-total amc-view-grand">
                                <span>Grand Total:</span>
                                <span>₹{selectedAmc.grandTotal?.toFixed(2) || 0}</span>
                            </div>
                        </div>

                        <h4 className="amc-view-subtitle">
                            <FaHistory /> Service History ({selectedAmc.serviceHistory?.length || 0})
                        </h4>
                        {selectedAmc.serviceHistory?.length > 0 ? (
                            <div className="amc-view-table-wrap">
                                <table className="amc-view-table">
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
                                        {selectedAmc.serviceHistory.map((s, idx) => (
                                            <tr key={s.serviceId || idx}>
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
                            <p className="amc-view-empty">No service entries yet.</p>
                        )}
                    </div>

                    <div className="amc-modal-footer">
                        {selectedAmc.status === 'Active' && (
                            <button
                                className="amc-service-btn"
                                onClick={() => {
                                    setShowViewModal(false);
                                    openServiceModal(selectedAmc);
                                }}
                            >
                                <FaTools /> Add Service
                            </button>
                        )}
                        <button
                            className="amc-renew-btn"
                            onClick={() => {
                                setShowViewModal(false);
                                openRenewModal(selectedAmc);
                            }}
                        >
                            <FaSyncAlt /> Renew
                        </button>
                        <button
                            className="amc-pdf-btn"
                            onClick={() => generatePDF(selectedAmc, false)}
                            disabled={isGeneratingPDF}
                        >
                            <FaFilePdf /> {isGeneratingPDF ? "Generating..." : "PDF"}
                        </button>
                        <button className="amc-modal-close-btn" onClick={() => setShowViewModal(false)}>
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
            <div className="amc-form-container">
                <div className="amc-form-header">
                    <h2 className="amc-form-title">
                        <FaFileInvoice style={{ color: '#7366ff' }} />
                        {isEditMode ? "Edit AMC" : "Create New AMC"}
                    </h2>
                    <button className="amc-form-close" onClick={resetForm}>
                        <FaTimes />
                    </button>
                </div>

                {/* Link Mode Toggle (only for new) */}
                {!isEditMode && (
                    <div className="amc-toggle-section">
                        <div className="amc-toggle-row">
                            <div className="amc-toggle-container">
                                <span className="amc-toggle-label">
                                    <FaLink /> Source
                                </span>
                                <button
                                    className={`amc-toggle-btn ${linkMode === 'direct' ? 'active' : ''}`}
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
                                    className={`amc-toggle-btn ${linkMode === 'sale' ? 'active' : ''}`}
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

                            <div className="amc-toggle-container">
                                <span className="amc-toggle-label">GST Mode</span>
                                <button
                                    className={`amc-toggle-btn ${isGstMode ? 'active' : ''}`}
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

                {/* Sale Selection (only in sale mode + new) */}
                {!isEditMode && linkMode === 'sale' && (
                    <div className="amc-section">
                        <div className="amc-form-row">
                            <div className="amc-form-field amc-form-field-full">
                                <label className="amc-form-label">
                                    <FaFileInvoice /> Select Sale / Invoice
                                </label>
                                <Select
                                    options={sales.map(s => ({
                                        value: s.saleId,
                                        label: `${s.invoiceNumber} - ${s.customerName} (₹${s.grandTotal?.toFixed(2) || 0})`
                                    }))}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
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

                {/* Customer Selection + Start Date */}
                <div className="amc-section">
                    <div className="amc-form-row">
                        {!isEditMode && linkMode === 'direct' && (
                            <div className="amc-form-field" style={{ flex: 7 }}>
                                <label className="amc-form-label">
                                    <FaUser /> Select Customer
                                </label>
                                <Select
                                    options={customers.map(c => ({
                                        value: c.customerId,
                                        label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                                    }))}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
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

                        <div className="amc-form-field" style={{ flex: isEditMode ? 1 : 3 }}>
                            <label className="amc-form-label">
                                <FaCalendarAlt /> Start Date *
                            </label>
                            <input
                                type="date"
                                className="amc-input-field"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Customer Details */}
                    {(!isEditMode || (isEditMode && selectedCustomer)) && (
                        <div className="amc-customer-details">
                            <div className="amc-form-row">
                                <div className="amc-form-field">
                                    <label className="amc-form-label">
                                        <FaUser /> Customer Name {!selectedCustomer && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="amc-input-field"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "Enter customer name"}
                                    />
                                </div>
                                <div className="amc-form-field">
                                    <label className="amc-form-label">
                                        <FaEnvelope /> Email
                                    </label>
                                    <input
                                        type="email"
                                        className="amc-input-field"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "Enter email"}
                                    />
                                </div>
                            </div>

                            <div className="amc-form-row">
                                <div className="amc-form-field">
                                    <label className="amc-form-label">
                                        <FaPhone /> Phone Number {!selectedCustomer && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="amc-input-field"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "10 digits"}
                                        maxLength="10"
                                    />
                                </div>
                                <div className="amc-form-field">
                                    <label className="amc-form-label">
                                        <FaInfoCircle /> GSTIN {isGstMode && !isEditMode && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        className="amc-input-field"
                                        value={customerGstin}
                                        onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                                        readOnly={isCustomerFieldsReadOnly || isEditMode}
                                        placeholder={isCustomerFieldsReadOnly || isEditMode ? "" : "15 characters"}
                                        maxLength="15"
                                    />
                                </div>
                            </div>

                            <div className="amc-form-row">
                                <div className="amc-form-field amc-form-field-full">
                                    <label className="amc-form-label">
                                        <FaMapMarkerAlt /> Address
                                    </label>
                                    <input
                                        type="text"
                                        className="amc-input-field"
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

                {/* Product Selection (only for new + direct) */}
                {!isEditMode && linkMode === 'direct' && (
                    <div className="amc-section">
                        <div className="amc-product-row">
                            <div className="amc-product-select" style={{ flex: 1 }}>
                                <label className="amc-form-label">
                                    <FaBox /> Select Product
                                </label>
                                <Select
                                    options={products.map(p => ({
                                        value: p.productId,
                                        label: `${p.productName}`
                                    }))}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
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
                )}

                {/* In edit mode — allow adding product too */}
                {isEditMode && (
                    <div className="amc-section">
                        <div className="amc-product-row">
                            <div className="amc-product-select" style={{ flex: 1 }}>
                                <label className="amc-form-label">
                                    <FaPlusCircle /> Add Product (Edit Mode)
                                </label>
                                <Select
                                    options={products.map(p => ({
                                        value: p.productId,
                                        label: `${p.productName}`
                                    }))}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
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
                )}

                {/* Line Items Table */}
                {lineItems.length > 0 && (
                    <div className="amc-section">
                        <div className="amc-items-table-wrap">
                            <table className="amc-items-table">
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
                                            <td className="amc-item-name">{item.productName}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input amc-invoice-desc-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Desc"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input amc-capacity-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input amc-hsn-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="amc-item-input"
                                                    value={item.quantity}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="amc-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                                />
                                            </td>
                                            <td className="amc-item-final">
                                                ₹{item.finalPrice.toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="amc-item-remove"
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

                {/* Store, Tax, Payment + Duration */}
                <div className="amc-section">
                    <div className="amc-form-row">
                        <div className="amc-form-field">
                            <label className="amc-form-label">
                                <FaStore /> Store *
                            </label>
                            <Select
                                options={STORE_OPTIONS}
                                styles={selectStyles}
                                className="amc-react-select"
                                classNamePrefix="amc-select"
                                placeholder="Select Store"
                                value={STORE_OPTIONS.find(opt => opt.value === storeType)}
                                onChange={(option) => setStoreType(option?.value || "Vadodara")}
                                isDisabled={isEditMode}
                            />
                        </div>

                        <div className="amc-form-field">
                            <label className="amc-form-label">
                                <FaCalendarAlt /> Duration *
                            </label>
                            <Select
                                options={DURATION_OPTIONS}
                                styles={selectStyles}
                                className="amc-react-select"
                                classNamePrefix="amc-select"
                                placeholder="Select Duration"
                                value={DURATION_OPTIONS.find(opt => opt.value === durationYears)}
                                onChange={(option) => setDurationYears(option?.value || 1)}
                            />
                            <div className="amc-field-hint">End Date: {previewEndDate}</div>
                        </div>

                        {isGstMode && (
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaInfoCircle /> Tax Slab *
                                </label>
                                <Select
                                    options={TAX_OPTIONS}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
                                    placeholder="Select Tax"
                                    value={TAX_OPTIONS.find(opt => opt.value === taxSlab)}
                                    onChange={(option) => setTaxSlab(option?.value || 18)}
                                    isDisabled={isEditMode}
                                />
                            </div>
                        )}
                    </div>

                    <div className="amc-form-row">
                        <div className="amc-form-field">
                            <label className="amc-form-label">
                                <FaMoneyBillWave /> Payment Status *
                            </label>
                            <Select
                                options={PAYMENT_STATUS_OPTIONS}
                                styles={selectStyles}
                                className="amc-react-select"
                                classNamePrefix="amc-select"
                                placeholder="Select Status"
                                value={PAYMENT_STATUS_OPTIONS.find(opt => opt.value === paymentStatus)}
                                onChange={(option) => setPaymentStatus(option?.value || "Paid")}
                            />
                        </div>

                        {paymentStatus === 'Paid' && (
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaRupeeSign /> Payment Type *
                                </label>
                                <Select
                                    options={PAYMENT_OPTIONS}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
                                    placeholder="Select Payment"
                                    value={PAYMENT_OPTIONS.find(opt => opt.value === paymentType)}
                                    onChange={(option) => setPaymentType(option?.value || "Cash")}
                                />
                            </div>
                        )}
                    </div>

                    <div className="amc-form-row">
                        <div className="amc-form-field amc-form-field-full">
                            <label className="amc-form-label">
                                <FaInfoCircle /> Notes (Optional)
                            </label>
                            <textarea
                                className="amc-textarea-field"
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
                    <div className="amc-summary-column">
                        <div className="amc-summary-title">Summary</div>
                        <div className="amc-summary-items">
                            <div className="amc-summary-row">
                                <span>Subtotal</span>
                                <span>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="amc-summary-row amc-summary-discount">
                                <span>Discount</span>
                                <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="amc-summary-row">
                                <span>Taxable Amount</span>
                                <span>₹{totals.taxableAmount.toFixed(2)}</span>
                            </div>
                            {isGstMode && (
                                <div className="amc-summary-row">
                                    <span>Tax ({taxSlab}%)</span>
                                    <span>₹{totals.totalTax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="amc-summary-row amc-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            className="amc-submit-btn"
                            onClick={handleSubmit}
                            disabled={isSubmitting || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update AMC" : "Create AMC"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= RENDER SERVICE MODAL =============
    const renderServiceModal = () => {
        if (!showServiceModal || !serviceAmc) return null;

        const productOptions = serviceAmc.products.map(p => ({
            value: p.productId,
            label: `${p.productName} (Qty: ${p.quantity})`
        }));

        return (
            <div className="amc-modal-overlay" onClick={() => !isAddingService && setShowServiceModal(false)}>
                <div className="amc-modal-content amc-modal-small" onClick={(e) => e.stopPropagation()}>
                    <div className="amc-modal-header">
                        <h3 className="amc-modal-title">
                            <FaTools /> Add Service Entry — {serviceAmc.amcNumber}
                        </h3>
                        <button className="amc-modal-close" onClick={() => setShowServiceModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="amc-modal-body">
                        <div className="amc-form-row">
                            <div className="amc-form-field amc-form-field-full">
                                <label className="amc-form-label">
                                    <FaBox /> Product *
                                </label>
                                <Select
                                    options={productOptions}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
                                    placeholder="Select product from AMC..."
                                    value={productOptions.find(opt => opt.value === serviceProductId)}
                                    onChange={(option) => setServiceProductId(option?.value || "")}
                                    isSearchable
                                />
                            </div>
                        </div>

                        <div className="amc-form-row">
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaCalendarAlt /> Service Date *
                                </label>
                                <input
                                    type="date"
                                    className="amc-input-field"
                                    value={serviceDate}
                                    onChange={(e) => setServiceDate(e.target.value)}
                                />
                            </div>
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaHashtag /> Quantity *
                                </label>
                                <input
                                    type="number"
                                    className="amc-input-field"
                                    value={serviceQty}
                                    min="1"
                                    step="1"
                                    onChange={(e) => setServiceQty(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="amc-form-row">
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaStore /> Store *
                                </label>
                                <Select
                                    options={STORE_OPTIONS}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
                                    value={STORE_OPTIONS.find(opt => opt.value === serviceStore)}
                                    onChange={(option) => setServiceStore(option?.value || "Vadodara")}
                                />
                            </div>
                        </div>

                        <div className="amc-form-row">
                            <div className="amc-form-field amc-form-field-full">
                                <label className="amc-form-label">
                                    <FaInfoCircle /> Notes
                                </label>
                                <textarea
                                    className="amc-textarea-field"
                                    rows="2"
                                    placeholder="What service was done..."
                                    value={serviceNotes}
                                    onChange={(e) => setServiceNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="amc-modal-footer">
                        <button
                            className="amc-modal-close-btn"
                            onClick={() => setShowServiceModal(false)}
                            disabled={isAddingService}
                        >
                            Cancel
                        </button>
                        <button
                            className="amc-submit-btn"
                            onClick={handleAddService}
                            disabled={isAddingService}
                        >
                            {isAddingService ? "Adding..." : "Add Service"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER RENEW MODAL =============
    const renderRenewModal = () => {
        if (!showRenewModal || !renewAmc) return null;

        const isActive = renewAmc.status === 'Active';
        const selectedCount = renewProducts.filter(p => p._selected).length;

        return (
            <div className="amc-modal-overlay" onClick={() => !isRenewing && setShowRenewModal(false)}>
                <div className="amc-modal-content amc-modal-large" onClick={(e) => e.stopPropagation()}>
                    <div className="amc-modal-header">
                        <h3 className="amc-modal-title">
                            <FaSyncAlt /> Renew AMC — {renewAmc.amcNumber}
                        </h3>
                        <button className="amc-modal-close" onClick={() => setShowRenewModal(false)}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="amc-modal-body">
                        {/* Info */}
                        <div className="amc-renew-info">
                            <div className="amc-renew-info-row">
                                <span>Customer:</span>
                                <strong>{renewAmc.customerName}</strong>
                            </div>
                            <div className="amc-renew-info-row">
                                <span>Current Status:</span>
                                <strong className={`amc-status-${renewAmc.status?.toLowerCase()}`}>
                                    {renewAmc.status}
                                </strong>
                            </div>
                            <div className="amc-renew-info-row">
                                <span>Current End:</span>
                                <strong>{formatDate(renewAmc.endDate)}</strong>
                            </div>
                            <div className="amc-renew-info-row amc-renew-note">
                                <FaInfoCircle />
                                <span>
                                    {isActive
                                        ? "New AMC will be Pending and auto-activate when current ends"
                                        : "New AMC will become Active immediately"}
                                </span>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="amc-form-row">
                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaCalendarAlt /> New Start Date *
                                </label>
                                <input
                                    type="date"
                                    className="amc-input-field"
                                    value={renewStartDate}
                                    onChange={(e) => setRenewStartDate(e.target.value)}
                                />
                            </div>

                            <div className="amc-form-field">
                                <label className="amc-form-label">
                                    <FaCalendarAlt /> Duration *
                                </label>
                                <Select
                                    options={DURATION_OPTIONS}
                                    styles={selectStyles}
                                    className="amc-react-select"
                                    classNamePrefix="amc-select"
                                    value={DURATION_OPTIONS.find(opt => opt.value === renewDuration)}
                                    onChange={(option) => setRenewDuration(option?.value || 1)}
                                />
                            </div>
                        </div>

                        {/* Products Section */}
                        <h4 className="amc-view-subtitle">
                            <FaBox /> Products for Renewal ({selectedCount} selected)
                        </h4>

                        <div className="amc-renew-products-wrap">
                            <table className="amc-renew-products-table">
                                <thead>
                                    <tr>
                                        <th>Use</th>
                                        <th>Product</th>
                                        <th>Product Desc</th>
                                        <th>Capacity</th>
                                        <th>HSN</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renewProducts.map((item, idx) => (
                                        <tr key={idx} className={item._selected ? '' : 'amc-renew-row-disabled'}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={!!item._selected}
                                                    onChange={() => toggleRenewProduct(idx)}
                                                    className="amc-renew-checkbox"
                                                />
                                            </td>
                                            <td className="amc-renew-product-name">
                                                {item.productName}
                                                {item._isNew && (
                                                    <span className="amc-renew-new-tag">NEW</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => updateRenewProduct(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Desc"
                                                    disabled={!item._selected}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => updateRenewProduct(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                    disabled={!item._selected}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="amc-item-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => updateRenewProduct(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                    disabled={!item._selected}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="amc-item-input"
                                                    value={item.quantity}
                                                    min="0.01"
                                                    step="0.01"
                                                    onChange={(e) => updateRenewProduct(idx, 'quantity', e.target.value)}
                                                    disabled={!item._selected}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="amc-item-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => updateRenewProduct(idx, 'unitPrice', e.target.value)}
                                                    disabled={!item._selected}
                                                />
                                            </td>
                                            <td className="amc-item-final">
                                                ₹{(item.finalPrice || 0).toFixed(2)}
                                            </td>
                                            <td>
                                                <button
                                                    className="amc-item-remove"
                                                    onClick={() => removeRenewProduct(idx)}
                                                    title="Remove"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Add new product */}
                        <div className="amc-renew-add-product">
                            <label className="amc-form-label">
                                <FaPlusCircle /> Add Product to Renewal
                            </label>
                            <Select
                                options={products.map(p => ({
                                    value: p.productId,
                                    label: `${p.productName}`
                                }))}
                                styles={selectStyles}
                                className="amc-react-select"
                                classNamePrefix="amc-select"
                                placeholder="Search and add product..."
                                isSearchable
                                isClearable
                                value={null}
                                onChange={addNewProductToRenew}
                            />
                        </div>

                        {/* Notes */}
                        <div className="amc-form-row">
                            <div className="amc-form-field amc-form-field-full">
                                <label className="amc-form-label">
                                    <FaInfoCircle /> Notes
                                </label>
                                <textarea
                                    className="amc-textarea-field"
                                    rows="2"
                                    placeholder="Renewal notes..."
                                    value={renewNotes}
                                    onChange={(e) => setRenewNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="amc-renew-summary">
                            <div className="amc-summary-row">
                                <span>Subtotal</span>
                                <span>₹{renewProductsCalc.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="amc-summary-row amc-summary-discount">
                                <span>Discount</span>
                                <span>-₹{renewProductsCalc.totalDiscount.toFixed(2)}</span>
                            </div>
                            {renewAmc.isGstMode && (
                                <div className="amc-summary-row">
                                    <span>Tax ({renewAmc.taxSlab}%)</span>
                                    <span>₹{renewProductsCalc.totalTax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="amc-summary-row amc-summary-grand">
                                <span>Grand Total</span>
                                <span>₹{renewProductsCalc.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="amc-modal-footer">
                        <button
                            className="amc-modal-close-btn"
                            onClick={() => setShowRenewModal(false)}
                            disabled={isRenewing}
                        >
                            Cancel
                        </button>
                        <button
                            className="amc-submit-btn"
                            onClick={handleRenewAmc}
                            disabled={isRenewing || selectedCount === 0}
                        >
                            {isRenewing ? "Renewing..." : "Confirm Renewal"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= RENDER DELETE MODAL =============
    const renderDeleteModal = () => {
        if (!showDeleteModal || !amcToDelete) return null;

        return (
            <div className="amc-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                <div className="amc-delete-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="amc-delete-modal-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h3 className="amc-delete-modal-title">Confirm Delete</h3>

                    <p className="amc-delete-modal-text">
                        Are you sure you want to delete this AMC? This action cannot be undone.
                    </p>

                    <div className="amc-delete-modal-info">
                        <div className="amc-delete-modal-row">
                            <span className="amc-delete-modal-label">AMC No:</span>
                            <span className="amc-delete-modal-value">{amcToDelete.amcNumber}</span>
                        </div>
                        <div className="amc-delete-modal-row">
                            <span className="amc-delete-modal-label">Customer:</span>
                            <span className="amc-delete-modal-value">{amcToDelete.customerName}</span>
                        </div>
                        <div className="amc-delete-modal-row">
                            <span className="amc-delete-modal-label">Amount:</span>
                            <span className="amc-delete-modal-value">₹{amcToDelete.grandTotal?.toFixed(2) || 0}</span>
                        </div>
                    </div>

                    <div className="amc-delete-modal-buttons">
                        <button
                            className="amc-delete-modal-cancel"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="amc-delete-modal-confirm"
                            onClick={confirmDeleteAmc}
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
            <div className="amc-pdf-progress-overlay">
                <div className="amc-pdf-progress-modal">
                    <div className="amc-pdf-progress-icon">
                        <FaFileArchive />
                    </div>

                    <h3 className="amc-pdf-progress-title">Exporting AMCs</h3>

                    <p className="amc-pdf-progress-status">{pdfProgress.status}</p>

                    {pdfProgress.total > 0 && (
                        <>
                            <div className="amc-pdf-progress-bar-container">
                                <div
                                    className="amc-pdf-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="amc-pdf-progress-percentage">{percentage}%</div>
                        </>
                    )}

                    <div className="amc-pdf-progress-spinner"></div>

                    <p className="amc-pdf-progress-hint">
                        Please don't close this window while PDFs are being generated
                    </p>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="amc-table-container">
            <div className="amc-table-header">
                <div className="amc-search-filter-group">
                    <div className="amc-search-container">
                        <FaSearch className="amc-search-icon" />
                        <input
                            type="text"
                            className="amc-search-input"
                            placeholder="Search by AMC No, Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="amc-filter-container">
                        <FaFilter className="amc-filter-icon" />
                        <Select
                            options={FILTER_OPTIONS}
                            styles={selectStyles}
                            className="amc-filter-select"
                            classNamePrefix="amc-filter"
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

                <div className="amc-action-buttons">
                    <button
                        className="amc-create-btn"
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
                        className="amc-pdf-export-btn"
                        onClick={exportPDFsAsZip}
                        disabled={isExportingPDF || isLoading || amcs.length === 0}
                        title="Export all filtered AMCs as PDF (ZIP)"
                    >
                        {isExportingPDF ? (
                            <span className="amc-loading-spinner-small"></span>
                        ) : (
                            <FaFilePdf />
                        )}
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
                    </button>
                    <button
                        className="amc-export-btn"
                        onClick={exportToExcel}
                        disabled={isExporting || isLoading}
                    >
                        {isExporting ? (
                            <span className="amc-loading-spinner-small"></span>
                        ) : (
                            <FaFileExcel />
                        )}
                        {isExporting ? "Exporting..." : "Export Excel"}
                    </button>
                </div>
            </div>

            {showForm && renderForm()}

            {isLoading ? (
                <div className="amc-loading-container">
                    <div className="amc-loading-spinner"></div>
                    <p>Loading AMCs...</p>
                </div>
            ) : amcs.length === 0 ? (
                <div className="amc-empty-state">
                    <FaFileInvoice size={50} color="#ccc" />
                    <p>No AMCs found</p>
                </div>
            ) : (
                <>
                    <div className="amc-table-responsive">
                        <table className="amc-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>AMC No</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Products</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {amcs.map((amc, idx) => {
                                    const serialNo = (pagination.page - 1) * pagination.limit + idx + 1;
                                    return (
                                        <tr key={amc.amcId} className="amc-table-row">
                                            <td>{serialNo}</td>
                                            <td className="amc-number">
                                                <strong>{amc.amcNumber}</strong>
                                                {amc.renewalOf && (
                                                    <span className="amc-renewal-badge" title="Renewal AMC">
                                                        <FaSyncAlt />
                                                    </span>
                                                )}
                                            </td>
                                            <td>{amc.customerName}</td>
                                            <td>{amc.storeType}</td>
                                            <td>{amc.products?.length || 0}</td>
                                            <td>{amc.startDate ? new Date(amc.startDate).toLocaleDateString() : "N/A"}</td>
                                            <td>{amc.endDate ? new Date(amc.endDate).toLocaleDateString() : "N/A"}</td>
                                            <td>{amc.durationYears} Yr</td>
                                            <td>
                                                <span className={`amc-status-badge amc-status-${amc.status?.toLowerCase()}`}>
                                                    {amc.status}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="amc-total-badge">
                                                    ₹{amc.grandTotal?.toFixed(2) || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="amc-action-btns">
                                                    <button
                                                        className="amc-view-btn"
                                                        onClick={() => {
                                                            setSelectedAmc(amc);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    {(amc.status === 'Active' || amc.status === 'Pending') && (
                                                        <button
                                                            className="amc-edit-btn"
                                                            onClick={() => handleEditAmc(amc)}
                                                            title="Edit"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                    )}
                                                    {amc.status === 'Active' && (
                                                        <button
                                                            className="amc-service-icon-btn"
                                                            onClick={() => openServiceModal(amc)}
                                                            title="Add Service"
                                                        >
                                                            <FaTools />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="amc-renew-icon-btn"
                                                        onClick={() => openRenewModal(amc)}
                                                        title="Renew AMC"
                                                    >
                                                        <FaSyncAlt />
                                                    </button>
                                                    <button
                                                        className="amc-delete-btn"
                                                        onClick={() => openDeleteModal(amc)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                    <button
                                                        className="amc-pdf-row-btn"
                                                        onClick={() => generatePDF(amc, false)}
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
                        <div className="amc-pagination">
                            <div className="amc-pagination-info">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} entries
                            </div>
                            <div className="amc-pagination-buttons">
                                <button
                                    className="amc-page-btn"
                                    onClick={prevPage}
                                    disabled={!pagination.hasPrev || isLoading}
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="amc-page-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="amc-page-btn"
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
            <div className="amc-module-wrapper">
                {/* <div className="amc-page-header">
                    <h2 className="amc-page-title">AMC Management</h2>
                </div> */}

                <div className="amc-content-wrapper">
                    {renderTable()}
                </div>

                {showViewModal && renderViewModal()}
                {renderServiceModal()}
                {renderRenewModal()}
                {renderDeleteModal()}
                {renderPDFProgress()}

                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {amcForPrint && <AMCPrint amc={amcForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default AMC;