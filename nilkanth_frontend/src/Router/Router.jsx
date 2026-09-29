import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
// import Home from "../Pages/Home/Home";
import Customer from "../Pages/Customer/Customer";
import Items from "../Pages/Items/Items";

import Inventory from "../Pages/Inventory/Inventory";

import Register from "../Pages/Authentication/Register/Register";
import Login from "../Pages/Authentication/Login/Login";
import ProtectedRoute from "../Components/Protected/ProtectedRoute";
import AdminUsers from "../Pages/Authentication/Admin/AdminUsers";
import SmartRedirect from "./SmartRedirect"; // ADD THIS
import Footer from "../Components/Footer/Footer";
import ProductReports from "../Pages/ProductsReports/ProductReports";
import Purchase from "../Pages/Purchase/Purchase";
import Sales from "../Pages/Sales/Sales";
import Quotation from "../Pages/Quotation/Quotation";
import Repairing from "../Pages/Repairing/Repairing";
import AMC from "../Pages/AMC/AMC";
import Stamping from "../Pages/Stamping/Stamping";
import CustomerHistory from "../Pages/CustomerHistory/CustomerHistory";



const Router = () => {
  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}>
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            
            <Route path="/" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">  
                  <Sales />
                </PermissionRoute>
              </ProtectedRoute>
            } />


            <Route path="/customer" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="customer">
                  <Customer />
                </PermissionRoute>
              </ProtectedRoute>
            } />



            <Route path="/items" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="products">
                  <Items />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/purchase" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="purchase">
                  <Purchase />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/invoice" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">
                  <Sales />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/quotation" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">
                  <Quotation />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/repairing" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">
                  <Repairing />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/amc" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="amc">
                  <AMC />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            <Route path="/stamping" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="amc">
                  <Stamping />
                </PermissionRoute>
              </ProtectedRoute>
            } />


            <Route path="/inventory" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="inventory">
                  <Inventory />
                </PermissionRoute>
              </ProtectedRoute>
            } />



            <Route path="/admin" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="admin">
                  <AdminUsers />
                </PermissionRoute>
              </ProtectedRoute>
            } />



            <Route path="/report" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="report">
                  <ProductReports />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="report">
                  <CustomerHistory />
                </PermissionRoute>
              </ProtectedRoute>
            } />

          </Routes>
        </div>
        <Footer />
      </div>
    </>
  );
};

// PermissionRoute Component (Add this in the same file or separate)
const PermissionRoute = ({ children, requiredPermission }) => {
  const userPermissions = JSON.parse(localStorage.getItem("permissions") || "[]");

  // Admin can access everything
  if (userPermissions.includes("admin")) {
    return children;
  }

  // If `requiredPermission` is a string
  if (typeof requiredPermission === "string" && userPermissions.includes(requiredPermission)) {
    return children;
  }

  // If `requiredPermission` is an array (multiple options allowed)
  if (Array.isArray(requiredPermission) && requiredPermission.some(p => userPermissions.includes(p))) {
    return children;
  }

  // No access → redirect to SmartRedirect
  return <SmartRedirect />;
};

// TEMPORARY FIX - REMOVE AFTER CREATING ADMIN USER
// const PermissionRoute = ({ children, requiredPermission }) => {
//   // TEMPORARILY ALLOW ALL ACCESS - COMMENT THIS OUT AFTER CREATING ADMIN
//   return children;

//   // ORIGINAL CODE - UNCOMMENT AFTER CREATING ADMIN
//   // const userPermissions = JSON.parse(localStorage.getItem("permissions") || "[]");
//   // if (userPermissions.includes("admin") || userPermissions.includes(requiredPermission)) {
//   //   return children;
//   // }
//   // return <SmartRedirect />;
// };

export default Router;