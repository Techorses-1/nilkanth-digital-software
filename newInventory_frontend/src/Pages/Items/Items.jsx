import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaBox,
  FaHashtag,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaAlignLeft,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
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

// ✅ FIXED HSN CODE FOR PRODUCTS
const FIXED_HSN_CODE = "8423";

const Items = () => {
  // ============= PRODUCTS STATE =============
  const [showProductForm, setShowProductForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [isProductSubmitting, setIsProductSubmitting] = useState(false);
  const [isProductExporting, setIsProductExporting] = useState(false);

  // ============= PAGINATION STATE =============
  const [productPagination, setProductPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const navigate = useNavigate();

  // ============= DEBOUNCE EFFECTS =============
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductSearch(productSearchTerm.trim());
      setProductPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [productSearchTerm]);

  // ============= FETCH DATA =============
  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!isProductLoading) fetchProducts();
  }, [debouncedProductSearch, productPagination.page]);

  // ============= PRODUCTS CRUD =============
  const fetchProducts = async () => {
    setIsProductLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/products-master/get-products`,
        {
          ...headers,
          params: {
            page: productPagination.page,
            limit: productPagination.limit,
            search: debouncedProductSearch
          }
        }
      );

      if (response.data.success) {
        setProducts(response.data.data || []);
        setProductPagination(response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products.");
      setProducts([]);
    } finally {
      setIsProductLoading(false);
    }
  };

  const handleProductSubmit = async (values, { resetForm, setFieldError }) => {
    setIsProductSubmitting(true);
    try {
      const headers = getAuthHeaders();
      // ✅ Force HSN Code to fixed value
      const payload = {
        ...values,
        hsnCode: FIXED_HSN_CODE
      };
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/products-master/create-product`,
        payload,
        headers
      );
      toast.success(response.data.message || "Product created successfully!");
      resetForm();
      setShowProductForm(false);
      await fetchProducts();
    } catch (error) {
      if (error.response?.data?.field === "productName") {
        setFieldError("productName", "Product with this name already exists");
        toast.error("Product with this name already exists");
      } else {
        toast.error(error.response?.data?.message || "Failed to create product");
      }
    } finally {
      setIsProductSubmitting(false);
    }
  };

  const handleUpdateProduct = async (updatedProduct) => {
    try {
      const headers = getAuthHeaders();
      // ✅ Force HSN Code to fixed value on update too
      const payload = {
        ...updatedProduct,
        hsnCode: FIXED_HSN_CODE
      };
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/products-master/update-product/${updatedProduct.productId}`,
        payload,
        headers
      );
      toast.success(response.data.message || "Product updated successfully!");
      setSelectedProduct(null);
      await fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error updating product");
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/products-master/delete-product/${productId}`,
        headers
      );
      setSelectedProduct(null);
      toast.success("Product deleted successfully!");
      await fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error deleting product");
    }
  };

  // ============= EXPORT FUNCTIONS =============
  const exportProducts = async () => {
    if (isProductExporting) return;
    setIsProductExporting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/products-master/export-products`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { search: debouncedProductSearch || '' }
        }
      );

      if (response.data.success) {
        const data = response.data.data || [];
        if (data.length === 0) {
          toast.warning("No data to export");
          return;
        }

        const exportData = data.map((item) => ({
          "Product Name": item.productName,
          "Description": item.productDescription || "",
          "HSN Code": item.hsnCode,
          "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
        XLSX.writeFile(workbook, `products_${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success(`Exported ${data.length} records successfully!`);
      } else {
        toast.error("Failed to export data");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.message || "Failed to export");
    } finally {
      setIsProductExporting(false);
    }
  };

  // ============= MODAL COMPONENT =============
  const Modal = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    useEffect(() => {
      document.body.style.overflow = "hidden";
      return () => (document.body.style.overflow = "auto");
    }, []);

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    );
  };

  // ============= PAGINATION RENDER =============
  const renderPagination = (pagination, setPagination, isLoading) => {
    if (pagination.totalPages <= 1) return null;

    const prevPage = () => {
      if (pagination.hasPrev) {
        setPagination(prev => ({ ...prev, page: prev.page - 1 }));
      }
    };

    const nextPage = () => {
      if (pagination.hasNext) {
        setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      }
    };

    return (
      <div className="items-pagination">
        <div className="items-pagination-info">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} entries
        </div>
        <div className="items-pagination-buttons">
          <button
            className="items-page-btn"
            onClick={prevPage}
            disabled={!pagination.hasPrev || isLoading}
          >
            <FaChevronLeft /> Prev
          </button>
          <span className="items-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="items-page-btn"
            onClick={nextPage}
            disabled={!pagination.hasNext || isLoading}
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>
    );
  };

  // ============= RENDER PRODUCT FORM =============
  const renderProductForm = () => (
    <div className="form-container premium">
      <h2>Add New Product</h2>
      <Formik
        initialValues={{ productName: "", productDescription: "", hsnCode: FIXED_HSN_CODE }}
        validationSchema={Yup.object({
          productName: Yup.string().required("Product name is required").max(100, "Product name cannot exceed 100 characters"),
          productDescription: Yup.string().max(500, "Description cannot exceed 500 characters"),
          hsnCode: Yup.string().required("HSN Code is required")
        })}
        onSubmit={handleProductSubmit}
      >
        {() => (
          <Form>
            <div className="form-row">
              <div className="form-field">
                <label><FaBox /> Product Name *</label>
                <Field name="productName" type="text" placeholder="Enter product name" />
                <ErrorMessage name="productName" component="div" className="error" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label><FaHashtag /> HSN Code *</label>
                <Field
                  name="hsnCode"
                  type="text"
                  placeholder="Fixed HSN Code"
                  readOnly
                  className="readonly-field"
                />
                <ErrorMessage name="hsnCode" component="div" className="error" />
                <div className="field-hint">HSN Code is fixed to: {FIXED_HSN_CODE}</div>
              </div>
              <div className="form-field">
                <label><FaAlignLeft /> Description</label>
                <Field name="productDescription" as="textarea" rows="2" placeholder="Enter description (optional)" />
                <ErrorMessage name="productDescription" component="div" className="error" />
              </div>
            </div>
            <button type="submit" disabled={isProductSubmitting}>
              {isProductSubmitting ? "Creating..." : "Create Product"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );

  // ============= RENDER PRODUCT TABLE =============
  const renderProductTable = () => (
    <div className="data-table">
      <div className="table-header">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search Products..."
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button
            className="export-btn"
            onClick={exportProducts}
            disabled={isProductExporting || isProductLoading}
          >
            {isProductExporting ? (
              <span className="loading-spinner-small"></span>
            ) : (
              <FaFileExcel />
            )}
            {isProductExporting ? "Exporting..." : "Export"}
          </button>
          <button className="add-btn" onClick={() => setShowProductForm(!showProductForm)}>
            <FaPlus /> {showProductForm ? "Close" : "Add Product"}
          </button>
        </div>
      </div>

      {showProductForm && renderProductForm()}

      {isProductLoading ? (
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <p>Loading products...</p>
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name</th>
                <th>Description</th>
                <th>HSN Code</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => {
                const serialNo = (productPagination.page - 1) * productPagination.limit + idx + 1;
                return (
                  <tr
                    key={product.productId}
                    className={selectedProduct === product.productId ? "selected" : ""}
                    onClick={() => setSelectedProduct(selectedProduct === product.productId ? null : product.productId)}
                  >
                    <td>{serialNo}</td>
                    <td><strong>{product.productName}</strong></td>
                    <td className="description-cell">
                      {product.productDescription?.length > 50
                        ? `${product.productDescription.substring(0, 50)}...`
                        : product.productDescription || "-"}
                    </td>
                    <td>{product.hsnCode}</td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(product.productId);
                        }}
                      >
                        <FaEdit /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {renderPagination(productPagination, setProductPagination, isProductLoading)}
        </>
      )}
    </div>
  );

  // ============= PRODUCT DETAIL MODAL =============
  const ProductDetailModal = ({ product, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedProduct, setEditedProduct] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      if (product) setEditedProduct({ ...product });
    }, [product]);

    if (!product) return null;

    return (
      <Modal
        isOpen={!!product}
        onClose={onClose}
        title={isEditing ? "Edit Product" : `Product: ${product.productName}`}
        footer={
          <>
            <button className="export-btn" onClick={() => toast.info("PDF Export coming soon!")}>
              <FaFileExport /> Export PDF
            </button>
            <button
              className={`update-btn ${isEditing ? "save-btn" : ""}`}
              onClick={isEditing ? async () => {
                await handleUpdateProduct(editedProduct);
                setIsEditing(false);
              } : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save" : "Edit"}
            </button>
            <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash /> Delete
            </button>
          </>
        }
      >
        <div className="detail-row">
          <span className="detail-label">Product Name:</span>
          {isEditing ? (
            <input
              type="text"
              name="productName"
              value={editedProduct.productName || ""}
              onChange={(e) => setEditedProduct({ ...editedProduct, productName: e.target.value })}
              className="edit-input"
            />
          ) : (
            <span className="detail-value">{product.productName}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Description:</span>
          {isEditing ? (
            <textarea
              name="productDescription"
              value={editedProduct.productDescription || ""}
              onChange={(e) => setEditedProduct({ ...editedProduct, productDescription: e.target.value })}
              className="edit-input"
              rows="3"
            />
          ) : (
            <span className="detail-value">{product.productDescription || "N/A"}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">HSN Code:</span>
          {isEditing ? (
            <input
              type="text"
              name="hsnCode"
              value={FIXED_HSN_CODE}
              className="edit-input readonly-field"
              readOnly
            />
          ) : (
            <span className="detail-value">{product.hsnCode}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Created At:</span>
          <span className="detail-value">{new Date(product.createdAt).toLocaleString()}</span>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Delete "{product.productName}"? This cannot be undone.</p>
              <div className="confirm-buttons">
                <button className="confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="confirm-delete" onClick={() => {
                  handleDeleteProduct(product.productId);
                  setShowDeleteConfirm(false);
                  onClose();
                }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    );
  };

  // ============= MAIN RENDER =============
  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <h2>Product Master</h2>
        </div>

        <div className="tab-content">
          {renderProductTable()}
        </div>

        {selectedProduct && (
          <ProductDetailModal
            product={products.find(p => p.productId === selectedProduct)}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;