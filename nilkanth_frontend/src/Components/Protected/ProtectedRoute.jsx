import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const [status, setStatus] = useState("checking"); // checking | ok | invalid

  useEffect(() => {
    // No token → mark invalid
    if (!token) {
      setStatus("invalid");
      return;
    }

    // Call /me to verify token with backend
    axios
      .get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => setStatus("ok"))
      .catch(() => {
        // Token invalid / expired / user deleted
        localStorage.removeItem("token");
        localStorage.removeItem("permissions");
        localStorage.removeItem("user");
        setStatus("invalid");
      });
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  if (status === "checking") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#dfeafb",
          fontSize: "15px",
          color: "#666",
          fontFamily: "Segoe UI, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (status === "invalid") return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;