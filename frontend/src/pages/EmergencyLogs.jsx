import React, { useState, useEffect } from "react";
import { ListFilter, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import "./EmergencyLogs.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function EmergencyLogs() {
  const [emergencies, setEmergencies] = useState([]);
  const [filter, setFilter] = useState("all");

  const userRole = sessionStorage.getItem("role") || "user";
  const isCitizen = userRole !== "admin";

  useEffect(() => {
    fetchEmergencies();
    const interval = setInterval(fetchEmergencies, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchEmergencies = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/traffic/emergencies`);
      if (res.ok) {
        const data = await res.json();
        const assigned = sessionStorage.getItem("assigned_location");
        const filteredData = assigned
          ? data.filter(e => matchLocationNames(e.start_location, assigned) || matchLocationNames(e.destination_location, assigned) || (e.route && e.route.some(r => matchLocationNames(r, assigned))))
          : data;
        setEmergencies(filteredData);
      }
    } catch (err) {
      console.error("Error loading emergencies:", err);
    }
  };

  const resolveEmergency = async (id) => {
    const token = sessionStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/emergencies/${id}/clear`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchEmergencies();
      }
    } catch (err) {
      console.error("Error resolving emergency dispatch:", err);
    }
  };

  const filteredEmergencies = emergencies.filter(e => {
    if (filter === "all") return true;
    return e.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="logs-container">
      <div className="logs-header glass-panel">
        <div className="logs-header-meta">
          <FileText className="logs-header-icon text-glow-cyan" />
          <div>
            <h1>EMERGENCY DISPATCH RECORDS</h1>
            <p>Log of SOS requests, routed paths, dynamic Dijkstra overrides, and resolution status.</p>
          </div>
        </div>

        <div className="filter-controls">
          <ListFilter size={16} className="filter-icon" />
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)} 
            className="filter-select"
          >
            <option value="all">Show All Logs</option>
            <option value="pending">Pending Dispatch</option>
            <option value="routed">Active / Routed</option>
            <option value="cleared">Cleared / Resolved</option>
          </select>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="diag-stats-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div className="diag-stat-item glass-card" style={{ display: "flex", flexDirection: "column", padding: "16px", alignItems: "center", justifyContent: "center" }}>
          <span className="lbl" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "bold", letterSpacing: "1px" }}>TOTAL DISPATCH LOGS</span>
          <span className="val font-mono" style={{ fontSize: "1.4rem", fontWeight: "800", marginTop: "5px" }}>{filteredEmergencies.length} Requests</span>
        </div>
        <div className="diag-stat-item glass-card" style={{ display: "flex", flexDirection: "column", padding: "16px", alignItems: "center", justifyContent: "center" }}>
          <span className="lbl" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "bold", letterSpacing: "1px" }}>ACTIVE PRIORITIES</span>
          <span className="val font-mono text-glow-red" style={{ fontSize: "1.4rem", fontWeight: "800", marginTop: "5px", color: "var(--color-red)", textShadow: "0 0 10px rgba(255, 51, 51, 0.2)" }}>
            {filteredEmergencies.filter(e => e.status === "Routed" || e.status === "Pending").length} Corridors
          </span>
        </div>
        <div className="diag-stat-item glass-card" style={{ display: "flex", flexDirection: "column", padding: "16px", alignItems: "center", justifyContent: "center" }}>
          <span className="lbl" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "bold", letterSpacing: "1px" }}>RESOLVED INCIDENTS</span>
          <span className="val font-mono text-glow-green" style={{ fontSize: "1.4rem", fontWeight: "800", marginTop: "5px", color: "var(--color-green)", textShadow: "0 0 10px rgba(0, 255, 102, 0.2)" }}>
            {filteredEmergencies.filter(e => e.status === "Cleared" || e.status === "Resolved").length} Cleared
          </span>
        </div>
      </div>

      <div className="logs-card glass-panel">
        <div className="table-responsive">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Service Type</th>
                {!isCitizen && <th>Request ID</th>}
                <th>Origin (Start)</th>
                <th>Destination</th>
                <th>Optimal Route</th>
                <th>Dispatch Status</th>
                <th>Timestamp</th>
                {!isCitizen && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmergencies.map((e) => (
                <tr key={e.id} className={`status-row-${e.status.toLowerCase()}`}>
                  <td className="vehicle-cell">
                    <span className={`vehicle-badge ${e.type.toLowerCase()}`}>
                      {e.type === "Ambulance" ? "🚑 Ambulance" : e.type === "Fire" ? "🚒 Fire Truck" : "🚓 Police"}
                    </span>
                  </td>
                  {!isCitizen && <td className="font-mono text-muted">{e.id.substring(0, 8)}...</td>}
                  <td><strong>{e.start_location || e.start_node}</strong></td>
                  <td><strong>{e.destination_location || e.end_node}</strong></td>
                  <td className="route-cell">
                    {e.route && e.route.length > 0 ? (
                      <div className="route-tags-container">
                        {e.route.map((node, i) => (
                          <span key={i} className="route-node-tag">
                            {node.split(" ")[0]}
                            {i < e.route.length - 1 && <span className="arrow"> → </span>}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">Awaiting Dispatch Plan</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${e.status.toLowerCase()}`}>
                      {e.status === "Pending" ? "Awaiting Route" : e.status === "Routed" ? "Active Dispatch" : "Resolved"}
                    </span>
                  </td>
                  <td className="font-mono text-muted">
                    {new Date(e.created_at || Date.now()).toLocaleTimeString()}
                  </td>
                  {!isCitizen && (
                    <td>
                      {(e.status === "Routed" || e.status === "Pending") ? (
                        <button 
                          onClick={() => resolveEmergency(e.id)} 
                          className="glow-btn-cyan" 
                          style={{ padding: "4px 10px", fontSize: "0.7rem", borderRadius: "4px" }}
                        >
                          Resolve
                        </button>
                      ) : (
                        <span style={{ color: "var(--color-green)", fontSize: "0.75rem", fontWeight: "bold" }}>Resolved ✓</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredEmergencies.length === 0 && (
                <tr>
                  <td colSpan={isCitizen ? 6 : 8} className="no-logs">
                    <ShieldCheck size={32} className="shield-ok" />
                    <p>No emergency logs found matching the filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Mission Details HUD */}
      {(() => {
        const activeMission = filteredEmergencies.find(e => e.status === "Routed" || e.status === "Pending");
        if (activeMission) {
          return (
            <div className="glass-panel" style={{ marginTop: "20px", padding: "20px", border: "1px solid rgba(189, 0, 255, 0.3)", background: "linear-gradient(135deg, rgba(189, 0, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%)", boxShadow: "0 0 15px rgba(189,0,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "10px", marginBottom: "15px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-red)", display: "inline-block" }}></span>
                <h4 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--color-purple)", letterSpacing: "1px" }}>
                  🚨 ACTIVE EMERGENCY CORRIDOR CLEARANCE IN PROGRESS
                </h4>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 1fr", gap: "20px", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold" }}>VEHICLE TYPE & MISSION</div>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)", display: "block", marginTop: "4px" }}>
                    {activeMission.type.toUpperCase()} DISPATCH
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Origin: {activeMission.start_location}</span>
                </div>

                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold", marginBottom: "4px" }}>DIJKSTRA OPTIMIZED CORRIDOR ROUTE</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                    {activeMission.route && activeMission.route.length > 0 ? (
                      activeMission.route.map((node, i) => (
                        <span key={i} style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", fontWeight: "bold" }}>
                          {node}
                          {i < activeMission.route.length - 1 && <span style={{ color: "var(--color-cyan)", marginLeft: "6px" }}> ➡️ </span>}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">Calculating route...</span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--color-green)", fontWeight: "bold" }}>🟢 GREEN LIGHT WAVE</div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Est. 12.4 Min Saved</span>
                  </div>
                  {!isCitizen && (
                    <button 
                      onClick={() => resolveEmergency(activeMission.id)} 
                      className="glow-btn-cyan" 
                      style={{ width: "100%", padding: "8px !important", fontSize: "0.75rem !important", borderRadius: "4px" }}
                    >
                      Resolve Mission
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        } else {
          return (
            <div className="glass-panel" style={{ marginTop: "20px", padding: "20px", display: "flex", alignItems: "center", gap: "12px", border: "1px dashed var(--glass-border)" }}>
              <ShieldCheck size={24} style={{ color: "var(--color-green)" }} />
              <div>
                <strong style={{ fontSize: "0.85rem", color: "var(--color-green)", display: "block" }}>🛡️ EMERGENCY CORRIDOR RADAR: ACTIVE STANDBY</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>All local routes clear. Standing by for Citizen SOS priority signal dispatches.</span>
              </div>
            </div>
          );
        }
      })()}
    </div>
  );
}
