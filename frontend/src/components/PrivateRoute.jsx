import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children, adminOnly = false }) {
  const token = sessionStorage.getItem("token");
  const role = sessionStorage.getItem("role");

  if (!token) {
    // If not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && role !== "admin") {
    // If route requires admin role but user is citizen, redirect to homepage
    return <Navigate to="/" replace />;
  }

  return children;
}
