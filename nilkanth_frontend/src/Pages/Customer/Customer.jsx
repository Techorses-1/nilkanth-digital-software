import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaIdCard,
  FaMapMarkerAlt
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import axios from "axios";
import Navbar from "../../Components/Sidebar/Navbar";
import "../Form/Form.scss";
import "./Customer.scss";
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

const Customer = () => {
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isBulkImportLoading, setIsBulkImportLoading] = useState(false);

  // ============= PAGINATION STATE =============
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch customers
  useEffect(() => {
    fetchCustomers();
  }, [debouncedSearch, pagination.page]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/customer/get-customers`,
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
        setCustomers(response.data.data || []);
        setPagination(response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else {
        toast.error("Failed to fetch customers");
      }
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Form initial values
  const initialValues = {
    customerName: "",
    email: "",
    contactNumber: "",
    gstNumber: "",
    address: ""
  };

  // Validation schema
  const validationSchema = Yup.object({
    customerName: Yup.string()
      .required("Customer Name is required")
      .matches(/^[a-zA-Z\s]*$/, "Customer Name cannot contain numbers"),
    email: Yup.string().email("Invalid email"),
    contactNumber: Yup.string()
      .required("Mobile Number is required")
      .matches(/^[0-9]+$/, "Must be only digits")
      .min(10, "Must be exactly 10 digits")
      .max(10, "Must be exactly 10 digits"),
    gstNumber: Yup.string()
      .matches(/^[0-9A-Z]{15}$/, "GST Number must be 15 characters (digits and uppercase letters)"),
    address: Yup.string()
  });

  // Handle form submission
  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    setIsFormSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/customer/create-customer`,
        values,
        headers
      );

      toast.success(response.data.message || "Customer added successfully!");
      resetForm();
      setShowForm(false);
      await fetchCustomers();
    } catch (error) {
      if (error.response?.data?.field === "email") {
        const errorMessage = "Customer with this email already exists";
        setFieldError("email", errorMessage);
        toast.error(errorMessage);
      } else if (error.response?.data?.field === "contactNumber") {
        const errorMessage = "Customer with this mobile number already exists";
        setFieldError("contactNumber", errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error adding customer:", error);
        toast.error(error.response?.data?.message || "Error creating customer");
      }
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (updatedCustomer) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/customer/update-customer/${updatedCustomer.customerId}`,
        updatedCustomer,
        headers
      );

      toast.success(response.data.message || "Customer updated successfully!");
      setSelectedCustomer(null);
      await fetchCustomers();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error(error.response?.data?.message || "Error updating customer");
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/customer/delete-customer/${customerId}`,
        headers
      );

      setSelectedCustomer(null);
      toast.success("Customer deleted successfully!");
      await fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error(error.response?.data?.message || "Error deleting customer");
    }
  };

  // Handle row selection
  const selectCustomer = (customerId) => {
    setSelectedCustomer((prev) => (prev === customerId ? null : customerId));
  };

  // Export single customer as PDF
  const exportAsPdf = () => {
    if (!selectedCustomer) {
      toast.warning("Please select a customer first");
      return;
    }

    const customer = customers.find((c) => c.customerId === selectedCustomer);

    const content = `
<div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #3f3f91; margin: 0; font-size: 28px; font-weight: bold;">Customer Details</h1>
    <div style="height: 3px; background: linear-gradient(90deg, #3f3f91, #6a6ac5); width: 100px; margin: 10px auto;"></div>
  </div>
  
  <div style="border: 2px solid #3f3f91; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
    <div style="background: #3f3f91; padding: 15px; color: white;">
      <h2 style="margin: 0; font-size: 22px;">${customer.customerName || 'N/A'}</h2>
    </div>
    
    <div style="padding: 25px;">
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Contact Information</h3>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Email</div>
            <div>${customer.email || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Mobile Number</div>
            <div>${customer.contactNumber || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">GST Number</div>
            <div>${customer.gstNumber || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Address</div>
            <div>${customer.address || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Created Date</div>
            <div>${new Date(customer.createdAt || customer._id?.getTimestamp()).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; border: 1px dashed #ddd;">
        <div style="font-style: italic; color: #777;">Generated on ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  </div>
</div>`;

    const opt = {
      margin: 10,
      filename: `${customer.customerName}_details.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export all customers as Excel
  const exportAllAsExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error("Please login first");
        return;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/customer/export-customers`,
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
          toast.warning("No customers to export");
          return;
        }

        const exportData = data.map((customer) => ({
          Name: customer.customerName,
          Email: customer.email,
          "Mobile Number": customer.contactNumber,
          "GST Number": customer.gstNumber || '',
          "Address": customer.address || '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

        const fileName = debouncedSearch ? "filtered_customers.xlsx" : "all_customers.xlsx";
        XLSX.writeFile(workbook, fileName);
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

  const handleBulkImport = async (file) => {
    try {
      setIsBulkImportLoading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const customers = jsonData.map((row) => {
            const customerName = row['Customer Name'] || row['customerName'] || row['Name'] || '';
            const email = row['Email'] || row['email'] || '';
            const contactNumber = row['Mobile Number'] || row['contactNumber'] || row['Mobile'] || '';
            const gstNumber = row['GST Number'] || row['gstNumber'] || '';
            const address = row['Address'] || row['address'] || '';

            return {
              customerName: customerName.toString().trim(),
              email: email ? email.toString().trim() : '',
              contactNumber: contactNumber.toString().trim(),
              gstNumber: gstNumber ? gstNumber.toString().trim().toUpperCase() : '',
              address: address.toString().trim()
            };
          }).filter(customer => customer.customerName && customer.contactNumber);

          if (customers.length === 0) {
            toast.error("No valid customer data found in the file");
            setIsBulkImportLoading(false);
            return;
          }

          const headers = getAuthHeaders();
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/customer/bulk-create-customers`,
            { customers },
            headers
          );

          const result = response.data;

          if (result.success) {
            toast.success(
              `Import completed: ${result.results.successful.length} successful, ${result.results.failed.length} failed`
            );

            if (result.results.successful.length > 0) {
              setCustomers(prev => [...result.results.successful, ...prev]);
            }

            setShowBulkImport(false);
          } else {
            toast.error(result.message || "Failed to import customers");
          }
        } catch (error) {
          console.error("Error processing file:", error);
          toast.error(error.message || "Error processing the file");
        } finally {
          setIsBulkImportLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Error reading file");
        setIsBulkImportLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error in bulk import:", error);
      toast.error("Failed to import customers");
      setIsBulkImportLoading(false);
    }
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

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="customer-pagination">
        <div className="customer-pagination-info">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} entries
        </div>
        <div className="customer-pagination-buttons">
          <button
            className="customer-page-btn"
            onClick={prevPage}
            disabled={!pagination.hasPrev || isLoading}
          >
            <FaChevronLeft /> Prev
          </button>
          <span className="customer-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="customer-page-btn"
            onClick={nextPage}
            disabled={!pagination.hasNext || isLoading}
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>
    );
  };

  // Customer Modal Component
  const CustomerModal = ({ customer, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedCustomer, setEditedCustomer] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (customer) {
        setEditedCustomer({ ...customer });
        setErrors({});
      }
    }, [customer]);

    const validateForm = (values) => {
      const newErrors = {};

      if (!values.customerName) newErrors.customerName = "Customer Name is required";
      else if (!/^[a-zA-Z\s]*$/.test(values.customerName)) newErrors.customerName = "Customer Name cannot contain numbers";

      if (values.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email))
        newErrors.email = "Invalid email address";

      if (!values.contactNumber) newErrors.contactNumber = "Mobile Number is required";
      else if (!/^[0-9]+$/.test(values.contactNumber)) newErrors.contactNumber = "Must be only digits";
      else if (values.contactNumber.length !== 10) newErrors.contactNumber = "Must be exactly 10 digits";

      if (values.gstNumber && !/^[0-9A-Z]{15}$/.test(values.gstNumber))
        newErrors.gstNumber = "GST Number must be 15 characters (digits and uppercase letters)";

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedCustomer(prev => ({ ...prev, [name]: value }));

      const fieldErrors = validateForm({ ...editedCustomer, [name]: value });
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handleSave = async () => {
      const formErrors = validateForm(editedCustomer);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        await onUpdate(editedCustomer);
        setIsEditing(false);
        setErrors({});
      } catch (error) {
        console.error("Error updating customer:", error);
      }
    };

    if (!customer) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Customer" : `Customer Details: ${customer.customerName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              <div className="detail-row">
                <span className="detail-label">Customer Name *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="customerName"
                      value={editedCustomer.customerName || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.customerName ? 'error' : ''}`}
                    />
                    {errors.customerName && <div className="error-message">{errors.customerName}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.customerName}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Email</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="email"
                      name="email"
                      value={editedCustomer.email || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.email ? 'error' : ''}`}
                    />
                    {errors.email && <div className="error-message">{errors.email}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.email || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Mobile Number *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="contactNumber"
                      value={editedCustomer.contactNumber || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.contactNumber ? 'error' : ''}`}
                    />
                    {errors.contactNumber && <div className="error-message">{errors.contactNumber}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.contactNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">GST Number</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="gstNumber"
                      value={editedCustomer.gstNumber || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.gstNumber ? 'error' : ''}`}
                    />
                    {errors.gstNumber && <div className="error-message">{errors.gstNumber}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.gstNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Address</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea
                      name="address"
                      value={editedCustomer.address || ''}
                      onChange={handleInputChange}
                      className={`edit-textarea ${errors.address ? 'error' : ''}`}
                      rows="3"
                    />
                    {errors.address && <div className="error-message">{errors.address}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.address || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(customer.createdAt || customer._id?.getTimestamp()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
            <button
              className={`update-btn ${isEditing ? 'save-btn' : ''}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save Changes" : "Update"}
            </button>
            <button
              className="delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <FaTrash /> Delete
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete {customer.customerName}? This action cannot be undone.</p>
              <div className="confirm-buttons">
                <button
                  className="confirm-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete"
                  onClick={() => {
                    onDelete(customer.customerId);
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // BulkImportModal component
  const BulkImportModal = ({ onClose, onImport, isLoading }) => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (selectedFile) => {
      if (selectedFile && !isLoading) {
        const validTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'
        ];

        if (!validTypes.includes(selectedFile.type)) {
          toast.error("Please select a valid Excel file (.xlsx, .xls, .csv)");
          return;
        }
        setFile(selectedFile);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFileSelect(droppedFile);
      }
    };

    const handleImport = () => {
      if (!file || isLoading) return;
      onImport(file);
    };

    return (
      <div className="modal-overlay" onClick={!isLoading ? onClose : undefined}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isLoading ? "Importing Customers..." : "Bulk Import Customers"}
            </div>
            {!isLoading && (
              <button className="modal-close" onClick={onClose}>&times;</button>
            )}
          </div>

          <div className="modal-body">
            {isLoading ? (
              <div className="import-loading">
                <div className="loading-spinner large"></div>
                <p>Importing customers, please wait...</p>
                <div className="loading-progress">
                  <div className="progress-bar">
                    <div className="progress-fill"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="import-instructions">
                  <h4>File Requirements:</h4>
                  <ul>
                    <li>File format: Excel (.xlsx, .xls) or CSV</li>
                    <li>Required columns: <strong>Customer Name</strong>, <strong>Mobile Number</strong></li>
                    <li>Optional columns: Email, GST Number, Address</li>
                    <li>Maximum 1000 records per file</li>
                  </ul>
                </div>

                <div
                  className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''} ${isLoading ? 'disabled' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    disabled={isLoading}
                  />

                  {file ? (
                    <div className="file-selected">
                      <FaFileExcel className="file-icon" />
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      {!isLoading && (
                        <button
                          className="remove-file"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <FaFileExcel className="upload-icon" />
                      <p>Drop Excel file here or click to browse</p>
                      <small>Supports .xlsx, .xls, .csv files</small>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {!isLoading && (
              <button className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              className={`import-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleImport}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner small"></div>
                  Importing...
                </>
              ) : (
                <>
                  <FaFileExcel /> Import Customers
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button
                className="export-all-btn"
                onClick={exportAllAsExcel}
                disabled={isExporting || isLoading}
              >
                {isExporting ? (
                  <span className="loading-spinner-small"></span>
                ) : (
                  <FaFileExcel />
                )}
                {isExporting ? "Exporting..." : "Export All"}
              </button>
              <button
                className="bulk-import-btn"
                onClick={() => setShowBulkImport(true)}
              >
                <FaFileExcel /> Bulk Import
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add Customer</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label><FaUser /> Customer Name *</label>
                    <Field name="customerName" type="text" />
                    <ErrorMessage name="customerName" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaEnvelope /> Email</label>
                    <Field name="email" type="email" />
                    <ErrorMessage name="email" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaPhone /> Mobile Number *</label>
                    <Field name="contactNumber" type="text" />
                    <ErrorMessage name="contactNumber" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaIdCard /> GST Number</label>
                    <Field name="gstNumber" type="text" placeholder="15 characters (digits & uppercase letters)" />
                    <ErrorMessage name="gstNumber" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaMapMarkerAlt /> Address</label>
                    <Field name="address" as="textarea" rows="2" placeholder="Enter address" />
                    <ErrorMessage name="address" component="div" className="error" />
                  </div>
                </div>

                <button type="submit" disabled={isFormSubmitting}>
                  {isFormSubmitting ? (
                    <>
                      <div className="loading-spinner small"></div>
                      Adding...
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="empty-state">
              <p>No customers found</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>GST</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust, index) => {
                    const serialNo = (pagination.page - 1) * pagination.limit + index + 1;
                    return (
                      <tr
                        key={cust.customerId || index}
                        className={
                          selectedCustomer === cust.customerId ? "selected" : ""
                        }
                        onClick={() => selectCustomer(cust.customerId)}
                      >
                        <td>{serialNo}</td>
                        <td>{cust.customerName}</td>
                        <td>{cust.email}</td>
                        <td>{cust.contactNumber}</td>
                        <td>{cust.gstNumber || '-'}</td>
                        <td>{cust.address || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {renderPagination()}
            </>
          )}
        </div>

        {selectedCustomer && (
          <CustomerModal
            customer={customers.find(c => c.customerId === selectedCustomer)}
            onClose={() => setSelectedCustomer(null)}
            onExport={exportAsPdf}
            onUpdate={handleUpdateCustomer}
            onDelete={handleDeleteCustomer}
          />
        )}

        {showBulkImport && (
          <BulkImportModal
            onClose={() => setShowBulkImport(false)}
            onImport={handleBulkImport}
            isLoading={isBulkImportLoading}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Customer;