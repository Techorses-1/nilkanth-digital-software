import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaCubes,
  FaHashtag,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaAlignLeft,
  FaRulerCombined,
  FaBoxes,
  FaBox,
  FaList,
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

  // ============= UNITS STATE =============
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState("");
  const [debouncedUnitSearch, setDebouncedUnitSearch] = useState("");
  const [isUnitLoading, setIsUnitLoading] = useState(true);
  const [isUnitSubmitting, setIsUnitSubmitting] = useState(false);
  const [isUnitExporting, setIsUnitExporting] = useState(false);

  // ============= PAGINATION STATE =============
  const [itemPagination, setItemPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [productPagination, setProductPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [unitPagination, setUnitPagination] = useState({
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUnitSearch(unitSearchTerm.trim());
      setUnitPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(handler);
  }, [unitSearchTerm]);

  // ============= FETCH DATA =============
  useEffect(() => {
    fetchUnits();
    fetchItems();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!isItemLoading) fetchItems();
  }, [debouncedItemSearch, itemPagination.page]);

  useEffect(() => {
    if (!isProductLoading) fetchProducts();
  }, [debouncedProductSearch, productPagination.page]);

  useEffect(() => {
    if (!isUnitLoading) fetchUnits();
  }, [debouncedUnitSearch, unitPagination.page]);

  // ============= UNITS CRUD =============
  const fetchUnits = async () => {
    setIsUnitLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/units/get-units`,
        {
          ...headers,
          params: {
            page: unitPagination.page,
            limit: unitPagination.limit,
            search: debouncedUnitSearch
          }
        }
      );

      if (response.data.success) {
        setUnits(response.data.data || []);
        setUnitPagination(response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setUnits([]);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to load units.");
      setUnits([]);
    } finally {
      setIsUnitLoading(false);
    }
  };

  const handleUnitSubmit = async (values, { resetForm, setFieldError }) => {
    setIsUnitSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/units/create-unit`,
        values,
        headers
      );
      toast.success("Unit created successfully!");
      resetForm();
      setShowUnitForm(false);
      await fetchUnits();
    } catch (error) {
      if (error.response?.data?.field === "unitName") {
        setFieldError("unitName", "Unit with this name already exists");
        toast.error("Unit with this name already exists");
      } else {
        toast.error(error.response?.data?.message || "Failed to create unit");
      }
    } finally {
      setIsUnitSubmitting(false);
    }
  };

  const handleUpdateUnit = async (updatedUnit) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/units/update-unit/${updatedUnit.unitId}`,
        updatedUnit,
        headers
      );
      toast.success("Unit updated successfully!");
      setSelectedUnit(null);
      await fetchUnits();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error updating unit");
    }
  };

  const handleDeleteUnit = async (unitId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/units/delete-unit/${unitId}`,
        headers
      );
      setSelectedUnit(null);
      toast.success("Unit deleted successfully!");
      await fetchUnits();
    } catch (error) {
      toast.error(error.response?.data?.message || "Error deleting unit");
    }
  };

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
          limit: 10,
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
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/products-master/create-product`,
        values,
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
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/products-master/update-product/${updatedProduct.productId}`,
        updatedProduct,
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

  // ============= UNIT OPTIONS FOR DROPDOWN =============
  const unitOptions = useMemo(() => {
    return units.map((unit) => ({
      value: unit.unitId,
      label: unit.unitName
    }));
  }, [units]);

  // ============= EXPORT FUNCTIONS =============
  const exportData = async (type) => {
    let isExporting = false;
    let endpoint = "";
    let searchTerm = "";

    if (type === "items") {
      isExporting = isItemExporting;
      endpoint = `${import.meta.env.VITE_API_URL}/items/export-items`;
      searchTerm = debouncedItemSearch;
    } else if (type === "products") {
      isExporting = isProductExporting;
      endpoint = `${import.meta.env.VITE_API_URL}/products-master/export-products`;
      searchTerm = debouncedProductSearch;
    } else {
      isExporting = isUnitExporting;
      endpoint = `${import.meta.env.VITE_API_URL}/units/export-units`;
      searchTerm = debouncedUnitSearch;
    }

    if (isExporting) return;

    if (type === "items") setIsItemExporting(true);
    else if (type === "products") setIsProductExporting(true);
    else setIsUnitExporting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { search: searchTerm || '' }
      });

      if (response.data.success) {
        const data = response.data.data || [];
        if (data.length === 0) {
          toast.warning("No data to export");
          return;
        }

        const exportData = data.map((item) => {
          if (type === "items") {
            return {
              "Item Name": item.itemName,
              "Description": item.itemDescription || "",
              "HSN Code": item.hsnCode,
              "Unit": item.unitName,
              "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"
            };
          } else if (type === "products") {
            return {
              "Product Name": item.productName,
              "Description": item.productDescription || "",
              "HSN Code": item.hsnCode,
              "Unit": item.unitName,
              "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"
            };
          } else {
            return {
              "Unit Name": item.unitName,
              "Description": item.unitDescription || "",
              "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"
            };
          }
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, type.charAt(0).toUpperCase() + type.slice(1));
        XLSX.writeFile(workbook, `${type}_${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success(`Exported ${data.length} records successfully!`);
      } else {
        toast.error("Failed to export data");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.message || "Failed to export");
    } finally {
      if (type === "items") setIsItemExporting(false);
      else if (type === "products") setIsProductExporting(false);
      else setIsUnitExporting(false);
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

  // ============= RENDER FUNCTIONS =============
  const renderUnitForm = () => (
    <div className="form-container premium">
      <h2>Add New Unit</h2>
      <Formik
        initialValues={{ unitName: "", unitDescription: "" }}
        validationSchema={Yup.object({
          unitName: Yup.string()
            .required("Unit name is required")
            .max(20, "Unit name cannot exceed 20 characters")
            .matches(/^[a-zA-Z0-9\s]+$/, "Unit name can only contain letters, numbers and spaces")
        })}
        onSubmit={handleUnitSubmit}
      >
        <Form>
          <div className="form-row">
            <div className="form-field">
              <label><FaRulerCombined /> Unit Name *</label>
              <Field name="unitName" type="text" placeholder="e.g., NOS, METERS, KG" />
              <ErrorMessage name="unitName" component="div" className="error" />
            </div>
            <div className="form-field">
              <label><FaAlignLeft /> Description</label>
              <Field name="unitDescription" as="textarea" rows="2" placeholder="Optional description" />
              <ErrorMessage name="unitDescription" component="div" className="error" />
            </div>
          </div>
          <button type="submit" disabled={isUnitSubmitting}>
            {isUnitSubmitting ? "Creating..." : "Create Unit"}
          </button>
        </Form>
      </Formik>
    </div>
  );

  const renderItemForm = () => (
    <div className="form-container premium">
      <h2>Add New Item</h2>
      <Formik
        initialValues={{ itemName: "", itemDescription: "", hsnCode: "", unitId: "" }}
        validationSchema={Yup.object({
          itemName: Yup.string().required("Item name is required").max(100, "Item name cannot exceed 100 characters"),
          itemDescription: Yup.string().max(500, "Description cannot exceed 500 characters"),
          hsnCode: Yup.string().required("HSN Code is required").matches(/^[0-9]{4,8}$/, "HSN Code must be 4-8 digits"),
          unitId: Yup.string().required("Unit is required")
        })}
        onSubmit={handleItemSubmit}
      >
        {({ setFieldValue, values }) => (
          <Form>
            <div className="form-row">
              <div className="form-field">
                <label><FaBoxes /> Item Name *</label>
                <Field name="itemName" type="text" placeholder="Enter item name" />
                <ErrorMessage name="itemName" component="div" className="error" />
              </div>
              <div className="form-field">
                <label><FaRulerCombined /> Unit *</label>
                <Select
                  options={unitOptions}
                  styles={selectStyles}
                  className="items-react-select"
                  classNamePrefix="items-select"
                  placeholder="Search Unit..."
                  isSearchable
                  onChange={(option) => {
                    setFieldValue("unitId", option ? option.value : "");
                  }}
                  value={unitOptions.find(opt => opt.value === values.unitId)}
                />
                <ErrorMessage name="unitId" component="div" className="error" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label><FaHashtag /> HSN Code *</label>
                <Field name="hsnCode" type="text" placeholder="4-8 digits" />
                <ErrorMessage name="hsnCode" component="div" className="error" />
              </div>
              <div className="form-field">
                <label><FaAlignLeft /> Description</label>
                <Field name="itemDescription" as="textarea" rows="2" placeholder="Enter description (optional)" />
                <ErrorMessage name="itemDescription" component="div" className="error" />
              </div>
            </div>
            <button type="submit" disabled={isItemSubmitting}>
              {isItemSubmitting ? "Creating..." : "Create Item"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );

  const renderProductForm = () => (
    <div className="form-container premium">
      <h2>Add New Product</h2>
      <Formik
        initialValues={{ productName: "", productDescription: "", hsnCode: "", unitId: "" }}
        validationSchema={Yup.object({
          productName: Yup.string().required("Product name is required").max(100, "Product name cannot exceed 100 characters"),
          productDescription: Yup.string().max(500, "Description cannot exceed 500 characters"),
          hsnCode: Yup.string().required("HSN Code is required").matches(/^[0-9]{4,8}$/, "HSN Code must be 4-8 digits"),
          unitId: Yup.string().required("Unit is required")
        })}
        onSubmit={handleProductSubmit}
      >
        {({ setFieldValue, values }) => (
          <Form>
            <div className="form-row">
              <div className="form-field">
                <label><FaBox /> Product Name *</label>
                <Field name="productName" type="text" placeholder="Enter product name" />
                <ErrorMessage name="productName" component="div" className="error" />
              </div>
              <div className="form-field">
                <label><FaRulerCombined /> Unit *</label>
                <Select
                  options={unitOptions}
                  styles={selectStyles}
                  className="items-react-select"
                  classNamePrefix="items-select"
                  placeholder="Search Unit..."
                  isSearchable
                  onChange={(option) => {
                    setFieldValue("unitId", option ? option.value : "");
                  }}
                  value={unitOptions.find(opt => opt.value === values.unitId)}
                />
                <ErrorMessage name="unitId" component="div" className="error" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label><FaHashtag /> HSN Code *</label>
                <Field name="hsnCode" type="text" placeholder="4-8 digits" />
                <ErrorMessage name="hsnCode" component="div" className="error" />
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

  // ============= TABLE RENDER FUNCTIONS =============
  const renderUnitTable = () => (
    <div className="data-table">
      <div className="table-header">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search Units..."
            value={unitSearchTerm}
            onChange={(e) => setUnitSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button
            className="export-btn"
            onClick={() => exportData("units")}
            disabled={isUnitExporting || isUnitLoading}
          >
            {isUnitExporting ? (
              <span className="loading-spinner-small"></span>
            ) : (
              <FaFileExcel />
            )}
            {isUnitExporting ? "Exporting..." : "Export"}
          </button>
          <button className="add-btn" onClick={() => setShowUnitForm(!showUnitForm)}>
            <FaPlus /> {showUnitForm ? "Close" : "Add Unit"}
          </button>
        </div>
      </div>

      {showUnitForm && renderUnitForm()}

      {isUnitLoading ? (
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <p>Loading units...</p>
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Unit Name</th>
                <th>Description</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, idx) => {
                const serialNo = (unitPagination.page - 1) * unitPagination.limit + idx + 1;
                return (
                  <tr
                    key={unit.unitId}
                    className={selectedUnit === unit.unitId ? "selected" : ""}
                    onClick={() => setSelectedUnit(selectedUnit === unit.unitId ? null : unit.unitId)}
                  >
                    <td>{serialNo}</td>
                    <td><strong>{unit.unitName}</strong></td>
                    <td>{unit.unitDescription || "-"}</td>
                    <td>{new Date(unit.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUnit(unit.unitId);
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
          {renderPagination(unitPagination, setUnitPagination, isUnitLoading)}
        </>
      )}
    </div>
  );

  const renderItemTable = () => (
    <div className="data-table">
      <div className="table-header">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search Items..."
            value={itemSearchTerm}
            onChange={(e) => setItemSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button
            className="export-btn"
            onClick={() => exportData("items")}
            disabled={isItemExporting || isItemLoading}
          >
            {isItemExporting ? (
              <span className="loading-spinner-small"></span>
            ) : (
              <FaFileExcel />
            )}
            {isItemExporting ? "Exporting..." : "Export"}
          </button>
          <button className="add-btn" onClick={() => setShowItemForm(!showItemForm)}>
            <FaPlus /> {showItemForm ? "Close" : "Add Item"}
          </button>
        </div>
      </div>

      {showItemForm && renderItemForm()}

      {isItemLoading ? (
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <p>Loading items...</p>
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Description</th>
                <th>HSN Code</th>
                <th>Unit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const serialNo = (itemPagination.page - 1) * itemPagination.limit + idx + 1;
                return (
                  <tr
                    key={item.itemId}
                    className={selectedItem === item.itemId ? "selected" : ""}
                    onClick={() => setSelectedItem(selectedItem === item.itemId ? null : item.itemId)}
                  >
                    <td>{serialNo}</td>
                    <td><strong>{item.itemName}</strong></td>
                    <td className="description-cell">
                      {item.itemDescription?.length > 50
                        ? `${item.itemDescription.substring(0, 50)}...`
                        : item.itemDescription || "-"}
                    </td>
                    <td>{item.hsnCode}</td>
                    <td><span className="unit-badge">{item.unitName}</span></td>
                    <td>
                      <button
                        className="view-btn"
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
            onClick={() => exportData("products")}
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
                <th>Unit</th>
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
                    <td><span className="unit-badge">{product.unitName}</span></td>
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

  // ============= DETAIL MODALS =============
  const UnitDetailModal = ({ unit, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedUnit, setEditedUnit] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      if (unit) setEditedUnit({ ...unit });
    }, [unit]);

    if (!unit) return null;

    return (
      <Modal
        isOpen={!!unit}
        onClose={onClose}
        title={isEditing ? "Edit Unit" : `Unit: ${unit.unitName}`}
        footer={
          <>
            <button className="export-btn" onClick={() => toast.info("PDF Export coming soon!")}>
              <FaFileExport /> Export PDF
            </button>
            <button
              className={`update-btn ${isEditing ? "save-btn" : ""}`}
              onClick={isEditing ? async () => {
                await handleUpdateUnit(editedUnit);
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
          <span className="detail-label">Unit Name:</span>
          {isEditing ? (
            <input
              type="text"
              name="unitName"
              value={editedUnit.unitName || ""}
              onChange={(e) => setEditedUnit({ ...editedUnit, unitName: e.target.value })}
              className="edit-input"
            />
          ) : (
            <span className="detail-value">{unit.unitName}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Description:</span>
          {isEditing ? (
            <textarea
              name="unitDescription"
              value={editedUnit.unitDescription || ""}
              onChange={(e) => setEditedUnit({ ...editedUnit, unitDescription: e.target.value })}
              className="edit-input"
              rows="3"
            />
          ) : (
            <span className="detail-value">{unit.unitDescription || "N/A"}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Created At:</span>
          <span className="detail-value">{new Date(unit.createdAt).toLocaleString()}</span>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Delete "{unit.unitName}"? This cannot be undone.</p>
              <div className="confirm-buttons">
                <button className="confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="confirm-delete" onClick={() => {
                  handleDeleteUnit(unit.unitId);
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
            <button className="export-btn" onClick={() => toast.info("PDF Export coming soon!")}>
              <FaFileExport /> Export PDF
            </button>
            <button
              className={`update-btn ${isEditing ? "save-btn" : ""}`}
              onClick={isEditing ? async () => {
                await handleUpdateItem(editedItem);
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
          <span className="detail-label">Item Name:</span>
          {isEditing ? (
            <input
              type="text"
              name="itemName"
              value={editedItem.itemName || ""}
              onChange={(e) => setEditedItem({ ...editedItem, itemName: e.target.value })}
              className="edit-input"
            />
          ) : (
            <span className="detail-value">{item.itemName}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Description:</span>
          {isEditing ? (
            <textarea
              name="itemDescription"
              value={editedItem.itemDescription || ""}
              onChange={(e) => setEditedItem({ ...editedItem, itemDescription: e.target.value })}
              className="edit-input"
              rows="3"
            />
          ) : (
            <span className="detail-value">{item.itemDescription || "N/A"}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">HSN Code:</span>
          {isEditing ? (
            <input
              type="text"
              name="hsnCode"
              value={editedItem.hsnCode || ""}
              onChange={(e) => setEditedItem({ ...editedItem, hsnCode: e.target.value })}
              className="edit-input"
            />
          ) : (
            <span className="detail-value">{item.hsnCode}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Unit:</span>
          {isEditing ? (
            <Select
              options={unitOptions}
              styles={selectStyles}
              className="items-react-select"
              classNamePrefix="items-select"
              placeholder="Search Unit..."
              isSearchable
              onChange={(option) => {
                const selectedUnit = units.find(u => u.unitId === option?.value);
                setEditedItem({
                  ...editedItem,
                  unitId: option?.value || "",
                  unitName: selectedUnit?.unitName || ""
                });
              }}
              value={unitOptions.find(opt => opt.value === editedItem.unitId)}
            />
          ) : (
            <span className="detail-value"><span className="unit-badge">{item.unitName}</span></span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Created At:</span>
          <span className="detail-value">{new Date(item.createdAt).toLocaleString()}</span>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Delete "{item.itemName}"? This cannot be undone.</p>
              <div className="confirm-buttons">
                <button className="confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="confirm-delete" onClick={() => {
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
              value={editedProduct.hsnCode || ""}
              onChange={(e) => setEditedProduct({ ...editedProduct, hsnCode: e.target.value })}
              className="edit-input"
            />
          ) : (
            <span className="detail-value">{product.hsnCode}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">Unit:</span>
          {isEditing ? (
            <Select
              options={unitOptions}
              styles={selectStyles}
              className="items-react-select"
              classNamePrefix="items-select"
              placeholder="Search Unit..."
              isSearchable
              onChange={(option) => {
                const selectedUnit = units.find(u => u.unitId === option?.value);
                setEditedProduct({
                  ...editedProduct,
                  unitId: option?.value || "",
                  unitName: selectedUnit?.unitName || ""
                });
              }}
              value={unitOptions.find(opt => opt.value === editedProduct.unitId)}
            />
          ) : (
            <span className="detail-value"><span className="unit-badge">{product.unitName}</span></span>
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
          <h2>Master Data</h2>
          <div className="right-section">
            <div className="tabs-container">
              <button
                className={`tab-btn ${activeTab === "items" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("items");
                  setItemPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <FaBoxes /> Items
              </button>
              <button
                className={`tab-btn ${activeTab === "products" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("products");
                  setProductPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <FaBox /> Products
              </button>
              <button
                className={`tab-btn ${activeTab === "units" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("units");
                  setUnitPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <FaList /> Units
              </button>
            </div>
          </div>
        </div>

        <div className="tab-content">
          {activeTab === "items" && renderItemTable()}
          {activeTab === "products" && renderProductTable()}
          {activeTab === "units" && renderUnitTable()}
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

        {selectedUnit && (
          <UnitDetailModal
            unit={units.find(u => u.unitId === selectedUnit)}
            onClose={() => setSelectedUnit(null)}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;