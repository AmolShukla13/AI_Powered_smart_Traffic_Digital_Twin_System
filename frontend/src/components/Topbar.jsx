import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Activity, ShieldAlert, Cpu, Database } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./Topbar.css";

export default function Topbar() {
  const location = useLocation();
  const [emergencies, setEmergencies] = useState([]);
  const [dbConnected, setDbConnected] = useState(true);

  // Determine page title
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Digital Twin Topology Map";
      case "/admin":
        return "Traffic Control Room Dashboard";
      case "/video-demo":
        return "YOLOv8 AI Video Analytics";
      case "/accident-reports":
        return "Accident Prediction Risk Center";
      case "/diagnostics":
        return "System Diagnostic Log";
      case "/emergencies":
        return "Emergency SOS Records & Routing";
      case "/analytics":
        return "AI Traffic Intelligence Reports";
      case "/profile":
        return "Admin Profile & Security Settings";
      case "/cctv-monitor":
        return "CCTV Live Network Monitor";
      default:
        return "Traffic Command Center";
    }
  };

  // Fetch emergencies to check pending alerts
  const fetchEmergencies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/traffic/emergencies`);
      if (res.ok) {
        const data = await res.json();
        setEmergencies(data);
        setDbConnected(true);
      }
    } catch (err) {
      setDbConnected(false);
    }
  };

  useEffect(() => {
    fetchEmergencies();
    const interval = setInterval(fetchEmergencies, 4000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = emergencies.filter(e => e.status === "Pending").length;

  return (
    <header className="topbar glass-panel">
      <div className="topbar-left">
        <h2 className="topbar-title font-mono">{getPageTitle()}</h2>
      </div>

      <div className="topbar-right">
        {/* Active emergencies ticker */}
        {pendingCount > 0 && (
          <div className="emergencies-alert-badge">
            <ShieldAlert size={14} className="alert-icon-pulse" />
            <span>{pendingCount} EMERGENCY SOS PENDING</span>
          </div>
        )}

        {/* Database Status indicator */}
        <div className={`status-indicator-badge ${dbConnected ? "online" : "offline"}`}>
          <Database size={12} />
          <span>ATLAS DB: {dbConnected ? "ONLINE" : "OFFLINE"}</span>
        </div>

        {/* AI Model Status */}
        <div className="status-indicator-badge model">
          <Cpu size={12} />
          <span>AI MODEL: YOLOv8n</span>
        </div>
      </div>
    </header>
  );
}
