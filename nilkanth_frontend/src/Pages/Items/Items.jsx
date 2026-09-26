import React, { useState, useEffect } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaBox,
  FaBoxes,
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
  const [activeTab, setActiveTab] = useState("items");

  // ============= ITEMS STATE =============
  const [showItemForm, setShowItemForm] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [isItemLoading, setIsItemLoading] = useState(true);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [isItemExporting, setIsItemExporting] = useState(false);

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
  const [itemPagination, setItemPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const [productPagination, setProductPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const navigate = useNavigate();

  // ============= DEBOUNCE EFFECTS =============
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedItemSearch(itemSearchTerm.trim());
      setItemPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [itemSearchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductSearch(productSearchTerm.trim());
      setProductPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [productSearchTerm]);

  // ============= FETCH DATA =============
  useEffect(() => {
    fetchItems();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!isItemLoading) fetchItems();
  }, [debouncedItemSearch, itemPagination.page]);

  useEffect(() => {
    if (!isProductLoading) fetchProducts();
  }, [debouncedProductSearch, productPagination.page]);

  // ============= ITEMS CRUD =============
  const fetchItems = async () => {
    setIsItemLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/items/get-items`,
        {
          ...headers,
          params: {
            page: itemPagination.page,
            limit: itemPagination.limit,
            search: debouncedItemSearch
          }
        }
      );

      if (response.data.success) {
        setItems(response.data.data || []);
        setItemPagination(response.data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to load items.");
      setItems([]);
    } finally {
      setIsItemLoading(false);
    }
  };

  const handleItemSubmit = async (values, { resetForm, setFieldError }) => {
    setIsItemSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/items/create-item`,
        values,
        headers
      );
      toast.success(response.data.message || "Item created successfully!");
      resetForm();
      setShowItemForm(false);
      await fetchItems();
    } catch (error) {
      if (error.response?.data?.field === "itemName") {
        setFieldError("itemName", "Item with this name already exists");
        toast.error("Item with this name already exists");
      } else {
        toast.error(error.response?.data?.message || "Failed to create item");
      }
    } finally {
      setIsItemSubmitting(false);
    }
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/items/update-item/${updatedItem.itemId}`,
        updatedItem,
        headers
      );
      toast.success(response.data.message || "Item updated successfully!");
      setSelectedItem(null);
      await fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error updating item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/items/delete-item/${itemId}`,
        headers
      );
      setSelectedItem(null);
      toast.success("Item deleted successfully!");
      await fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error deleting item");
    }
  };

  const exportItems = async () => {
    if (isItemExporting) return;
    setIsItemExporting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/items/export-items`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { search: debouncedItemSearch || '' }
        }
      );

      if (response.data.success) {
        const data = response.data.data || [];
        if (data.length === 0) {
          toast.warning("No data to export");
          return;
        }

        const exportData = data.map((item) => ({
          "Item Name": item.itemName,
          "Description": item.itemDescription || "",
          "HSN Code": item.hsnCode,
          "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
        XLSX.writeFile(workbook, `items_${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success(`Exported ${data.length} records successfully!`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.message || "Failed to export");
    } finally {
      setIsItemExporting(false);
    }
  };

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
          limit: 20,
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
      <div className="items-modal-overlay" onClick={onClose}>
        <div className="items-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="items-modal-header">
            <div className="items-modal-title">{title}</div>
            <button className="items-modal-close" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="items-modal-body">{children}</div>
          {footer && <div className="items-modal-footer">{footer}</div>}
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

  // ============= RENDER ITEM FORM =============
  const renderItemForm = () => (
    <div className="items-form-container">
      <h2>Add New Item</h2>
      <Formik
        initialValues={{ itemName: "", itemDescription: "", hsnCode: "8423" }}
        validationSchema={Yup.object({
          itemName: Yup.string().required("Item name is required").max(100, "Item name cannot exceed 100 characters"),
          itemDescription: Yup.string().max(500, "Description cannot exceed 500 characters"),
          hsnCode: Yup.string().required("HSN Code is required")
        })}
        onSubmit={handleItemSubmit}
      >
        {() => (
          <Form>
            <div className="items-form-row">
              <div className="items-form-field">
                <label><FaBoxes /> Item Name *</label>
                <Field name="itemName" type="text" placeholder="Enter item name" />
                <ErrorMessage name="itemName" component="div" className="items-error" />
              </div>
            </div>
            <div className="items-form-row">
              <div className="items-form-field">
                <label><FaHashtag /> HSN Code *</label>
                <Field name="hsnCode" type="text" placeholder="Enter HSN Code" />
                <ErrorMessage name="hsnCode" component="div" className="items-error" />
                <div className="items-field-hint">Default: 8423 (editable)</div>
              </div>
              <div className="items-form-field">
                <label><FaAlignLeft /> Description</label>
                <Field name="itemDescription" as="textarea" rows="2" placeholder="Enter description (optional)" />
                <ErrorMessage name="itemDescription" component="div" className="items-error" />
              </div>
            </div>
            <button type="submit" className="items-submit-btn" disabled={isItemSubmitting}>
              {isItemSubmitting ? "Creating..." : "Create Item"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );

  // ============= RENDER PRODUCT FORM =============
  const renderProductForm = () => (
    <div className="items-form-container">
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
            <div className="items-form-row">
              <div className="items-form-field">
                <label><FaBox /> Product Name *</label>
                <Field name="productName" type="text" placeholder="Enter product name" />
                <ErrorMessage name="productName" component="div" className="items-error" />
              </div>
            </div>
            <div className="items-form-row">
              <div className="items-form-field">
                <label><FaHashtag /> HSN Code *</label>
                <Field
                  name="hsnCode"
                  type="text"
                  placeholder="Fixed HSN Code"
                  readOnly
                  className="items-readonly-field"
                />
                <ErrorMessage name="hsnCode" component="div" className="items-error" />
                <div className="items-field-hint">HSN Code is fixed to: {FIXED_HSN_CODE}</div>
              </div>
              <div className="items-form-field">
                <label><FaAlignLeft /> Description</label>
                <Field name="productDescription" as="textarea" rows="2" placeholder="Enter description (optional)" />
                <ErrorMessage name="productDescription" component="div" className="items-error" />
              </div>
            </div>
            <button type="submit" className="items-submit-btn" disabled={isProductSubmitting}>
              {isProductSubmitting ? "Creating..." : "Create Product"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );

  // ============= RENDER ITEM TABLE =============
  const renderItemTable = () => (
    <div className="items-data-table">
      <div className="items-table-header">
        <div className="items-search-container">
          <FaSearch className="items-search-icon" />
          <input
            type="text"
            placeholder="Search Items..."
            value={itemSearchTerm}
            onChange={(e) => setItemSearchTerm(e.target.value)}
          />
        </div>
        <div className="items-action-buttons">
          <button
            className="items-export-btn"
            onClick={exportItems}
            disabled={isItemExporting || isItemLoading}
          >
            {isItemExporting ? (
              <span className="items-loading-spinner-small"></span>
            ) : (
              <FaFileExcel />
            )}
            {isItemExporting ? "Exporting..." : "Export"}
          </button>
          <button className="items-add-btn" onClick={() => setShowItemForm(!showItemForm)}>
            <FaPlus /> {showItemForm ? "Close" : "Add Item"}
          </button>
        </div>
      </div>

      {showItemForm && renderItemForm()}

      {isItemLoading ? (
        <div className="items-loading-container">
          <div className="items-loading-spinner items-loading-spinner-large"></div>
          <p>Loading items...</p>
        </div>
      ) : (
        <>
          <table className="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Description</th>
                <th>HSN Code</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const serialNo = (itemPagination.page - 1) * itemPagination.limit + idx + 1;
                return (
                  <tr
                    key={item.itemId}
                    className={selectedItem === item.itemId ? "items-row-selected" : ""}
                    onClick={() => setSelectedItem(selectedItem === item.itemId ? null : item.itemId)}
                  >
                    <td>{serialNo}</td>
                    <td><strong>{item.itemName}</strong></td>
                    <td className="items-description-cell">
                      {item.itemDescription?.length > 50
                        ? `${item.itemDescription.substring(0, 50)}...`
                        : item.itemDescription || "-"}
                    </td>
                    <td>{item.hsnCode}</td>
                    <td>
                      <button
                        className="items-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item.itemId);
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
          {renderPagination(itemPagination, setItemPagination, isItemLoading)}
        </>
      )}
    </div>
  );

  // ============= RENDER PRODUCT TABLE =============
  const renderProductTable = () => (
    <div className="items-data-table">
      <div className="items-table-header">
        <div className="items-search-container">
          <FaSearch className="items-search-icon" />
          <input
            type="text"
            placeholder="Search Products..."
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
          />
        </div>
        <div className="items-action-buttons">
          <button
            className="items-export-btn"
            onClick={exportProducts}
            disabled={isProductExporting || isProductLoading}
          >
            {isProductExporting ? (
              <span className="items-loading-spinner-small"></span>
            ) : (
              <FaFileExcel />
            )}
            {isProductExporting ? "Exporting..." : "Export"}
          </button>
          <button className="items-add-btn" onClick={() => setShowProductForm(!showProductForm)}>
            <FaPlus /> {showProductForm ? "Close" : "Add Product"}
          </button>
        </div>
      </div>

      {showProductForm && renderProductForm()}

      {isProductLoading ? (
        <div className="items-loading-container">
          <div className="items-loading-spinner items-loading-spinner-large"></div>
          <p>Loading products...</p>
        </div>
      ) : (
        <>
          <table className="items-table">
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
                    className={selectedProduct === product.productId ? "items-row-selected" : ""}
                    onClick={() => setSelectedProduct(selectedProduct === product.productId ? null : product.productId)}
                  >
                    <td>{serialNo}</td>
                    <td><strong>{product.productName}</strong></td>
                    <td className="items-description-cell">
                      {product.productDescription?.length > 50
                        ? `${product.productDescription.substring(0, 50)}...`
                        : product.productDescription || "-"}
                    </td>
                    <td>{product.hsnCode}</td>
                    <td>
                      <button
                        className="items-view-btn"
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

  // ============= ITEM DETAIL MODAL =============
  const ItemDetailModal = ({ item, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      if (item) setEditedItem({ ...item });
    }, [item]);

    if (!item) return null;

    return (
      <Modal
        isOpen={!!item}
        onClose={onClose}
        title={isEditing ? "Edit Item" : `Item: ${item.itemName}`}
        footer={
          <>
            <button
              className={`items-update-btn ${isEditing ? "items-save-btn" : ""}`}
              onClick={isEditing ? async () => {
                await handleUpdateItem(editedItem);
                setIsEditing(false);
              } : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save" : "Edit"}
            </button>
            <button className="items-delete-btn" onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash /> Delete
            </button>
          </>
        }
      >
        <div className="items-detail-row">
          <span className="items-detail-label">Item Name:</span>
          {isEditing ? (
            <input
              type="text"
              name="itemName"
              value={editedItem.itemName || ""}
              onChange={(e) => setEditedItem({ ...editedItem, itemName: e.target.value })}
              className="items-edit-input"
            />
          ) : (
            <span className="items-detail-value">{item.itemName}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">Description:</span>
          {isEditing ? (
            <textarea
              name="itemDescription"
              value={editedItem.itemDescription || ""}
              onChange={(e) => setEditedItem({ ...editedItem, itemDescription: e.target.value })}
              className="items-edit-input"
              rows="3"
            />
          ) : (
            <span className="items-detail-value">{item.itemDescription || "N/A"}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">HSN Code:</span>
          {isEditing ? (
            <input
              type="text"
              name="hsnCode"
              value={editedItem.hsnCode || ""}
              onChange={(e) => setEditedItem({ ...editedItem, hsnCode: e.target.value })}
              className="items-edit-input"
            />
          ) : (
            <span className="items-detail-value">{item.hsnCode}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">Created At:</span>
          <span className="items-detail-value">{new Date(item.createdAt).toLocaleString()}</span>
        </div>

        {showDeleteConfirm && (
          <div className="items-confirm-overlay">
            <div className="items-confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Delete "{item.itemName}"? This cannot be undone.</p>
              <div className="items-confirm-buttons">
                <button className="items-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="items-confirm-delete-btn" onClick={() => {
                  handleDeleteItem(item.itemId);
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
            <button
              className={`items-update-btn ${isEditing ? "items-save-btn" : ""}`}
              onClick={isEditing ? async () => {
                await handleUpdateProduct(editedProduct);
                setIsEditing(false);
              } : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save" : "Edit"}
            </button>
            <button className="items-delete-btn" onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash /> Delete
            </button>
          </>
        }
      >
        <div className="items-detail-row">
          <span className="items-detail-label">Product Name:</span>
          {isEditing ? (
            <input
              type="text"
              name="productName"
              value={editedProduct.productName || ""}
              onChange={(e) => setEditedProduct({ ...editedProduct, productName: e.target.value })}
              className="items-edit-input"
            />
          ) : (
            <span className="items-detail-value">{product.productName}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">Description:</span>
          {isEditing ? (
            <textarea
              name="productDescription"
              value={editedProduct.productDescription || ""}
              onChange={(e) => setEditedProduct({ ...editedProduct, productDescription: e.target.value })}
              className="items-edit-input"
              rows="3"
            />
          ) : (
            <span className="items-detail-value">{product.productDescription || "N/A"}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">HSN Code:</span>
          {isEditing ? (
            <input
              type="text"
              name="hsnCode"
              value={FIXED_HSN_CODE}
              className="items-edit-input items-readonly-field"
              readOnly
            />
          ) : (
            <span className="items-detail-value">{product.hsnCode}</span>
          )}
        </div>
        <div className="items-detail-row">
          <span className="items-detail-label">Created At:</span>
          <span className="items-detail-value">{new Date(product.createdAt).toLocaleString()}</span>
        </div>

        {showDeleteConfirm && (
          <div className="items-confirm-overlay">
            <div className="items-confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Delete "{product.productName}"? This cannot be undone.</p>
              <div className="items-confirm-buttons">
                <button className="items-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="items-confirm-delete-btn" onClick={() => {
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
      <div className="items-page-wrapper">
        <div className="items-page-header">
          <h2>Master Data</h2>
          <div className="items-header-right">
            <div className="items-tabs-container">
              <button
                className={`items-tab-btn ${activeTab === "items" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("items");
                  setItemPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <FaBoxes /> Items
              </button>
              <button
                className={`items-tab-btn ${activeTab === "products" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("products");
                  setProductPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <FaBox /> Products
              </button>
            </div>
          </div>
        </div>

        <div className="items-tab-content">
          {activeTab === "items" && renderItemTable()}
          {activeTab === "products" && renderProductTable()}
        </div>

        {selectedItem && (
          <ItemDetailModal
            item={items.find(i => i.itemId === selectedItem)}
            onClose={() => setSelectedItem(null)}
          />
        )}

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