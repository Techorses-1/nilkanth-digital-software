import React, { useState, useEffect, useMemo } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import {
  FaUser, FaEnvelope, FaPhone, FaPlus,
  FaFileExport, FaFileExcel, FaSearch,
  FaEdit, FaSave, FaTrash, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle, FaKey
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../Components/Sidebar/Navbar";
import "../../Form/Form.scss";
import "./AdminUsers.scss";
import "react-toastify/dist/ReactToastify.css";

const AdminUsers = () => {
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Maximum users limit
  const MAX_USERS_LIMIT = 5;

  // Check if user limit is reached
  const isUserLimitReached = useMemo(() => {
    return users.length >= MAX_USERS_LIMIT;
  }, [users.length]);

  // Calculate remaining users
  const remainingUsers = useMemo(() => {
    return Math.max(0, MAX_USERS_LIMIT - users.length);
  }, [users.length]);

  // ✅ ACTUAL PERMISSIONS THAT EXIST IN THE SYSTEM
  const availablePermissions = [
    { id: "customer", name: "Customer" },
    { id: "products", name: "Products" },
    { id: "invoice", name: "Sales / Invoice" },
    { id: "inventory", name: "Inventory" },
    { id: "purchase", name: "Purchase" },
    { id: "vendor", name: "Vendor" },
    { id: "admin", name: "Admin" },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/admin/users`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login');
            return;
          }
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();

        // Sort by creation date (newest first)
        const sortedData = data.sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateB - dateA;
        });

        setUsers(sortedData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        toast.error("Failed to fetch users");
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [navigate]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!debouncedSearch) return users;

    return users.filter((user) => {
      return (
        user.name?.toLowerCase().includes(debouncedSearch) ||
        user.email?.toLowerCase().includes(debouncedSearch) ||
        user.phone?.toLowerCase().includes(debouncedSearch)
      );
    });
  }, [debouncedSearch, users]);

  const paginatedUsers = useMemo(() => {
    if (debouncedSearch) return filteredUsers;

    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(0, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage, debouncedSearch]);

  const hasMoreUsers = useMemo(() => {
    return debouncedSearch ? false : currentPage * itemsPerPage < filteredUsers.length;
  }, [currentPage, itemsPerPage, filteredUsers.length, debouncedSearch]);

  const loadMoreUsers = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Handle row selection
  const selectUser = (userId) => {
    setSelectedUser((prev) => (prev === userId ? null : userId));
  };

  // Export single user as PDF
  const exportAsPdf = () => {
    if (!selectedUser) {
      toast.warning("Please select a user first");
      return;
    }

    const user = users.find((u) => u.userId === selectedUser);

    const content = `
  <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #3f3f91; margin: 0; font-size: 28px; font-weight: bold;">User Details</h1>
      <div style="height: 3px; background: linear-gradient(90deg, #3f3f91, #6a6ac5); width: 100px; margin: 10px auto;"></div>
    </div>
    
    <div style="border: 2px solid #3f3f91; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
      <div style="background: #3f3f91; padding: 15px; color: white;">
        <h2 style="margin: 0; font-size: 22px;">${user.name || 'N/A'}</h2>
      </div>
      
      <div style="padding: 25px;">
        <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">User Information</h3>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Email</div>
              <div>${user.email || 'N/A'}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Phone Number</div>
              <div>${user.phone || 'N/A'}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Permissions</div>
              <div>${user.permissions ? user.permissions.join(', ') : 'No permissions'}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Created Date</div>
              <div>${new Date(user.createdAt).toLocaleDateString()}</div>
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
      filename: `${user.name}_details.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export all users as Excel
  const exportAllAsExcel = () => {
    const dataToExport = filteredUsers.length > 0 ? filteredUsers : users;

    if (dataToExport.length === 0) {
      toast.warning("No users to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      dataToExport.map((user) => ({
        Name: user.name,
        Email: user.email,
        "Phone Number": user.phone,
        Permissions: user.permissions ? user.permissions.join(', ') : 'No permissions',
        "Created At": new Date(user.createdAt).toLocaleDateString()
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

    const fileName = debouncedSearch ? "filtered_users.xlsx" : "all_users.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  // Form initial values
  const userInitialValues = {
    name: "",
    email: "",
    phone: "",
    password: "",
    permissions: []
  };

  // Validation schema
  const userValidationSchema = Yup.object({
    name: Yup.string()
      .required("Name is required")
      .matches(/^[a-zA-Z\s]*$/, "Name cannot contain numbers"),
    email: Yup.string()
      .email("Invalid email")
      .required("Email is required"),
    phone: Yup.string()
      .required("Phone Number is required")
      .matches(/^[0-9]+$/, "Must be only digits")
      .min(10, "Must be exactly 10 digits")
      .max(10, "Must be exactly 10 digits"),
    password: Yup.string()
      .min(8, "Password must be at least 8 characters")
      .required("Password is required"),
    permissions: Yup.array()
      .min(1, "At least one permission is required")
  });

  // Handle user form submission
  const handleUserSubmit = async (values, { resetForm, setFieldError }) => {
    try {
      if (isUserLimitReached) {
        toast.error(`Maximum ${MAX_USERS_LIMIT} users allowed. Please delete some users to create new ones.`);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(values),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.field === "email") {
          const errorMessage = "User with this email already exists";
          setFieldError("email", errorMessage);
          toast.error(errorMessage);
        } else {
          throw new Error(data.message || "Failed to add user");
        }
        return;
      }

      const savedUser = data.user;
      setUsers((prev) => [savedUser, ...prev]);
      toast.success("User added successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Error creating user");
    }
  };

  const handleUpdateUser = async (updatedUser) => {
    try {
      const userId = updatedUser.userId;
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedUser),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }

      const data = await response.json();
      setUsers(prev =>
        prev.map(user =>
          user.userId === updatedUser.userId ? data.user : user
        )
      );
      toast.success("User updated successfully!");
      return data;
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error updating user");
      throw error;
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      setUsers(prev =>
        prev.filter(user => user.userId !== userId)
      );
      setSelectedUser(null);
      toast.success("User deleted successfully!");

      if (isUserLimitReached) {
        toast.info("You can now create new users. 1 slot available.");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error deleting user");
    }
  };

  // Handle add user button click with validation
  const handleAddUserClick = () => {
    if (isUserLimitReached) {
      toast.error(`Maximum ${MAX_USERS_LIMIT} users reached. Please delete existing users to create new ones.`);
      return;
    }
    setShowForm(!showForm);
  };

  // User limit indicator component
  const UserLimitIndicator = () => (
    <div className={`user-limit-indicator ${isUserLimitReached ? 'limit-reached' : ''}`}>
      <div className="limit-info">
        <FaExclamationTriangle className="limit-icon" />
        <span>
          {isUserLimitReached
            ? `Maximum ${MAX_USERS_LIMIT} users reached`
            : `${remainingUsers} of ${MAX_USERS_LIMIT} user slots remaining`
          }
        </span>
      </div>
      <div className="limit-progress">
        <div
          className="limit-progress-bar"
          style={{ width: `${(users.length / MAX_USERS_LIMIT) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const UserModal = ({ user, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedUser, setEditedUser] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (user) {
        setEditedUser({
          ...user,
          permissions: user.permissions || [],
          password: ''
        });
        setErrors({});
        setShowPasswordField(false);
      }
    }, [user]);

    const isUserAdmin = useMemo(() => {
      return user?.permissions?.includes('admin') || false;
    }, [user]);

    const validateForm = (values) => {
      const newErrors = {};

      if (!values.name) newErrors.name = "Name is required";
      else if (!/^[a-zA-Z\s]*$/.test(values.name)) newErrors.name = "Name cannot contain numbers";

      if (!values.email) newErrors.email = "Email is required";
      else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email))
        newErrors.email = "Invalid email address";

      if (!values.phone) newErrors.phone = "Phone Number is required";
      else if (!/^[0-9]+$/.test(values.phone)) newErrors.phone = "Must be only digits";
      else if (values.phone.length !== 10) newErrors.phone = "Must be exactly 10 digits";

      if (!values.permissions || values.permissions.length === 0)
        newErrors.permissions = "At least one permission is required";

      if (showPasswordField && values.password && values.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      }

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedUser(prev => ({ ...prev, [name]: value }));

      const fieldErrors = validateForm({ ...editedUser, [name]: value });
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handlePermissionChange = (permission) => {
      setEditedUser(prev => {
        const currentPermissions = prev.permissions || [];
        const newPermissions = currentPermissions.includes(permission)
          ? currentPermissions.filter(p => p !== permission)
          : [...currentPermissions, permission];

        return { ...prev, permissions: newPermissions };
      });

      if (errors.permissions) {
        setErrors(prev => ({ ...prev, permissions: null }));
      }
    };

    const handleSave = async () => {
      const formErrors = validateForm(editedUser);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        const userToUpdate = { ...editedUser };
        if (!showPasswordField || !userToUpdate.password) {
          delete userToUpdate.password;
        }

        await onUpdate(userToUpdate);
        setIsEditing(false);
        setShowPasswordField(false);
        setErrors({});
      } catch (error) {
        console.error("Error updating user:", error);
      }
    };

    const togglePasswordField = () => {
      setShowPasswordField(!showPasswordField);
      if (!showPasswordField) {
        setEditedUser(prev => ({ ...prev, password: '' }));
      } else {
        setEditedUser(prev => ({ ...prev, password: '' }));
        if (errors.password) {
          setErrors(prev => ({ ...prev, password: null }));
        }
      }
    };

    if (!user) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit User" : `User Details: ${user.name}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              <div className="detail-row">
                <span className="detail-label">Name *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="name"
                      value={editedUser.name || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.name ? 'error' : ''}`}
                    />
                    {errors.name && <div className="error-message">{errors.name}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{user.name}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Email *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="email"
                      name="email"
                      value={editedUser.email || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.email ? 'error' : ''}`}
                    />
                    {errors.email && <div className="error-message">{errors.email}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{user.email || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Phone Number *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="phone"
                      value={editedUser.phone || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.phone ? 'error' : ''}`}
                    />
                    {errors.phone && <div className="error-message">{errors.phone}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{user.phone || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Permissions *</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <div className="permissions-grid-horizontal">
                      {availablePermissions.map(permission => (
                        <label key={permission.id} className="permission-checkbox-horizontal">
                          <input
                            type="checkbox"
                            checked={editedUser.permissions?.includes(permission.id) || false}
                            onChange={() => handlePermissionChange(permission.id)}
                          />
                          <span>{permission.name}</span>
                        </label>
                      ))}
                    </div>
                    {errors.permissions && <div className="error-message">{errors.permissions}</div>}
                  </div>
                ) : (
                  <span className="detail-value">
                    {user.permissions ? user.permissions.join(', ') : 'No permissions'}
                  </span>
                )}
              </div>

              {isEditing && !isUserAdmin && (
                <div className="detail-row">
                  <span className="detail-label">
                    <FaKey /> Password Update
                  </span>
                  <div className="edit-field-container">
                    <button
                      type="button"
                      className={`password-toggle-btn ${showPasswordField ? 'active' : ''}`}
                      onClick={togglePasswordField}
                    >
                      <FaKey /> {showPasswordField ? 'Cancel Password Update' : 'Update Password'}
                    </button>

                    {showPasswordField && (
                      <div className="password-field-container">
                        <div className="password-input-wrapper">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="password"
                            value={editedUser.password || ''}
                            onChange={handleInputChange}
                            placeholder="Enter new password"
                            className={`edit-input ${errors.password ? 'error' : ''}`}
                          />
                          <button
                            type="button"
                            className="password-visibility-toggle"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                        {errors.password && <div className="error-message">{errors.password}</div>}
                        <div className="password-hint">
                          Leave empty to keep current password. Minimum 8 characters.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isEditing && isUserAdmin && (
                <div className="detail-row">
                  <div className="admin-note">
                    <FaExclamationTriangle />
                    Password update is not available for admin users.
                  </div>
                </div>
              )}

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(user.createdAt).toLocaleDateString()}
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
              <p>Are you sure you want to delete {user.name}? This action cannot be undone.</p>
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
                    onDelete(user.userId);
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
                placeholder="Search Users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export All
              </button>
              <button
                className={`add-btn ${isUserLimitReached ? 'disabled' : ''}`}
                onClick={handleAddUserClick}
                disabled={isUserLimitReached}
                title={isUserLimitReached ? `Maximum ${MAX_USERS_LIMIT} users allowed` : "Add new user"}
              >
                <FaPlus />
                {showForm ? "Close" : "Add User"}
                {isUserLimitReached && <FaExclamationTriangle className="warning-icon" />}
              </button>
            </div>
          </div>
        </div>

        {/* User Limit Indicator */}
        <UserLimitIndicator />

        {showForm && (
          <div className="form-container premium">
            <h2>Add User</h2>

            {remainingUsers <= 2 && (
              <div className="limit-warning">
                <FaExclamationTriangle />
                {isUserLimitReached
                  ? `You have reached the maximum limit of ${MAX_USERS_LIMIT} users.`
                  : `Only ${remainingUsers} user slot(s) remaining.`
                }
              </div>
            )}

            <Formik
              initialValues={userInitialValues}
              validationSchema={userValidationSchema}
              onSubmit={handleUserSubmit}
            >
              {({ values, setFieldValue, isSubmitting }) => (
                <Form>
                  <div className="form-row">
                    <div className="form-field">
                      <label><FaUser /> Name *</label>
                      <Field name="name" type="text" />
                      <ErrorMessage name="name" component="div" className="error" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label><FaEnvelope /> Email *</label>
                      <Field name="email" type="email" />
                      <ErrorMessage name="email" component="div" className="error" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label><FaPhone /> Phone Number *</label>
                      <Field name="phone" type="text" />
                      <ErrorMessage name="phone" component="div" className="error" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label><FaLock /> Password *</label>
                      <div className="password-input-container">
                        <Field
                          name="password"
                          type={showPassword ? "text" : "password"}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                      <ErrorMessage name="password" component="div" className="error" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label>Permissions *</label>
                      <div className="permissions-grid">
                        {availablePermissions.map(permission => (
                          <label key={permission.id} className="permission-checkbox">
                            <Field
                              type="checkbox"
                              name="permissions"
                              value={permission.id}
                              checked={values.permissions.includes(permission.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFieldValue('permissions', [...values.permissions, permission.id]);
                                } else {
                                  setFieldValue('permissions', values.permissions.filter(p => p !== permission.id));
                                }
                              }}
                            />
                            <span>{permission.name}</span>
                          </label>
                        ))}
                      </div>
                      <ErrorMessage name="permissions" component="div" className="error" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUserLimitReached || isSubmitting}
                    className={isUserLimitReached ? 'disabled' : ''}
                  >
                    {isUserLimitReached ? 'Limit Reached' : 'Create User'}
                  </button>
                </Form>
              )}
            </Formik>
          </div>
        )}

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading users...</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user, index) => (
                    <tr
                      key={user.userId || index}
                      className={
                        selectedUser === user.userId ? "selected" : ""
                      }
                      onClick={() => selectUser(user.userId)}
                    >
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.permissions ? user.permissions.join(', ') : 'No permissions'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMoreUsers && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMoreUsers}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedUser && (
          <UserModal
            user={users.find(u => u.userId === selectedUser)}
            onClose={() => setSelectedUser(null)}
            onExport={exportAsPdf}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
          />
        )}
      </div>
    </Navbar>
  );
};

export default AdminUsers;