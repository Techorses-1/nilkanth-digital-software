import React, { useState, useEffect } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";

// Icon imports
import { BiLogOut, BiLayout, BiLogIn } from "react-icons/bi";
import { TbUsers } from "react-icons/tb";
import { LuFile } from "react-icons/lu";
import { PiBasket } from "react-icons/pi";
import { GiHamburgerMenu } from "react-icons/gi";
import { RxCross1 } from "react-icons/rx";
import { FiUser } from "react-icons/fi";
import { MdDiscount } from "react-icons/md";

import logo from "../../Assets/logo/logo.png";
import "./Navbar.css";

const Navbar = ({
  children,
  onNavigation,
  isCollapsed = false,
  onToggleCollapse,
  // New prop for page-specific dashboard
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
      case '/customer':
        return 'Customer Dashboard';
      case '/purchase':
        return 'Purchase Management';
      case '/items':
        return 'Products Management';
      case '/inventory':
        return 'Inventory Management';
      case '/dashboard':
        return 'Dashboard';
      case '/admin':
        return 'Admin Management Dashboard';
      case '/productdiscount':
        return 'Discount Dashboard';
      case '/defective':
        return 'Product Disposal Dashboard';
      case '/report':
        return 'Business Reports And Analytics';
      case '/':
        return 'Reports Dashboard';
      default:
        return '';
    }
  };

  const pageTitle = getPageTitle();

  // Define all possible menu items with their required permissions
  const allMenuData = [
    { icon: <PiBasket />, title: "Reports", path: "/", permission: "invoice" },
    // { icon: <HiOutlineHome />, title: "Dashboard", path: "/dashboard", permission: "dashboard" }, 
    { icon: <TbUsers />, title: "Customer", path: "/customer", permission: "customer" },
    { icon: <TbUsers />, title: "Vendor", path: "/vendor", permission: "customer" },
    { icon: <LuFile />, title: "Products", path: "/items", permission: "products" },
    { icon: <TbUsers />, title: "Purchase", path: "/purchase", permission: "purchase" },
    { icon: <MdDiscount />, title: "Sales", path: "/invoice", permission: "invoice" },
    { icon: <BiLayout />, title: "Inventory", path: "/inventory", permission: "inventory" },
    { icon: <BiLayout />, title: "Admin", path: "/admin", permission: "admin" },
    // { icon: <TbTrash  />, title: "Product Disposal", path: "/defective", permission: "disposal" }, 
    // { icon: <TbReportAnalytics  />, title: "Report", path: "/report", permission: "report" },
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

            {/* Page-specific dashboard controls */}
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