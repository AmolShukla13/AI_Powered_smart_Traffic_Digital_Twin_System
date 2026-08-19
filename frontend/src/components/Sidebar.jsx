import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Activity, Shield, Video, AlertTriangle, LogOut, User, ActivitySquare, HeartPulse, FileText, BarChart3, Camera, MapPin, Receipt, TrafficCone } from "lucide-react";
import "./Sidebar.css";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const token = sessionStorage.getItem("token");
  const username = sessionStorage.getItem("username");
  const role = sessionStorage.getItem("role");
  const assignedLocation = sessionStorage.getItem("assigned_location");

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
    <>
      <aside className="sidebar glass-panel">
      {/* Brand Header */}
      <div className="sidebar-brand" onClick={() => navigate("/")}>
        <Activity className="brand-logo text-glow-cyan" />
        <div className="brand-meta">
          <span className="brand-title">
            TRAFFIC<span className="text-glow-cyan">TWIN</span>
          </span>
          <span className="brand-subtitle">AI DIGITAL TWIN</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        <button onClick={() => navigate("/")} className={`nav-link-btn ${isActive("/")}`}>
          <ActivitySquare size={20} />
          <span>Topology Portal</span>
        </button>

        {token && role === "admin" && (
          <button onClick={() => navigate("/admin")} className={`nav-link-btn ${isActive("/admin")}`}>
            <Shield size={20} />
            <span>Admin Control</span>
          </button>
        )}

        {token && role === "admin" && (
          <button onClick={() => navigate("/video-demo")} className={`nav-link-btn ${isActive("/video-demo")}`}>
            <Video size={20} />
            <span>AI Video Analytics</span>
          </button>
        )}

        <button onClick={() => navigate("/challans")} className={`nav-link-btn ${isActive("/challans")}`}>
          <Receipt size={20} />
          <span>E-Challan Registry</span>
        </button>

        <button onClick={() => navigate("/accident-reports")} className={`nav-link-btn ${isActive("/accident-reports")}`}>
          <AlertTriangle size={20} />
          <span>Risk Analytics</span>
        </button>

        <button onClick={() => navigate("/diagnostics")} className={`nav-link-btn ${isActive("/diagnostics")}`}>
          <HeartPulse size={20} />
          <span>System Diagnostics</span>
        </button>

        <button onClick={() => navigate("/emergencies")} className={`nav-link-btn ${isActive("/emergencies")}`}>
          <FileText size={20} />
          <span>Emergency Records</span>
        </button>

        <button onClick={() => navigate("/analytics")} className={`nav-link-btn ${isActive("/analytics")}`}>
          <BarChart3 size={20} />
          <span>AI Traffic Reports</span>
        </button>

        <button onClick={() => navigate("/transit-alerts")} className={`nav-link-btn ${isActive("/transit-alerts")}`}>
          <TrafficCone size={20} />
          <span>Signal & Transit Alerts</span>
        </button>

        {token && (
          <button onClick={() => navigate("/profile")} className={`nav-link-btn ${isActive("/profile")}`}>
            <User size={20} />
            <span>Profile & Settings</span>
          </button>
        )}
      </nav>

      {/* User Section at Bottom */}
      <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {token ? (
          <>
            <div 
              className="sidebar-user-panel glass-card"
              style={{ 
                cursor: "pointer", 
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(18, 26, 43, 0.4)",
                border: "1px solid var(--glass-border)",
                transition: "all 0.3s ease"
              }}
              onClick={() => navigate("/officer-id")}
            >
              <div className="user-avatar" style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(0, 240, 255, 0.05)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-cyan)",
                flexShrink: 0
              }}>
                <User size={20} />
              </div>
              <div className="user-details" style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span className="user-name" style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>{username}</span>
                  <span className={`role-tag ${role || ""}`} style={{ 
                    fontSize: "0.55rem", 
                    fontWeight: "950", 
                    padding: "1px 5px", 
                    borderRadius: "3px", 
                    background: "rgba(255, 183, 0, 0.12)", 
                    color: "var(--color-yellow)", 
                    border: "1px solid rgba(255, 183, 0, 0.3)",
                    letterSpacing: "0.5px"
                  }}>{role ? role.toUpperCase() : ""}</span>
                </div>
                {assignedLocation && (
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                    <MapPin size={10} style={{ color: "var(--color-cyan)" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assignedLocation}</span>
                  </span>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className="nav-link-btn logout-btn-full"
              style={{
                border: "1px solid rgba(255, 51, 51, 0.3)",
                background: "rgba(255, 51, 51, 0.02)",
                color: "var(--color-red)",
                justifyContent: "center",
                gap: "8px",
                fontWeight: "bold",
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
            >
              <LogOut size={16} />
              <span>SECURE LOGOUT</span>
            </button>
          </>
        ) : (
          <button onClick={() => navigate("/login")} className="glow-btn-cyan login-btn">
            Connect Node
          </button>
        )}
      </div>
    </aside>

    {/* Logout Confirmation Modal Overlay */}
    {showLogoutConfirm && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}>
        <div className="glass-panel" style={{ padding: "30px", width: "400px", textAlign: "center", border: "1px solid rgba(255, 51, 51, 0.4)", boxShadow: "0 0 20px rgba(255, 51, 51, 0.1)" }}>
          <h3 style={{ margin: "0 0 15px 0", color: "var(--color-red)", letterSpacing: "1px", fontFamily: "var(--font-mono)", fontSize: "1.1rem" }}>
            ⚠️ SECURE DISCONNECT INITIATED
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "25px" }}>
            Are you sure you want to terminate the secure traffic orchestration session for officer <strong>{username}</strong>?
          </p>
          <div style={{ display: "flex", gap: "15px" }}>
            <button 
              onClick={handleLogout} 
              className="glow-btn-cyan" 
              style={{ flex: 1, padding: "10px", background: "rgba(255,51,51,0.08)", border: "1px solid var(--color-red)", color: "var(--color-red)", fontWeight: "bold" }}
            >
              Disconnect
            </button>
            <button 
              onClick={() => setShowLogoutConfirm(false)} 
              className="glow-btn-cyan" 
              style={{ flex: 1, padding: "10px", fontWeight: "bold" }}
            >
              Keep Session
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
