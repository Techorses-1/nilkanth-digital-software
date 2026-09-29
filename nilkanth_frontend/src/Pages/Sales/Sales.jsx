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
    FaHashtag,
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaFileAlt,
    FaFilter,
    FaFileArchive,
    FaExclamationTriangle
} from "react-icons/fa";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import SalesPrint from "./SalesPrint";
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

// Payment Status Options
const PAYMENT_STATUS_OPTIONS = [
    { value: "Paid", label: "Paid" },
    { value: "Pending", label: "Pending" }
];

// ✅ Filter Options
const FILTER_OPTIONS = [
    { value: "All", label: "All Invoices" },
    { value: "Challan", label: "Challan Only" },
    { value: "GST", label: "GST Only" },
    { value: "Non-GST", label: "Non-GST Only" }
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
    // ✅ Filter State
    const [filterType, setFilterType] = useState("GST");

    // ✅ Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ✅ PDF Bulk Export State
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, status: '' });

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
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [isGstMode, setIsGstMode] = useState(true);
    const [isChallan, setIsChallan] = useState(false);

    // ============= CUSTOMER FORM FIELDS =============
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerGstin, setCustomerGstin] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [isCustomerFieldsReadOnly, setIsCustomerFieldsReadOnly] = useState(false);

    // ============= MODAL STATES =============
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);

    // ============= PDF/PRINT STATE =============
    const [saleForPrint, setSaleForPrint] = useState(null);

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
            fetchSales();
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
                        search: debouncedSearch,
                        filterType: filterType
                    }
                }
            );

            if (response.data.success) {
                setSales(response.data.data || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 20,
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
            finalPrice: 0,
            uniqueNumbers: [{ number: '', isUsed: false }]
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

        const quantity = updated[index].quantity;
        const currentUniqueCount = updated[index].uniqueNumbers?.length || 0;

        if (currentUniqueCount < quantity) {
            const difference = quantity - currentUniqueCount;
            for (let i = 0; i < difference; i++) {
                updated[index].uniqueNumbers.push({ number: '', isUsed: false });
            }
        } else if (currentUniqueCount > quantity) {
            updated[index].uniqueNumbers = updated[index].uniqueNumbers.slice(0, quantity);
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

        if (isChallan || !isGstMode) {
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
                    mode: ['css', 'legacy'],
                    avoid: ['.avoid-break', '.stamping-footer', '.declaration-terms-section', '.totals-row']
                }
            };

            await html2pdf()
                .set(opt)
                .from(element)
                .toPdf()
                .get('pdf')
                .then((pdf) => {
                    const totalPages = pdf.internal.getNumberOfPages();
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const websiteUrl = "https://www.techorses.com";
                    const label = "Developed by ";
                    const linkText = "Techorses";

                    // ✅ COMMENTED OUT - "Developed by Techorses" footer
                    // for (let i = 1; i <= totalPages; i++) {
                    //     pdf.setPage(i);
                    //     pdf.setFontSize(8);
                    //     const labelWidth = pdf.getTextWidth(label);
                    //     const linkWidth = pdf.getTextWidth(linkText);
                    //     const totalWidth = labelWidth + linkWidth;
                    //     const rightEdge = pageWidth - 15;
                    //     const startX = rightEdge - totalWidth;
                    //     const y = pageHeight - 10;
                    //     pdf.setTextColor(150);
                    //     pdf.text(label, startX, y);
                    //     pdf.setTextColor(0, 0, 255);
                    //     pdf.textWithLink(linkText, startX + labelWidth, y, { url: websiteUrl });
                    // }
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

    // ============= ✅ BULK PDF EXPORT (ZIP) =============
    const exportPDFsAsZip = async () => {
        if (isExportingPDF) return;

        setIsExportingPDF(true);
        setPdfProgress({ current: 0, total: 0, status: 'Fetching invoices...' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login first");
                setIsExportingPDF(false);
                return;
            }

            // ✅ Fetch all filtered invoices (no pagination)
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/sales/get-all-filtered`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: {
                        search: debouncedSearch || '',
                        filterType: filterType
                    }
                }
            );

            if (!response.data.success || !response.data.data || response.data.data.length === 0) {
                toast.warning("No invoices found to export");
                setIsExportingPDF(false);
                setPdfProgress({ current: 0, total: 0, status: '' });
                return;
            }

            const allSales = response.data.data;
            const total = allSales.length;

            setPdfProgress({ current: 0, total, status: `Preparing ${total} invoices...` });

            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            // ✅ Loop through each invoice
            for (let i = 0; i < allSales.length; i++) {
                const sale = allSales[i];

                setPdfProgress({
                    current: i + 1,
                    total,
                    status: `Generating PDF ${i + 1} of ${total}...`
                });

                try {
                    // Set the sale to be rendered
                    setSaleForPrint(sale);
                    await new Promise(resolve => setTimeout(resolve, 700));

                    const element = document.getElementById("sales-pdf");
                    if (!element) {
                        console.error(`PDF element not found for ${sale.invoiceNumber}`);
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

                    // ✅ Generate PDF as blob
                    const pdfBlob = await html2pdf()
                        .set(opt)
                        .from(element)
                        .outputPdf('blob');

                    // ✅ Add to ZIP
                    const fileName = `${sale.invoiceNumber}_${(sale.customerName || "customer").replace(/\s+/g, "_")}.pdf`;
                    zip.file(fileName, pdfBlob);

                    successCount++;

                    // Small delay to let browser breathe
                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (err) {
                    console.error(`Error generating PDF for ${sale.invoiceNumber}:`, err);
                    failCount++;
                }
            }

            setSaleForPrint(null);

            // ✅ Generate ZIP
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

            // ✅ Download ZIP
            const zipFileName = filterType === 'Challan'
                ? `challans_${new Date().toISOString().split("T")[0]}.zip`
                : `invoices_${new Date().toISOString().split("T")[0]}.zip`;

            saveAs(zipBlob, zipFileName);

            setPdfProgress({
                current: total,
                total,
                status: `✅ Done! ${successCount} PDFs exported${failCount > 0 ? `, ${failCount} failed` : ''}`
            });

            toast.success(`ZIP created! ${successCount} PDFs exported${failCount > 0 ? `, ${failCount} failed` : ''}`);

            // Hide loader after 2 seconds
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
            if (isGstMode && !isChallan && !selectedCustomer.gstNumber) {
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

        if (isGstMode && !isChallan) {
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
                isGstMode: isChallan ? false : isGstMode,
                isChallan: isChallan,
                saleDate: saleDate,
                items: lineItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    uniqueNumbers: item.uniqueNumbers || [],
                    hsnCode: item.hsnCode || '',
                    unitName: item.unitName || '',
                    capacity: item.capacity || '',
                    invoiceDescription: item.invoiceDescription || ''
                })),
                taxSlab: (isChallan || !isGstMode) ? 0 : taxSlab,
                notes: notes
            };

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
        setPaymentStatus("Paid");
        setIsGstMode(true);
        setIsChallan(false);
        setSaleDate(new Date().toISOString().split("T")[0]);
        setIsEditMode(false);
        setEditSaleId(null);
        setShowForm(false);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerGstin("");
        setCustomerAddress("");
        setIsCustomerFieldsReadOnly(false);
    };

    // ============= EDIT SALE =============
    const handleEditSale = (sale) => {
        setIsEditMode(true);
        setEditSaleId(sale.saleId);
        setShowForm(true);

        const customer = customers.find(c => c.customerId === sale.customerId);
        setSelectedCustomer(customer || null);

        if (customer) {
            setCustomerName(customer.customerName || '');
            setCustomerEmail(customer.email || '');
            setCustomerPhone(customer.contactNumber || '');
            setCustomerGstin(customer.gstNumber || '');
            setCustomerAddress(customer.address || '');
            setIsCustomerFieldsReadOnly(true);
        }

        setStoreType(sale.storeType || "Vadodara");
        setTaxSlab(sale.taxSlab || 18);
        setPaymentType(sale.paymentType || "Cash");
        setPaymentStatus(sale.paymentStatus || "Paid");
        setIsGstMode(sale.isGstMode !== undefined ? sale.isGstMode : true);
        setIsChallan(sale.isChallan || false);
        setNotes(sale.notes || "");
        setSaleDate(sale.saleDate ? new Date(sale.saleDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

        const items = sale.items.map(item => ({
            ...item,
            uniqueNumbers: item.uniqueNumbers || [],
            capacity: item.capacity || '',
            invoiceDescription: item.invoiceDescription || ''
        }));
        setLineItems(items);
    };

    // ============= ✅ OPEN DELETE MODAL =============
    const openDeleteModal = (sale) => {
        setSaleToDelete(sale);
        setShowDeleteModal(true);
    };

    // ============= ✅ CONFIRM DELETE =============
    const confirmDeleteSale = async () => {
        if (!saleToDelete) return;

        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_API_URL}/sales/delete-sale/${saleToDelete.saleId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast.success("Sale deleted successfully!");
            setShowDeleteModal(false);
            setSaleToDelete(null);
            await fetchSales();
        } catch (error) {
            console.error("Error deleting sale:", error);
            toast.error(error.response?.data?.message || "Failed to delete sale");
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
                `${import.meta.env.VITE_API_URL}/sales/export-sales`,
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

                const exportData = data.map((sale) => ({
                    "Invoice No": sale.invoiceNumber,
                    "Internal No": sale.internalInvoiceNumber,
                    "Challan": sale.isChallan ? "Yes" : "No",
                    "Customer": sale.customerName,
                    "Store": sale.storeType,
                    "Payment Status": sale.paymentStatus || 'Paid',
                    "Payment Type": sale.paymentType || '-',
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
                    <FaHashtag style={{ color: '#7366ff' }} /> Unique Numbers for Products (Optional)
                </h3>
                <div className="sales-unique-grid">
                    {lineItems.map((item, productIndex) => {
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

    // ============= RENDER VIEW MODAL =============
    const renderViewModal = () => {
        if (!selectedSale) return null;

        const getTaxDisplay = () => {
            if (!selectedSale.isGstMode || selectedSale.isChallan) {
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
                                <span className="sales-view-label">Challan:</span>
                                <span className="sales-view-value">{selectedSale.isChallan ? "Yes" : "No"}</span>
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
                                <span className="sales-view-label">Payment Status:</span>
                                <span className="sales-view-value">{selectedSale.paymentStatus || 'Paid'}</span>
                            </div>
                            <div className="sales-view-item">
                                <span className="sales-view-label">Payment Type:</span>
                                <span className="sales-view-value">{selectedSale.paymentType || '-'}</span>
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
                                        <th>Product Desc</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Capacity</th>
                                        <th>Price</th>
                                        <th>Final</th>
                                        <th>HSN Code</th>
                                        <th>Unique Numbers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSale.items?.map((item, idx) => (
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
                            {selectedSale.isGstMode && !selectedSale.isChallan && getTaxDisplay()}
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
        const isGstDisabled = isChallan;

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

                {/* Challan Toggle + GST Toggle */}
                <div className="sales-toggle-section">
                    <div className="sales-toggle-row">
                        <div className="sales-toggle-container">
                            <span className="sales-toggle-label">
                                <FaFileAlt /> Challan
                            </span>
                            <button
                                className={`sales-toggle-btn sales-challan-toggle ${isChallan ? 'active' : ''}`}
                                onClick={() => {
                                    const newChallan = !isChallan;
                                    setIsChallan(newChallan);
                                    if (newChallan) {
                                        setIsGstMode(false);
                                        setTaxSlab(0);
                                    }
                                }}
                                type="button"
                            >
                                {isChallan ? <FaToggleOn /> : <FaToggleOff />}
                                <span>{isChallan ? "Challan ON" : "Challan OFF"}</span>
                            </button>
                        </div>

                        <div className="sales-toggle-container">
                            <span className="sales-toggle-label">GST Mode</span>
                            <button
                                className={`sales-toggle-btn ${isGstMode && !isChallan ? 'active' : ''} ${isGstDisabled ? 'sales-toggle-disabled' : ''}`}
                                onClick={() => {
                                    if (isGstDisabled) return;
                                    const newGst = !isGstMode;
                                    setIsGstMode(newGst);
                                    if (!newGst) {
                                        setTaxSlab(0);
                                    } else {
                                        setTaxSlab(18);
                                    }
                                }}
                                type="button"
                                disabled={isGstDisabled}
                            >
                                {isGstMode && !isChallan ? <FaToggleOn /> : <FaToggleOff />}
                                <span>{isGstMode && !isChallan ? "GST" : "Non-GST"}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Customer Selection + Date */}
                <div className="sales-section">
                    <div className="sales-form-row">
                        <div className="sales-form-field" style={{ flex: 7 }}>
                            <label className="sales-form-label">
                                <FaUser /> Select Customer
                            </label>
                            <div className="sales-customer-row-inline">
                                <div className="sales-customer-select" style={{ flex: 1 }}>
                                    <Select
                                        options={customers.map(c => ({
                                            value: c.customerId,
                                            label: `${c.customerName} ${c.contactNumber ? `(${c.contactNumber})` : ''}${c.gstNumber ? ` - GST: ${c.gstNumber}` : ''}`
                                        }))}
                                        styles={selectStyles}
                                        className="sales-react-select"
                                        classNamePrefix="sales-select"
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

                    {/* Customer Details Fields */}
                    <div className="sales-customer-details">
                        <div className="sales-form-row">
                            <div className="sales-form-field">
                                <label className="sales-form-label">
                                    <FaUser /> Customer Name {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="sales-input-field"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter customer name"}
                                />
                            </div>
                            <div className="sales-form-field">
                                <label className="sales-form-label">
                                    <FaEnvelope /> Email
                                </label>
                                <input
                                    type="email"
                                    className="sales-input-field"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter email"}
                                />
                            </div>
                        </div>

                        <div className="sales-form-row">
                            <div className="sales-form-field">
                                <label className="sales-form-label">
                                    <FaPhone /> Phone Number {!selectedCustomer && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="sales-input-field"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "10 digits"}
                                    maxLength="10"
                                />
                            </div>
                            <div className="sales-form-field">
                                <label className="sales-form-label">
                                    <FaInfoCircle /> GSTIN {(isGstMode && !isChallan) && '*'}
                                </label>
                                <input
                                    type="text"
                                    className="sales-input-field"
                                    value={customerGstin}
                                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "15 characters"}
                                    maxLength="15"
                                />
                                {isGstMode && !isChallan && !selectedCustomer && (
                                    <div className="sales-field-hint">Required in GST Mode</div>
                                )}
                                {isGstMode && !isChallan && selectedCustomer && !selectedCustomer.gstNumber && (
                                    <div className="sales-field-hint sales-field-hint-warning">
                                        ⚠️ Customer has no GSTIN
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sales-form-row">
                            <div className="sales-form-field sales-form-field-full">
                                <label className="sales-form-label">
                                    <FaMapMarkerAlt /> Address
                                </label>
                                <input
                                    type="text"
                                    className="sales-input-field"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    readOnly={isCustomerFieldsReadOnly}
                                    placeholder={isCustomerFieldsReadOnly ? "" : "Enter address"}
                                />
                            </div>
                        </div>

                        {selectedCustomer && (
                            <div className="sales-customer-selected-badge">
                                <span>✅ Customer selected: {selectedCustomer.customerName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Selection */}
                <div className="sales-section">
                    <div className="sales-product-row">
                        <div className="sales-product-select" style={{ flex: 1 }}>
                            <label className="sales-form-label">
                                <FaBox /> Select Product
                            </label>
                            <Select
                                options={products.map(p => ({
                                    value: p.productId,
                                    label: `${p.productName}`
                                }))}
                                styles={selectStyles}
                                className="sales-react-select"
                                classNamePrefix="sales-select"
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
                    <div className="sales-section">
                        <div className="sales-items-table-wrap">
                            <table className="sales-items-table">
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
                                            <td className="sales-item-name">{item.productName}</td>
                                            <td>
                                                <textarea
                                                    className="sales-item-input sales-invoice-desc-input"
                                                    value={item.invoiceDescription || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'invoiceDescription', e.target.value)}
                                                    placeholder="Description..."
                                                    rows={2}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="sales-item-input sales-unit-input"
                                                    value={item.unitName || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'unitName', e.target.value)}
                                                    placeholder="Unit"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="sales-item-input sales-capacity-input"
                                                    value={item.capacity || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'capacity', e.target.value)}
                                                    placeholder="Capacity"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="sales-item-input sales-hsn-input"
                                                    value={item.hsnCode || ''}
                                                    onChange={(e) => handleUpdateLineItemText(idx, 'hsnCode', e.target.value)}
                                                    placeholder="HSN"
                                                />
                                            </td>
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
                                                    className="sales-price-input"
                                                    value={item.unitPrice}
                                                    min="0"
                                                    step="1"
                                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
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

                {/* Unique Numbers Section */}
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

                        {isGstMode && !isChallan && (
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
                                <FaMoneyBillWave /> Payment Status *
                            </label>
                            <Select
                                options={PAYMENT_STATUS_OPTIONS}
                                styles={selectStyles}
                                className="sales-react-select"
                                classNamePrefix="sales-select"
                                placeholder="Select Status"
                                value={PAYMENT_STATUS_OPTIONS.find(opt => opt.value === paymentStatus)}
                                onChange={(option) => setPaymentStatus(option?.value || "Paid")}
                            />
                        </div>

                        {paymentStatus === 'Paid' && (
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
                        )}
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

                {/* Summary */}
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
                            {isGstMode && !isChallan && (
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
                            disabled={isSubmitting || lineItems.length === 0}
                        >
                            {isSubmitting ? "Saving..." : isEditMode ? "Update Invoice" : "Create Invoice"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ============= ✅ RENDER DELETE MODAL =============
    const renderDeleteModal = () => {
        if (!showDeleteModal || !saleToDelete) return null;

        return (
            <div className="sales-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                <div className="sales-delete-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="sales-delete-modal-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h3 className="sales-delete-modal-title">Confirm Delete</h3>

                    <p className="sales-delete-modal-text">
                        Are you sure you want to delete this invoice? This action cannot be undone.
                    </p>

                    <div className="sales-delete-modal-info">
                        <div className="sales-delete-modal-row">
                            <span className="sales-delete-modal-label">Invoice No:</span>
                            <span className="sales-delete-modal-value">{saleToDelete.invoiceNumber}</span>
                        </div>
                        <div className="sales-delete-modal-row">
                            <span className="sales-delete-modal-label">Customer:</span>
                            <span className="sales-delete-modal-value">{saleToDelete.customerName}</span>
                        </div>
                        <div className="sales-delete-modal-row">
                            <span className="sales-delete-modal-label">Amount:</span>
                            <span className="sales-delete-modal-value">₹{saleToDelete.grandTotal?.toFixed(2) || 0}</span>
                        </div>
                    </div>

                    <div className="sales-delete-modal-buttons">
                        <button
                            className="sales-delete-modal-cancel"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="sales-delete-modal-confirm"
                            onClick={confirmDeleteSale}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ============= ✅ RENDER PDF PROGRESS LOADER =============
    const renderPDFProgress = () => {
        if (!isExportingPDF) return null;

        const percentage = pdfProgress.total > 0
            ? Math.round((pdfProgress.current / pdfProgress.total) * 100)
            : 0;

        return (
            <div className="sales-pdf-progress-overlay">
                <div className="sales-pdf-progress-modal">
                    <div className="sales-pdf-progress-icon">
                        <FaFileArchive />
                    </div>

                    <h3 className="sales-pdf-progress-title">Exporting PDFs</h3>

                    <p className="sales-pdf-progress-status">{pdfProgress.status}</p>

                    {pdfProgress.total > 0 && (
                        <>
                            <div className="sales-pdf-progress-bar-container">
                                <div
                                    className="sales-pdf-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="sales-pdf-progress-percentage">{percentage}%</div>
                        </>
                    )}

                    <div className="sales-pdf-progress-spinner"></div>

                    <p className="sales-pdf-progress-hint">
                        Please don't close this window while PDFs are being generated
                    </p>
                </div>
            </div>
        );
    };

    // ============= RENDER TABLE =============
    const renderTable = () => (
        <div className="sales-table-container">
            <div className="sales-table-header">
                <div className="sales-search-filter-group">
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

                    {/* ✅ Filter Dropdown */}
                    <div className="sales-filter-container">
                        <FaFilter className="sales-filter-icon" />
                        <Select
                            options={FILTER_OPTIONS}
                            styles={selectStyles}
                            className="sales-filter-select"
                            classNamePrefix="sales-filter"
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

                <div className="sales-action-buttons">
                    <button
                        className="sales-create-btn"
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
                        className="sales-pdf-export-btn"
                        onClick={exportPDFsAsZip}
                        disabled={isExportingPDF || isLoading || sales.length === 0}
                        title="Export all filtered invoices as PDF (ZIP)"
                    >
                        {isExportingPDF ? (
                            <span className="sales-loading-spinner-small"></span>
                        ) : (
                            <FaFilePdf />
                        )}
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
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
                        {isExporting ? "Exporting..." : "Export Excel"}
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
                                    <th>Payment Status</th>
                                    <th>Payment Type</th>
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
                                            <td>
                                                <span className={`sales-status-badge ${sale.paymentStatus === 'Paid' ? 'sales-status-paid' : 'sales-status-pending'}`}>
                                                    {sale.paymentStatus === 'Paid' ? <FaCheckCircle /> : <FaClock />}
                                                    {' '}{sale.paymentStatus || 'Paid'}
                                                </span>
                                            </td>
                                            <td>{sale.paymentType || '-'}</td>
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
                                                        onClick={() => openDeleteModal(sale)}
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
                {/* <div className="sales-page-header">
                    <h2 className="sales-page-title">Sales Management</h2>
                </div> */}

                <div className="sales-content-wrapper">
                    {renderTable()}
                </div>

                {showViewModal && renderViewModal()}
                {renderDeleteModal()}
                {renderPDFProgress()}

                <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
                    {saleForPrint && <SalesPrint invoice={saleForPrint} />}
                </div>
            </div>
        </Navbar>
    );
};

export default Sales;