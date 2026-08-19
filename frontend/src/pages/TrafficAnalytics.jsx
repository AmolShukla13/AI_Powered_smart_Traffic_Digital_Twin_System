import React, { useState, useEffect } from "react";
import { BarChart3, LineChart, PieChart, TrendingUp, Calendar, AlertTriangle, ShieldCheck, MapPin, Clock, HelpCircle, Info, Download, FileSpreadsheet } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./TrafficAnalytics.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function TrafficAnalytics({ videoResults, activeFrameStats, selectedLocation }) {
  const [locations, setLocations] = useState([]);
  const [allLocationNames, setAllLocationNames] = useState([]);
  const [selectedLocName, setSelectedLocName] = useState("");
  const [avgVehicles, setAvgVehicles] = useState(0);
  const [avgDensity, setAvgDensity] = useState(0);
  const [avgTimeSaved, setAvgTimeSaved] = useState(0.0);
  const [avgCo2, setAvgCo2] = useState(0.0);
  const [hourlyProfile, setHourlyProfile] = useState([0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Filters
  const [timeFilter, setTimeFilter] = useState("1h"); // 1h, 6h, 24h, peak
  const [dateFilter, setDateFilter] = useState("today"); // today, yesterday, week

  const assignedLocation = sessionStorage.getItem("assigned_location") || "global";

  // Fetch locations registry
  useEffect(() => {
    fetchLocations(true);
    const interval = setInterval(() => fetchLocations(false), 4000);
    return () => clearInterval(interval);
  }, [selectedLocName, timeFilter, dateFilter]);

  const fetchLocations = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/traffic/locations`);
      if (res.ok) {
        const data = await res.json();
        
        // Extract all location names for selector dropdown
        const names = data.map(loc => loc.name);
        setAllLocationNames(names);

        // Determine active location name to load
        let activeLocName = selectedLocName;
        if (!activeLocName) {
          const citizenLoc = sessionStorage.getItem("active_citizen_location");
          const assignedLoc = sessionStorage.getItem("assigned_location");
          
          activeLocName = citizenLoc 
            || selectedLocation 
            || (assignedLoc && assignedLoc !== "global" ? assignedLoc : "") 
            || (names.length > 0 ? names[0] : "Sitapur Junction");
          
          setSelectedLocName(activeLocName);
        }

        const filtered = data.filter(loc => matchLocationNames(loc.name, activeLocName));
        if (filtered.length === 0 && activeLocName) {
          const activeLocDetailsStr = sessionStorage.getItem("active_citizen_location_details");
          let virtualNode = {
            id: "active-loc",
            name: activeLocName,
            traffic_status: "Low",
            manual_override: false,
            current_density: 15.0,
            is_video_data: false,
            latitude: 27.5785,
            longitude: 80.6586,
            vehicle_counts: { car: 12, bus: 2, truck: 1, motorcycle: 8, bicycle: 2 }
          };
          if (activeLocDetailsStr) {
            try {
              const details = JSON.parse(activeLocDetailsStr);
              virtualNode = { ...virtualNode, ...details };
            } catch (e) {
              console.error("Error parsing virtual location details:", e);
            }
          }
          filtered.push(virtualNode);
        }

        setLocations(filtered);

        const reportsRes = await fetch(`${API_BASE_URL}/traffic/reports?location_name=${encodeURIComponent(activeLocName)}&time_filter=${timeFilter}&date_filter=${dateFilter}`);
        if (reportsRes.ok) {
          const reportData = await reportsRes.json();
          
          setIsLiveActive(reportData.is_live_active);
          setAvgVehicles(reportData.avg_vehicles);
          setAvgDensity(reportData.avg_density);
          setAvgTimeSaved(reportData.avg_time_saved);
          setAvgCo2(reportData.avg_co2);
          setHourlyProfile(reportData.hourly_profile);
        } else {
          setError("Failed to fetch report data from the backend.");
        }
      } else {
        setError("Failed to fetch location registry from database.");
      }
    } catch (err) {
      console.error("Error loading analytics locations:", err);
      setError("Unable to connect to traffic backend API. Retrying connection...");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Format CO2 for readability (e.g. grams vs kg)
  const formatCo2 = (grams) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(2)} kg`;
    }
    return `${Math.round(grams)} grams`;
  };

  // Export report data to CSV format
  const handleExportCSV = () => {
    if (locations.length === 0) return;
    const loc = locations[0];
    const csvRows = [
      ["TrafficTwin AI Digital Twin - Traffic Intelligence Report", ""],
      ["Intersection Name", loc.name],
      ["Generated Timestamp", new Date().toLocaleString()],
      ["Selected Time Range", timeFilter === "1h" ? "Last 1 Hour" : timeFilter === "6h" ? "Last 6 Hours" : timeFilter === "24h" ? "Last 24 Hours" : "Peak Hours Only"],
      ["Selected Date Filter", dateFilter === "today" ? "Today" : dateFilter === "yesterday" ? "Yesterday" : "Last 7 Days"],
      ["", ""],
      ["Core Performance Metric", "Value / Rating"],
      ["Total Vehicles Logged", `${avgVehicles} Units`],
      ["Average Node Congestion Density", `${avgDensity}%`],
      ["Optimized Commute Time Saved", `${avgTimeSaved} Minutes`],
      ["CO2 Emissions Offsets (EPA)", formatCo2(avgCo2)],
      ["", ""],
      ["Vehicle Classification", "Detected Count"],
      ["Cars", hourlyProfile[0]],
      ["Buses", hourlyProfile[1]],
      ["Trucks", hourlyProfile[2]],
      ["Motorcycles", hourlyProfile[3]],
      ["Bicycles", hourlyProfile[4]],
    ];

    const csvContent = csvRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `traffic_report_${loc.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Report Executive Summary
  const handleDownloadReport = () => {
    if (locations.length === 0) return;
    const loc = locations[0];
    
    const timeLabel = timeFilter === "1h" ? "Last 1 Hour" : timeFilter === "6h" ? "Last 6 Hours" : timeFilter === "24h" ? "Last 24 Hours" : "Peak Hours Only";
    const dateLabel = dateFilter === "today" ? "Today" : dateFilter === "yesterday" ? "Yesterday" : "Last 7 Days";
    
    const summaryText = `==================================================
        TRAFFICTWIN AI DIGITAL TWIN EXECUTIVE REPORT
==================================================
Intersection Node : ${loc.name}
Generated At      : ${new Date().toLocaleString()}
Filter Context    : [Date Range: ${dateLabel}] [Time Window: ${timeLabel}]
--------------------------------------------------

1. TRAFFIC CONGESTION & AI PERFORMANCE
   - Total Vehicles Monitored: ${avgVehicles}
   - Average Congestion Density: ${avgDensity}%
   - Time Saved by AI Signal Tuning: ${avgTimeSaved} minutes
   - Carbon Offset (CO2 Saved): ${formatCo2(avgCo2)}

2. AI NEURAL CLASS DETECTIONS
   - Cars        : ${hourlyProfile[0]}
   - Buses       : ${hourlyProfile[1]}
   - Trucks      : ${hourlyProfile[2]}
   - Motorcycles : ${hourlyProfile[3]}
   - Bicycles    : ${hourlyProfile[4]}

3. SYSTEM ADVISORY RECOMMENDATION
   - Congestion Level Status: ${avgDensity >= 70 ? "CRITICAL BOTTLE-NECK" : avgDensity >= 30 ? "OPTIMIZATION SUGGESTED" : "OPTIMAL"}
   - AI Recommended Action  : ${avgDensity >= 70 
       ? "Congestion peak detected. Extend northbound green phase cycle by 18 seconds immediately." 
       : avgDensity >= 30 
       ? "Moderate queue detected. AI recommended to prioritize lane merge lanes for dynamic clearing." 
       : "Traffic is flowing smoothly. Maintain AI autonomous mode."}

==================================================
          TRAFFICTWIN COMMAND SYSTEMS
==================================================`;

    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `executive_summary_${loc.name.replace(/\s+/g, "_")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCitizenLoc = selectedLocName;

  // Dynamic status configurations
  const statusLabel = activeCitizenLoc 
    ? `📍 MONITORED AREA: ${activeCitizenLoc.toUpperCase()}`
    : "🌐 SELECT INTERSECTION SYSTEM GATEWAY";
  const statusColor = "var(--color-cyan)";

  const chartLabels = ["Cars", "Buses", "Trucks", "Motorcycles", "Bicycles"];

  return (
    <div className="analytics-container">
      
      {/* Header controls bar */}
      <div className="analytics-header glass-panel" style={{ flexWrap: "wrap", gap: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="analytics-header-meta" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <BarChart3 className="analytics-header-icon text-glow-cyan" />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", letterSpacing: "1px" }}>AI TRAFFIC INTELLIGENCE REPORT</h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>1-Hour rolling average traffic stats, carbon savings, and signal bottlenecks.</p>
          </div>
        </div>

        {/* Live Filter Controls */}
        <div className="analytics-controls" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          
          {/* Location Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>SELECT INTERSECTION</span>
            <select
              value={selectedLocName}
              onChange={(e) => setSelectedLocName(e.target.value)}
              style={{
                background: "rgba(10, 14, 23, 0.85)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                cursor: "pointer",
                outline: "none",
                fontFamily: "var(--font-mono)"
              }}
            >
              {allLocationNames.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Time Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>TIME DURATION</span>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              style={{
                background: "rgba(10, 14, 23, 0.85)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                cursor: "pointer",
                outline: "none",
                fontFamily: "var(--font-mono)"
              }}
            >
              <option value="1h">Last 1 Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="peak">Peak Hours Only</option>
            </select>
          </div>

          {/* Date Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>DATE RANGE</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                background: "rgba(10, 14, 23, 0.85)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                cursor: "pointer",
                outline: "none",
                fontFamily: "var(--font-mono)"
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
            </select>
          </div>

          {/* Export Actions */}
          <div style={{ display: "flex", gap: "6px", alignSelf: "flex-end" }}>
            <button 
              onClick={handleExportCSV} 
              className="glow-btn-cyan"
              disabled={!isLiveActive}
              title={isLiveActive ? "Export report details to CSV sheet" : "No report data to export"}
              style={{ 
                padding: "8px 10px", 
                display: "flex", 
                alignItems: "center", 
                gap: "5px", 
                fontSize: "0.75rem", 
                background: isLiveActive ? "rgba(0, 240, 255, 0.05)" : "transparent", 
                border: isLiveActive ? "1px solid var(--color-cyan)" : "1px solid var(--glass-border)",
                opacity: isLiveActive ? 1 : 0.5,
                cursor: isLiveActive ? "pointer" : "not-allowed"
              }}
            >
              <FileSpreadsheet size={13} />
              <span>CSV</span>
            </button>
            <button 
              onClick={handleDownloadReport} 
              className="glow-btn-cyan"
              disabled={!isLiveActive}
              title={isLiveActive ? "Download executive report text" : "No report data to download"}
              style={{ 
                padding: "8px 10px", 
                display: "flex", 
                alignItems: "center", 
                gap: "5px", 
                fontSize: "0.75rem",
                background: isLiveActive ? "rgba(0, 240, 255, 0.05)" : "transparent", 
                border: isLiveActive ? "1px solid var(--color-cyan)" : "1px solid var(--glass-border)",
                opacity: isLiveActive ? 1 : 0.5,
                cursor: isLiveActive ? "pointer" : "not-allowed"
              }}
            >
              <Download size={13} />
              <span>EXECUTIVE REPORT</span>
            </button>
          </div>

        </div>
      </div>

      {/* Loading & Error Overlays */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px", color: "var(--color-cyan)", gap: "10px", margin: "15px 0" }} className="glass-panel">
          <span className="logo-pulse-icon">⚡</span>
          <span style={{ fontSize: "0.8rem", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>RETRIEVING DYNAMIC NETWORK REPORTS...</span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255, 51, 51, 0.08)", border: "1px solid rgba(255, 51, 51, 0.3)", color: "var(--color-red)", padding: "12px 20px", borderRadius: "6px", margin: "15px 0", fontSize: "0.8rem", fontWeight: "bold" }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {locations.length === 0 && !loading && !error ? (
        <div className="no-sim-output-full glass-card" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginTop: "20px" }}>
          <AlertTriangle size={36} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            📍 Please select or search a location on the main map dashboard to view its live AI traffic intelligence report.
          </p>
        </div>
      ) : !isLiveActive && !loading && !error ? (
        <div className="no-output glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center", marginTop: "20px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
          <BarChart3 size={64} className="no-output-icon" style={{ color: "var(--color-cyan)", opacity: 0.7, marginBottom: "20px" }} />
          <h3 style={{ fontSize: "1.5rem", color: "var(--text-primary)", marginBottom: "10px" }}>No traffic analysis available</h3>
          <p style={{ color: "var(--text-muted)", maxWidth: "450px", fontSize: "0.9rem", lineHeight: "1.5" }}>
            Upload and process a traffic video for this location to generate a report.
          </p>
        </div>
      ) : (
        !loading && locations.length > 0 && (
          <>
            {/* Grid of 4 Stats Cards */}
            <div className="analytics-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginTop: "20px", marginBottom: "20px" }}>
              <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
                <TrendingUp className="stat-icon" style={{ color: "var(--color-cyan)", width: "24px", height: "24px" }} />
                <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>VEHICLES MEASURED</span>
                <span className="val font-mono" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px" }}>
                  {avgVehicles}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Classified Count in Window</span>
              </div>

              <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
                <Clock className="stat-icon" style={{ color: "var(--color-green)", width: "24px", height: "24px" }} />
                <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>CONGESTION DENSITY</span>
                <span className="val font-mono text-glow-green" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-green)" }}>
                  {avgDensity}%
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Mean Intersection Capacity</span>
              </div>

              <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
                <ShieldCheck className="stat-icon" style={{ color: "var(--color-purple)", width: "24px", height: "24px" }} />
                <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>TIME SAVED BY AI</span>
                <span className="val font-mono text-glow-purple" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-purple)" }}>
                  {avgTimeSaved > 0 ? `${avgTimeSaved} Mins` : "0.0 Mins"}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Green wave signal loops active</span>
              </div>

              <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
                <HelpCircle className="stat-icon" style={{ color: "var(--color-yellow)", width: "24px", height: "24px" }} />
                <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>CO₂ OFFSETS SAVED</span>
                <span className="val font-mono text-glow-yellow" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-yellow)" }}>
                  {formatCo2(avgCo2)}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Idle Emissions Prevented</span>
              </div>
            </div>

            {/* Real-world CO2 Scientific Formula Banner */}
            <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px", background: "rgba(0, 240, 255, 0.02)", border: "1px solid rgba(0, 240, 255, 0.15)", borderRadius: "6px", marginBottom: "20px" }}>
              <Info size={16} style={{ color: "var(--color-cyan)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                <strong>Scientific Calculation formula (EPA Standard)</strong>: Idle delay reduction (15s/vehicle) saves <strong>5.8g CO₂</strong> per Car, <strong>29.2g CO₂</strong> per Bus/Truck, and <strong>2.5g CO₂</strong> per Motorcycle. Emission rates scale dynamically based on the exact vehicle classifications detected in the camera stream.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr", gap: "20px", marginBottom: "20px" }}>
              {/* Left Column: Visual Bar Chart */}
              <div className="glass-panel" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 20px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  📊 LIVE VEHICLE CLASSIFICATION (AI CAMERA DETECTED)
                </h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "180px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {hourlyProfile.map((val, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1 }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        {val}
                      </div>
                      <div style={{ 
                        width: "30px", 
                        height: `${Math.min(150, val * 10)}px`, 
                        background: val === 0 ? "rgba(255,255,255,0.02)" : "var(--color-cyan)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.5s ease",
                        boxShadow: val > 0 ? "0 0 10px rgba(0, 240, 255, 0.2)" : "none"
                      }}></div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "8px" }}>{chartLabels[i]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: AI Recommendations */}
              <div className="glass-panel" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 15px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  🤖 AI AGENT BOTTLENECK RECOMMENDATIONS
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "200px", overflowY: "auto" }}>
                  {locations.length > 0 ? (
                    locations.map((loc, idx) => {
                      const density = avgDensity;
                      let rec = "Traffic is flowing smoothly. Maintain AI autonomous mode.";
                      let status = "OPTIMAL";
                      let color = "var(--color-green)";

                      if (density >= 70) {
                        rec = `Congestion peak detected. Extend northbound green phase cycle by 18 seconds immediately.`;
                        status = "CRITICAL BOTTLE-NECK";
                        color = "var(--color-red)";
                      } else if (density >= 30) {
                        rec = `Moderate queue detected. AI recommended to prioritize lane merge lanes for dynamic clearing.`;
                        status = "RECOMMENDED OPTIMIZATION";
                        color = "var(--color-yellow)";
                      }

                      return (
                        <div key={idx} className="glass-card" style={{ padding: "12px", borderLeft: `3px solid ${color}`, background: "rgba(255,255,255,0.01)", border: "1px solid var(--glass-border)", borderRadius: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>{loc.name}</strong>
                            <span style={{ fontSize: "0.65rem", color, fontWeight: "bold", background: "rgba(255,255,255,0.02)", padding: "2px 6px", borderRadius: "3px" }}>
                              {status}
                            </span>
                          </div>
                          <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                            {rec}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Awaiting live video upload to generate optimization insights.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lower full width card: Detailed Traffic breakdown */}
            <div className="glass-panel" style={{ padding: "20px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 15px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                🌐 LIVE INTERSECTION CONGESTION & OPTIMIZATION RATINGS
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {locations.map((loc, idx) => {
                  const density = avgDensity;
                  const status = density >= 70 ? "Critical" : density >= 30 ? "Moderate" : "Optimal";
                  const color = density >= 70 ? "var(--color-red)" : density >= 30 ? "var(--color-yellow)" : "var(--color-green)";

                  return (
                    <div key={idx} className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--glass-border)", borderRadius: "6px" }}>
                      <div style={{ width: "30%" }}>
                        <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{loc.name}</strong>
                        <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                          Coords: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </span>
                      </div>

                      <div style={{ width: "40%", display: "flex", alignItems: "center", gap: "15px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", width: "35px" }}>{density}%</span>
                        <div style={{ flexGrow: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${density}%`, height: "100%", background: color, transition: "width 0.5s ease" }}></div>
                        </div>
                      </div>

                      <div style={{ width: "20%", textAlign: "right" }}>
                        <span style={{ fontSize: "0.75rem", color, fontWeight: "bold" }}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GUIDANCE/USEFULNESS CARD */}
            <div className="glass-panel" style={{ padding: "20px", border: "1px solid rgba(0, 240, 255, 0.1)" }}>
              <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 12px 0", color: "var(--color-cyan)", fontFamily: "var(--font-mono)" }}>
                📚 HOW TO UNDERSTAND THESE CITY TRAFFIC REPORTS
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>1. 1-Hour Rolling Average Statistics (Cards)</strong>
                  <span>Shows average congestion levels and active vehicles in real-time. Citizens can check this to estimate environmental progress (like CO₂ emissions reduced and green waves optimized by AI).</span>
                </div>
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>2. 24H Traffic Volume Profile (Chart)</strong>
                  <span>Provides peak-hour traffic predictions. Citizens can use this chart to identify when the busiest hours occur at their destination, helping plan trips to avoid heavy commuter waves.</span>
                </div>
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>3. AI Bottleneck Recommendations (Status List)</strong>
                  <span>Flags high-congestion points. It gives real-time route optimization insights, letting citizens know which intersections are currently experiencing bottlenecks.</span>
                </div>
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>4. Live Intersection Congestion Ratings (Bottom List)</strong>
                  <span>Provides a real-time congestion-level comparison of all intersections in the city grid. You can view coordinates, live status, and loading bars to pick clear travel corridors.</span>
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
