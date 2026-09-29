import { useState, useEffect } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";

// Icon imports
import { BiLogOut, BiLogIn } from "react-icons/bi";
import { TbUsers } from "react-icons/tb";
import {  PiShoppingCart } from "react-icons/pi";
import { GiHamburgerMenu } from "react-icons/gi";
import { RxCross1 } from "react-icons/rx";
import { FiUser } from "react-icons/fi";
import {  MdInventory, MdAdminPanelSettings, MdReceiptLong } from "react-icons/md";
import {  FaTools } from "react-icons/fa";
import {  RiFilePaper2Line } from "react-icons/ri";
import { TbCertificate } from "react-icons/tb";
import { FaClipboardList, FaStamp } from "react-icons/fa";

import logo from "../../Assets/logo/logo.png";
import "./Navbar.css";

const Navbar = ({
  children,
  onNavigation,
  isCollapsed = false,
  onToggleCollapse,
  pageDashboard = null
}) => {
  const [toggle, setToggle] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync with parent's collapsed state
  useEffect(() => {
    console.log('Navbar: isCollapsed prop changed to:', isCollapsed);
    setToggle(isCollapsed);
  }, [isCollapsed]);

  // Handle internal toggle changes
  const handleToggle = (newToggleState) => {
    setToggle(newToggleState);
    if (onToggleCollapse) {
      onToggleCollapse(newToggleState);
    }
  };

  const handleHamburgerClick = () => {
    handleToggle(!toggle);
  };

  const handleCrossClick = () => {
    handleToggle(true);
  };

  const handleMenuIconHiddenClick = () => {
    handleToggle(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const permissions = JSON.parse(localStorage.getItem("permissions") || "[]");
    setIsLoggedIn(!!token);
    setUserPermissions(permissions);
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("permissions");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUserPermissions([]);
    navigate("/login");
  };

  const getPageTitle = () => {
    const route = location.pathname;
    switch (route) {
      case '/':
        return 'Sales / Invoice Management';
      case '/customer':
        return 'Customer Dashboard';
      case '/vendor':
        return 'Vendor Management';
      case '/items':
        return 'Products Management';
      case '/purchase':
        return 'Purchase Management';
      case '/inventory':
        return 'Inventory Management';
      case '/admin':
        return 'Admin Management Dashboard';
      case '/dashboard':
        return 'Dashboard';
      case '/productdiscount':
        return 'Discount Dashboard';
      case '/defective':
        return 'Product Disposal Dashboard';
      case '/report':
        return 'Business Reports And Analytics';
      case '/quotation':
        return 'Quotation Management';
      case '/repairing':
        return 'Repairing Management';
      case '/amc':
        return 'AMC Management';
      case '/stamping':
        return 'Stamping Management';
      case '/history':
        return 'Customer History';
      default:
        return '';
    }
  };

  const pageTitle = getPageTitle();

  // Define all possible menu items with their required permissions
  // ✅ ACTUAL PROPER ICONS per menu item
  const allMenuData = [
    {
      icon: <MdReceiptLong />,
      title: "Sales",
      path: "/",
      permission: "invoice"
    },
    {
      icon: <TbUsers />,
      title: "Customer",
      path: "/customer",
      permission: "customer"
    },
    // { icon: <FaTruck />, title: "Vendor", path: "/vendor", permission: "customer" },
    {
      icon: <PiShoppingCart />,
      title: "Products",
      path: "/items",
      permission: "products"
    },
    // { icon: <FaStore />, title: "Purchase", path: "/purchase", permission: "purchase" },
    {
      icon: <MdInventory />,
      title: "Inventory",
      path: "/inventory",
      permission: "inventory"
    },
    {
      icon: <RiFilePaper2Line />,
      title: "Quotation",
      path: "/quotation",
      permission: "admin"
    },
    {
      icon: <FaTools />,
      title: "Repairing",
      path: "/repairing",
      permission: "admin"
    },
    {
      icon: <TbCertificate />,
      title: "AMC",
      path: "/amc",
      permission: "admin"
    },
    {
      icon: <FaStamp />,
      title: "Stamping",
      path: "/stamping",
      permission: "admin"
    },
    {
      icon: <FaClipboardList />,
      title: "History",
      path: "/history",
      permission: "admin"
    },
    {
      icon: <MdAdminPanelSettings />,
      title: "Admin",
      path: "/admin",
      permission: "admin"
    },
  ];

  // Filter menu items based on user permissions
  const getFilteredMenu = () => {
    if (userPermissions.includes("admin")) {
      return allMenuData;
    }
    return allMenuData.filter(item => userPermissions.includes(item.permission));
  };

  const filteredMenuData = getFilteredMenu();

  return (
    <>
      <div id="sidebar" className={toggle ? "hide" : ""}>
        <div className="logo">
          <div className="logoBox">
            {toggle ? (
              <GiHamburgerMenu
                className="menuIconHidden"
                onClick={handleMenuIconHiddenClick}
              />
            ) : (
              <>
                <img src={logo} alt="Logo" className="sidebar-logo" />
                <RxCross1
                  className="menuIconHidden"
                  onClick={handleCrossClick}
                />
              </>
            )}
          </div>
        </div>

        <ul className="side-menu top">
          {filteredMenuData.map(({ icon, title, path }, i) => (
            <li key={i}>
              <NavLink
                to={path}
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={(e) => {
                  if (onNavigation) {
                    e.preventDefault();
                    onNavigation(path);
                  }
                }}
              >
                <span className="menu-icon">{icon}</span>
                <span className="menu-title">{title}</span>
              </NavLink>
            </li>
          ))}

          {isLoggedIn && (
            <li className="logout-menu-item">
              <button className="sidebar-logout-btn" onClick={handleLogout}>
                <BiLogOut />
                <span>Logout</span>
              </button>
            </li>
          )}
        </ul>
      </div>

      <div id="content">
        <nav>
          <div className="nav-main">
            <GiHamburgerMenu
              className="menuIcon"
              onClick={handleHamburgerClick}
            />

            {pageTitle && (
              <div className="page-title">
                {pageTitle}
              </div>
            )}
          </div>

          <div>
            {!isLoggedIn ? (
              <button className="icon-button" onClick={handleLogin} title="Login">
                <BiLogIn />
              </button>
            ) : (
              <div className="profile">
                <div className="profile-icon" title="Account">
                  <FiUser />
                </div>
                <button className="icon-button" onClick={handleLogout} title="Logout">
                  <BiLogOut />
                </button>
              </div>
            )}
          </div>
        </nav>
        {children}
      </div>
    </>
  );
};

export default Navbar;