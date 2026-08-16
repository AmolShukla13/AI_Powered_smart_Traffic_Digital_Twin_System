import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Activity, Shield, LogOut, Video, ActivitySquare, AlertTriangle, User } from "lucide-react";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const token = sessionStorage.getItem("token");
  const username = sessionStorage.getItem("username");
  const role = sessionStorage.getItem("role");

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("assigned_location");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("assigned_location");
    navigate("/login");
  };

  const isActive = (path) => {
    return location.pathname === path ? "active" : "";
  };

  return (
    <nav className="navbar glass-panel">
      <div className="nav-brand" onClick={() => navigate("/")}>
        <Activity className="nav-logo-icon text-glow-cyan" />
        <span className="nav-title">
          TRAFFIC<span className="text-glow-cyan">TWIN</span> <span className="ai-badge">AI</span>
        </span>
      </div>

      <div className="nav-links">
        <Link to="/" className={`nav-item ${isActive("/")}`}>
          <ActivitySquare size={18} />
          <span>Portal</span>
        </Link>

        {token && role === "admin" && (
          <Link to="/admin" className={`nav-item ${isActive("/admin")}`}>
            <Shield size={18} />
            <span>Admin Control</span>
          </Link>
        )}

        <Link to="/video-demo" className={`nav-item ${isActive("/video-demo")}`}>
          <Video size={18} />
          <span>Video Demo</span>
        </Link>

        <Link to="/accident-reports" className={`nav-item ${isActive("/accident-reports")}`}>
          <AlertTriangle size={18} />
          <span>Risk Analytics</span>
        </Link>
      </div>

      <div className="nav-user-actions">
        {token ? (
          <div className="user-profile">
            <User size={16} className="user-icon" />
            <div className="user-info">
              <span className="username">{username}</span>
              <span className={`user-role-badge ${role}`}>{role}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn" title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => navigate("/login")} className="glow-btn-cyan login-nav-btn">
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
