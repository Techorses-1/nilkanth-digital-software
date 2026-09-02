import React, { useState, useEffect, useMemo } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaUserTie,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaIdCard,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Vendor.scss";
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

const Vendor = () => {
  const [showForm, setShowForm] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch Vendors
  useEffect(() => {
    fetchVendors();
  }, [debouncedSearch, pagination.page]);

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/vendors/get-vendors`,
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
        setVendors(response.data.data || []);
        setPagination(response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else {
        toast.error("Failed to load vendor data.");
      }
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit vendor
  const initialValues = {
    vendorName: "",
    companyName: "",
    email: "",
    contactNumber: "",
    gstNumber: "",
    address: "",
  };

  const validationSchema = Yup.object({
    vendorName: Yup.string()
      .required("Contact Person is required")
      .matches(/^(?![0-9]+$)[a-zA-Z0-9\s]*$/, "Contact Person cannot contain only numbers"),
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
    address: Yup.string(),
  });

  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/vendors/create-vendors`,
        values,
        headers
      );

      toast.success(response.data.message || "Vendor submitted successfully!");
      resetForm();
      setShowForm(false);
      await fetchVendors();
    } catch (error) {
      if (error.response && error.response.data.field === "email") {
        const errorMessage = "Vendor with this email already exists";
        setFieldError("email", errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error submitting vendor:", error);
        toast.error(error.response?.data?.message || "Failed to submit vendor.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectVendor = (vendorId) => {
    setSelectedVendor((prev) => (prev === vendorId ? null : vendorId));
  };

  // Export PDF
  const exportSelectedAsPDF = () => {
    if (!selectedVendor) {
      toast.warning("Please select a vendor to export");
      return;
    }
    const vendor = vendors.find((v) => v.vendorId === selectedVendor);

    const content = `
  <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff; max-width: 800px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #3f3f91; margin: 0; font-size: 28px; font-weight: bold;">Vendor Details</h1>
      <div style="height: 3px; background: linear-gradient(90deg, #3f3f91, #6a6ac5); width: 100px; margin: 10px auto;"></div>
    </div>
    
    <div style="border: 2px solid #3f3f91; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
      <div style="background: #3f3f91; padding: 15px; color: white;">
        <h2 style="margin: 0; font-size: 22px;">${vendor.vendorName || "N/A"}</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">${vendor.companyName || "N/A"}</p>
      </div>
      
      <div style="padding: 25px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Contact Information</h3>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Email</div>
              <div>${vendor.email || "N/A"}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Contact Number</div>
              <div>${vendor.contactNumber || "N/A"}</div>
            </div>
          </div>
          
          <div>
            <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Company Details</h3>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">GST Number</div>
              <div>${vendor.gstNumber || "N/A"}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Address</div>
              <div>${vendor.address || "N/A"}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Created Date</div>
              <div>${new Date(
      vendor.createdAt || vendor._id?.getTimestamp()
    ).toLocaleDateString()}</div>
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
      filename: `${vendor.vendorName}_details.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export All Excel
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
        `${import.meta.env.VITE_API_URL}/vendors/export-vendors`,
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
          toast.warning("No vendors to export");
          return;
        }

        const exportData = data.map((vendor) => ({
          "Vendor Name": vendor.vendorName,
          "Company Name": vendor.companyName,
          "GST Number": vendor.gstNumber,
          Email: vendor.email,
          "Contact Number": vendor.contactNumber,
          Address: vendor.address,
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors");

        const fileName = debouncedSearch ? "filtered_vendors.xlsx" : "all_vendors.xlsx";
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

  // Update vendor
  const handleUpdateVendor = async (updatedVendor) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/vendors/update-vendor/${updatedVendor.vendorId}`,
        updatedVendor,
        headers
      );

      toast.success(response.data.message || "Vendor updated successfully!");
      setSelectedVendor(null);
      await fetchVendors();
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast.error(error.response?.data?.message || "Error updating vendor");
    }
  };

  // Delete vendor
  const handleDeleteVendor = async (vendorId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/vendors/delete-vendor/${vendorId}`,
        headers
      );

      setSelectedVendor(null);
      toast.success("Vendor deleted successfully!");
      await fetchVendors();
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error(error.response?.data?.message || "Error deleting vendor");
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

  // Vendor Modal Component
  const VendorModal = ({ vendor, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedVendor, setEditedVendor] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "auto";
      };
    }, []);

    useEffect(() => {
      if (vendor) {
        setEditedVendor({ ...vendor });
        setErrors({});
      }
    }, [vendor]);

    const validateForm = (values) => {
      const newErrors = {};

      if (!values.vendorName) newErrors.vendorName = "Contact Person is required";
      else if (/^[0-9]+$/.test(values.vendorName))
        newErrors.vendorName = "Contact Person cannot contain only numbers";

      if (!values.companyName) newErrors.companyName = "Company Name is required";
      else if (/^[0-9]+$/.test(values.companyName))
        newErrors.companyName = "Company Name cannot contain only numbers";

      if (values.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email))
        newErrors.email = "Invalid email address";

      if (values.contactNumber && !/^[0-9]+$/.test(values.contactNumber))
        newErrors.contactNumber = "Must be only digits";
      else if (values.contactNumber && values.contactNumber.length !== 10)
        newErrors.contactNumber = "Must be exactly 10 digits";

      if (values.gstNumber && !/^[0-9A-Z]+$/.test(values.gstNumber))
        newErrors.gstNumber = "GST Number must contain only uppercase letters and digits";
      else if (values.gstNumber && values.gstNumber.length !== 15)
        newErrors.gstNumber = "GST number must be exactly 15 characters";

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedVendor((prev) => ({ ...prev, [name]: value }));

      const fieldErrors = validateForm({ ...editedVendor, [name]: value });
      setErrors((prev) => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handleSave = async () => {
      const formErrors = validateForm(editedVendor);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        await onUpdate(editedVendor);
        setIsEditing(false);
        setErrors({});
      } catch (error) {
        console.error("Error updating vendor:", error);
      }
    };

    if (!vendor) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing
                ? "Edit Vendor"
                : `Vendor Details: ${vendor.vendorName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              <div className="detail-row">
                <span className="detail-label">Company Name *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="companyName"
                      value={editedVendor.companyName || ""}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.companyName ? "error" : ""}`}
                    />
                    {errors.companyName && (
                      <div className="error-message">{errors.companyName}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.companyName || "N/A"}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Contact Person *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="vendorName"
                      value={editedVendor.vendorName || ""}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.vendorName ? "error" : ""}`}
                    />
                    {errors.vendorName && (
                      <div className="error-message">{errors.vendorName}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.vendorName}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Email</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="email"
                      name="email"
                      value={editedVendor.email || ""}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.email ? "error" : ""}`}
                    />
                    {errors.email && (
                      <div className="error-message">{errors.email}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.email || "N/A"}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Contact Number</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="contactNumber"
                      value={editedVendor.contactNumber || ""}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.contactNumber ? "error" : ""}`}
                    />
                    {errors.contactNumber && (
                      <div className="error-message">{errors.contactNumber}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.contactNumber || "N/A"}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">GST Number</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="gstNumber"
                      value={editedVendor.gstNumber || ""}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.gstNumber ? "error" : ""}`}
                    />
                    {errors.gstNumber && (
                      <div className="error-message">{errors.gstNumber}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.gstNumber || "N/A"}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Address</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea
                      name="address"
                      value={editedVendor.address || ""}
                      onChange={handleInputChange}
                      className={`edit-textarea ${errors.address ? "error" : ""}`}
                      rows="3"
                    />
                    {errors.address && (
                      <div className="error-message">{errors.address}</div>
                    )}
                  </div>
                ) : (
                  <span className="detail-value">{vendor.address || "N/A"}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(
                    vendor.createdAt || vendor._id?.getTimestamp()
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
            <button
              className={`update-btn ${isEditing ? "save-btn" : ""}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save Changes" : "Update"}
            </button>
            <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash /> Delete
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>
                Are you sure you want to delete {vendor.vendorName}? This action
                cannot be undone.
              </p>
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
                    onDelete(vendor.vendorId);
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

  // ============= RENDER PAGINATION =============
  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="vendor-pagination">
        <div className="vendor-pagination-info">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} entries
        </div>
        <div className="vendor-pagination-buttons">
          <button
            className="vendor-page-btn"
            onClick={prevPage}
            disabled={!pagination.hasPrev || isLoading}
          >
            <FaChevronLeft /> Prev
          </button>
          <span className="vendor-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="vendor-page-btn"
            onClick={nextPage}
            disabled={!pagination.hasNext || isLoading}
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <h2>Vendor List</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Vendors..."
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
                className="add-btn"
                onClick={() => setShowForm(!showForm)}
              >
                <FaPlus /> {showForm ? "Close" : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add Vendor</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label>
                      <FaIdCard /> Company Name *
                    </label>
                    <Field name="companyName" type="text" />
                    <ErrorMessage
                      name="companyName"
                      component="div"
                      className="error"
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      <FaUserTie /> Contact Person *
                    </label>
                    <Field name="vendorName" type="text" />
                    <ErrorMessage
                      name="vendorName"
                      component="div"
                      className="error"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>
                      <FaEnvelope /> Email
                    </label>
                    <Field name="email" type="email" />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="error"
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      <FaPhone /> Contact Number
                    </label>
                    <Field name="contactNumber" type="text" />
                    <ErrorMessage
                      name="contactNumber"
                      component="div"
                      className="error"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>
                      <FaIdCard /> GST Number
                    </label>
                    <Field name="gstNumber" type="text" />
                    <ErrorMessage
                      name="gstNumber"
                      component="div"
                      className="error"
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      <FaMapMarkerAlt /> Address
                    </label>
                    <Field name="address" as="textarea" rows="3" />
                    <ErrorMessage
                      name="address"
                      component="div"
                      className="error"
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading vendors...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="empty-state">
              <p>No vendors found</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>GST No.</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor, index) => {
                    const serialNo = (pagination.page - 1) * pagination.limit + index + 1;
                    return (
                      <tr
                        key={vendor.vendorId || index}
                        className={
                          selectedVendor === vendor.vendorId ? "selected" : ""
                        }
                        onClick={() => selectVendor(vendor.vendorId)}
                      >
                        <td>{serialNo}</td>
                        <td>{vendor.vendorName}</td>
                        <td>{vendor.companyName}</td>
                        <td>{vendor.gstNumber}</td>
                        <td>{vendor.email}</td>
                        <td>{vendor.contactNumber}</td>
                        <td>{vendor.address}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {renderPagination()}
            </>
          )}
        </div>

        {selectedVendor && (
          <VendorModal
            vendor={vendors.find((v) => v.vendorId === selectedVendor)}
            onClose={() => setSelectedVendor(null)}
            onExport={exportSelectedAsPDF}
            onUpdate={handleUpdateVendor}
            onDelete={handleDeleteVendor}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Vendor;