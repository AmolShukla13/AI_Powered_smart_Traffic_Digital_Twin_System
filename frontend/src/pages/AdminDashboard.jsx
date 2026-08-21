import React, { useState, useEffect } from "react";
import { Shield, MapPin, Sliders, ToggleLeft, ToggleRight, Radio, RefreshCw, AlertTriangle, PlusCircle, Save, Ambulance, CheckCircle2, Navigation, Search, Lock, Cpu, Activity } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./AdminDashboard.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => {
    if (typeof str !== "string") return "";
    return str.toLowerCase()
      .replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };
  const cleanA = clean(nameA);
  const cleanB = clean(nameB);
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
};

export default function AdminDashboard({ selectedLocation, setSelectedLocation }) {
  const [locations, setLocations] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Emergency requests states
  const [emergencies, setEmergencies] = useState([]);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState("");

  // Form states for overriding
  const [manualOverride, setManualOverride] = useState(false);
  const [trafficStatus, setTrafficStatus] = useState("Low");
  const [redTime, setRedTime] = useState(30);
  const [greenTime, setGreenTime] = useState(30);
  const [yellowTime, setYellowTime] = useState(5);

  // New location creation states (Global admin power)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocLat, setNewLocLat] = useState("");
  const [newLocLng, setNewLocLng] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveAccuracy, setLiveAccuracy] = useState(98.2);

  const token = sessionStorage.getItem("token");
  const assignedLocation = sessionStorage.getItem("assigned_location");

  const selectedLocRef = React.useRef(selectedLoc);
  const selectedLocationRef = React.useRef(selectedLocation);

  useEffect(() => {
    selectedLocRef.current = selectedLoc;
  }, [selectedLoc]);

  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  useEffect(() => {
    fetchAdminStatus();
    fetchLocations();
    fetchEmergencies();
    
    // Background polling every 1.5 seconds to fetch fresh traffic density and emergencies
    const interval = setInterval(() => {
      fetchEmergencies();
      fetchLocations(true); // background silent fetch
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Sync local selectedLoc when global selectedLocation changes
  useEffect(() => {
    if (selectedLocation && locations.length > 0) {
      const matched = locations.find(l => matchLocationNames(l.name, selectedLocation));
      if (matched && matched.name !== selectedLocRef.current?.name) {
        handleSelectLocation(matched);
      }
    }
  }, [selectedLocation, locations]);

  // AI Accuracy is kept fixed and stable as requested by user


  const fetchEmergencies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/traffic/emergencies`);
      if (res.ok) {
        const data = await res.json();
        setEmergencies(data);
      }
    } catch (err) {
      console.error("Error fetching emergencies:", err);
    }
  };

  const handleDispatchRoute = async (emergency) => {
    setRoutingLoading(true);
    setRoutingError("");
    try {
      // Step 1: Calculate route using Dijkstra
      const routeRes = await fetch(
        `${API_BASE_URL}/traffic/calculate-route?start=${encodeURIComponent(emergency.start_location)}&destination=${encodeURIComponent(emergency.destination_location)}`
      );
      const routeData = await routeRes.json();
      if (!routeRes.ok) {
        throw new Error(routeData.detail || "Route calculation failed");
      }
      
      // Step 2: Deploy route to emergency
      const deployRes = await fetch(
        `${API_BASE_URL}/admin/emergencies/${emergency.id}/route`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(routeData.route)
        }
      );
      
      if (!deployRes.ok) {
        const deployData = await deployRes.json();
        throw new Error(deployData.detail || "Route deployment failed");
      }
      
      alert(`Priority Emergency Route Dispatched: ${routeData.route.join(" ➡️ ")}`);
      fetchEmergencies();
    } catch (err) {
      setRoutingError(err.message);
      alert(err.message);
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleClearEmergency = async (emergencyId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/emergencies/${emergencyId}/clear`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (res.ok) {
        alert("Emergency incident cleared!");
        fetchEmergencies();
      } else {
        const data = await res.json();
        alert(data.detail || "Clear operation failed");
      }
    } catch (err) {
      alert("Error clearing emergency: " + err.message);
    }
  };

  const fetchAdminStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminStatus(data);
      }
    } catch (err) {
      console.error("Error fetching admin status:", err);
    }
  };
  const fetchLocations = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/traffic/locations`);
      const data = await res.json();
      setLocations(data);

      // Handle location selection
      if (data.length > 0) {
        const targetName = selectedLocationRef.current || assignedLocation || data[0].name;
        const currentLoc = data.find(l => matchLocationNames(l.name, targetName)) || data[0];
        
        // Always update selected node telemetry info
        setSelectedLoc(currentLoc);
        if (setSelectedLocation && !selectedLocationRef.current) {
          setSelectedLocation(currentLoc.name);
        }

        // Only overwrite form inputs (sliders/override status) on manual select or first load
        if (!isBackground || !selectedLocRef.current) {
          setManualOverride(currentLoc.manual_override);
          setTrafficStatus(currentLoc.traffic_status);
          setRedTime(currentLoc.red_time);
          setGreenTime(currentLoc.green_time);
          setYellowTime(currentLoc.yellow_time);
        }
      }
    } catch (err) {
      console.error("Error fetching locations:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSelectLocation = (loc) => {
    setSelectedLoc(loc);
    if (setSelectedLocation) {
      setSelectedLocation(loc.name);
    }
    setManualOverride(loc.manual_override);
    setTrafficStatus(loc.traffic_status);
    setRedTime(loc.red_time);
    setGreenTime(loc.green_time);
    setYellowTime(loc.yellow_time);
  };

  const handleUpdateOverride = async (e) => {
    e.preventDefault();
    if (!selectedLoc) return;
    
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/locations/${selectedLoc.name}/override`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          manual_override: manualOverride,
          traffic_status: manualOverride ? trafficStatus : null,
          red_time: Number(redTime),
          green_time: Number(greenTime),
          yellow_time: Number(yellowTime)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update overrides.");
      }

      alert("Grid parameters synchronized successfully!");
      fetchLocations();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    if (!newLocName || !newLocLat || !newLocLng) {
      setAddError("Please fill in all coordinates.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newLocName,
          latitude: Number(newLocLat),
          longitude: Number(newLocLng),
          traffic_status: "Low",
          manual_override: false,
          red_time: 30,
          green_time: 30,
          yellow_time: 5
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to add location.");
      }

      setAddSuccess(`Node '${newLocName}' initialized successfully!`);
      setNewLocName("");
      setNewLocLat("");
      setNewLocLng("");
      fetchLocations();
      setTimeout(() => setShowAddForm(false), 2000);
    } catch (err) {
      setAddError(err.message);
    }
  };

  const getStatusClass = (status) => {
    return status?.toLowerCase() || "low";
  };

  // Determine if this police admin is authorized to override this intersection
  const isAuthorized = !assignedLocation || matchLocationNames(assignedLocation, selectedLoc?.name);

  // Filter emergencies to only show to relevant admins whose node lies along the dispatch route
  const activeEmergencies = emergencies.filter(e => {
    // If the emergency is cleared, we don't show it in the warning/active consoles
    if (e.status === "Cleared") return false;
    
    // If the admin is assigned to a specific location, only show the emergency if their location is part of the route
    if (assignedLocation) {
      return e.route && e.route.includes(assignedLocation);
    }
    return true; // Global admin sees everything
  });

  return (
    <div className="admin-container">
      {/* Admin Panel Header */}
      <div className="admin-header glass-panel">
        <div className="admin-header-meta">
          <Shield className="admin-header-icon text-glow-yellow" />
          <div>
            <h1>TRAFFIC CONTROL ROOM</h1>
            <p>Authorized Admin Controls & AI Override Management Console</p>
          </div>
        </div>

        {adminStatus && (
          <div className="admin-badge-row">
            <div className="admin-meta-info">
              <span>ADMIN HOST: <strong className="font-mono">{adminStatus.admin_username}</strong></span>
              <span>GRID NODES: <strong className="font-mono">{adminStatus.total_locations}</strong></span>
            </div>
            {assignedLocation ? (
              <span className="location-auth-tag restricted">POLICE INTERSECTION AUTH: {assignedLocation}</span>
            ) : (
              <span className="location-auth-tag unrestricted">GLOBAL GRID ACCESS ROOT</span>
            )}
          </div>
        )}
      </div>

      {/* global SOS warning banner */}
      {activeEmergencies.some(e => e.status === "Pending") && (
        <div className="global-emergency-banner-alert" style={{
          background: "rgba(255, 0, 85, 0.15)",
          border: "2px solid #ff0055",
          borderRadius: "8px",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          animation: "emergencyPulse 1.5s infinite alternate",
          marginBottom: "20px",
          marginTop: "10px"
        }}>
          <AlertTriangle size={24} style={{ color: "#ff0055" }} />
          <div style={{ flexGrow: 1 }}>
            <h4 style={{ margin: 0, color: "#ff0055", fontSize: "1.05rem" }}>⚠️ CRITICAL SOS DISPATCH REQUESTS PENDING</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)" }}>
              One or more emergency vehicle priority routing requests are pending! Solve Dijkstra routing coordinates immediately to clear traffic jams.
            </p>
          </div>
        </div>
      )}

      {/* Grid panels */}
      <div className="admin-grid">
        {/* Left Side: Nodes Selector */}
        <div className="admin-grid-left glass-panel">
          <div className="admin-panel-title">
            <h3>ACTIVE NODE REGISTRY</h3>
            <div className="action-buttons">
              {!assignedLocation && (
                <button className="add-node-btn" onClick={() => setShowAddForm(!showAddForm)} title="Add Intersection">
                  <PlusCircle size={16} />
                </button>
              )}
              <button className="refresh-btn" onClick={fetchLocations}>
                <RefreshCw size={14} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Node Add Form */}
          {showAddForm && (
            <form onSubmit={handleCreateLocation} className="add-node-form glass-card animated-field">
              <h5>INITIALIZE NEW INTERSECTION</h5>
              {addError && <div className="add-node-err">{addError}</div>}
              {addSuccess && <div className="add-node-success">{addSuccess}</div>}
              
              <div className="form-row">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Intersection Name" 
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-row split">
                <input 
                  type="number" 
                  step="0.0001" 
                  className="form-input" 
                  placeholder="Latitude" 
                  value={newLocLat}
                  onChange={(e) => setNewLocLat(e.target.value)}
                  required 
                />
                <input 
                  type="number" 
                  step="0.0001" 
                  className="form-input" 
                  placeholder="Longitude" 
                  value={newLocLng}
                  onChange={(e) => setNewLocLng(e.target.value)}
                  required 
                />
              </div>
              <button type="submit" className="glow-btn-cyan submit-node-btn">Initialize</button>
            </form>
          )}

          {/* Search Bar */}
          {!assignedLocation && (
            <div className="search-bar-container">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search intersection node..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Locations List */}
          <div className="admin-location-list">
            {locations
              .filter(loc => {
                // If the user has an assigned location, only show that exact location
                if (assignedLocation) {
                  return matchLocationNames(loc.name, assignedLocation);
                }
                // Otherwise show all locations matching the search query
                return loc.name.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map(loc => {
                const isAssignedLoc = matchLocationNames(assignedLocation, loc.name);
                const hasRestrictedView = assignedLocation && !isAssignedLoc;
                const totalVehicles = loc.vehicle_counts ? Object.values(loc.vehicle_counts).reduce((a, b) => a + b, 0) : 0;
                const density = loc.current_density || 0;
                
                return (
                  <div 
                    key={loc.id}
                    className={`admin-list-item glass-card ${selectedLoc?.name === loc.name ? "active" : ""} ${hasRestrictedView ? "disabled" : ""}`}
                    onClick={() => !hasRestrictedView && handleSelectLocation(loc)}
                  >
                    {/* Left glow indicator for visual urgency status */}
                    <div className="admin-list-item-glow-indicator" style={{
                      background: loc.traffic_status === "Low" ? "var(--color-green)" : 
                                  loc.traffic_status === "Medium" ? "var(--color-yellow)" : "var(--color-red)"
                    }}></div>
                    
                    <div className="admin-loc-content" style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                        <div className="admin-loc-meta">
                          <span className="admin-loc-name">
                            <MapPin size={14} className="node-map-pin" />
                            {loc.name}
                            {isAssignedLoc && <span className="assigned-lbl">YOUR ASSIGNMENT</span>}
                          </span>
                          
                          <span className="admin-loc-desc">
                            {loc.manual_override ? (
                              <span className="override-on-badge">🚨 MANUAL CONTROL</span>
                            ) : (
                              <span className="override-off-badge">🤖 AI AUTONOMOUS</span>
                            )}
                            <span className="node-separator">•</span>
                            <span>🚗 {totalVehicles} Vehicles</span>
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                          <span className={`status-badge ${getStatusClass(loc.traffic_status)}`}>
                            {loc.traffic_status}
                          </span>
                          {hasRestrictedView ? (
                            <span className="node-access-badge restricted" title="Access Denied - Restricted to your assignment">
                              <Lock size={10} /> RESTRICTED
                            </span>
                          ) : (
                            <span className="node-access-badge authorized" title="Authorized - Click to manage">
                              <CheckCircle2 size={10} style={{ color: "var(--color-green)" }} /> AUTHORIZED
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Visual Density Progress Bar */}
                      <div className="node-density-container" style={{ marginTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          <span>Grid Traffic Density</span>
                          <span className="font-mono">{density.toFixed(0)}%</span>
                        </div>
                        <div className="node-density-bar-bg" style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                          <div className="node-density-bar-fill" style={{
                            width: `${density}%`,
                            height: "100%",
                            background: loc.traffic_status === "Low" ? "var(--color-green)" : 
                                        loc.traffic_status === "Medium" ? "var(--color-yellow)" : "var(--color-red)",
                            boxShadow: loc.traffic_status === "Low" ? "0 0 6px rgba(0, 230, 115, 0.4)" : 
                                       loc.traffic_status === "Medium" ? "0 0 6px rgba(255, 183, 0, 0.4)" : "0 0 6px rgba(255, 51, 51, 0.4)",
                            transition: "width 0.4s ease"
                          }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Local Node Telemetry & Logs Panel */}
          {assignedLocation && (
            <div className="local-node-telemetry-panel" style={{ marginTop: "25px", borderTop: "1px solid var(--glass-border)", paddingTop: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "15px" }}>
                <Cpu size={16} className="text-glow-cyan" style={{ color: "var(--color-cyan)" }} />
                <h4 style={{ margin: 0, fontSize: "0.9rem", letterSpacing: "1px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                  LOCAL TELEMETRY & DIAGNOSTICS
                </h4>
              </div>

              {/* Grid of stats */}
              <div className="local-telemetry-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <div className="telemetry-card glass-card" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CAMERA STREAM</span>
                  <span style={{ 
                    fontSize: "0.8rem", 
                    fontWeight: "bold", 
                    color: selectedLoc?.is_video_data ? "var(--color-cyan)" : "var(--color-green)", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "5px" 
                  }}>
                    <span className="live-dot" style={{ 
                      width: "6px", 
                      height: "6px", 
                      borderRadius: "50%", 
                      background: selectedLoc?.is_video_data ? "var(--color-cyan)" : "var(--color-green)", 
                      display: "inline-block", 
                      boxShadow: selectedLoc?.is_video_data ? "0 0 6px var(--color-cyan)" : "0 0 6px var(--color-green)" 
                    }}></span>
                    {selectedLoc?.is_video_data ? "VIDEO ANALYZED" : "LIVE SIMULATED"} (90 FPS)
                  </span>
                </div>
                <div className="telemetry-card glass-card" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>AI ACCURACY</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--color-cyan)" }}>{liveAccuracy}% (RT-DETR)</span>
                </div>
                <div className="telemetry-card glass-card" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>SIGNAL HARDWARE</span>
                  <span style={{ 
                    fontSize: "0.8rem", 
                    fontWeight: "bold", 
                    color: manualOverride ? "var(--color-yellow)" : selectedLoc?.is_video_data ? "var(--color-cyan)" : "var(--color-green)" 
                  }}>
                    {manualOverride ? "🟠 MANUAL OVERRIDE" : selectedLoc?.is_video_data ? "🔵 AI VIDEO ANALYSIS" : "🟢 AI AUTONOMOUS"}
                  </span>
                </div>
                <div className="telemetry-card glass-card" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CYCLE CAPACITY</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--text-primary)" }}>{Number(redTime) + Number(yellowTime) + Number(greenTime)}s Total</span>
                </div>
              </div>

              {/* Dynamic activity feed */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <Activity size={14} className="text-glow-yellow" style={{ color: "var(--color-yellow)" }} />
                <h5 style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.5px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  LOCAL NODE CONSOLE LOGS
                </h5>
              </div>

              <div className="console-log-box font-mono" style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.7rem", background: "rgba(10, 14, 23, 0.4)", border: "1px solid var(--glass-border)", padding: "10px", borderRadius: "8px" }}>
                <div style={{ color: "var(--color-green)", marginBottom: "4px" }}>[OK] Connected to grid node: {assignedLocation}</div>
                {selectedLoc?.is_video_data ? (
                  <div style={{ color: "var(--color-cyan)", marginBottom: "4px" }}>[OK] Video analysis feed active. AI traffic metrics synchronized.</div>
                ) : (
                  <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>[INFO] CCTV feed online. Analyzing lanes...</div>
                )}
                <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>[OK] AI detection service reporting 0 alerts.</div>
                <div style={{ color: "var(--color-cyan)", marginBottom: "4px" }}>[SYS] Cycle configuration loaded: R:{redTime}s, Y:{yellowTime}s, G:{greenTime}s.</div>
                <div style={{ color: manualOverride ? "var(--color-yellow)" : "var(--color-green)", marginBottom: "4px" }}>
                  [MODE] Mode update: {manualOverride ? "POLICE MANUAL INTERVENE" : "AI AUTONOMOUS"}
                </div>
                <div style={{ color: "var(--text-muted)" }}>[OK] Telemetry stream initialized. Listening on WebSocket...</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Override parameters */}
        <div className="admin-grid-right">
          {selectedLoc ? (
            <div className="control-panel glass-panel">
              <div className="control-header">
                <div>
                  <h2 className="font-mono">{selectedLoc.name}</h2>
                  <p className="sub-coords">NODE ID: {selectedLoc.id.slice(-8).toUpperCase()} | COORDS: {selectedLoc.latitude.toFixed(4)}, {selectedLoc.longitude.toFixed(4)}</p>
                </div>

                <div className={`override-indicator ${manualOverride ? "active" : ""}`}>
                  <Radio size={16} className={manualOverride ? "pulse-anim" : ""} />
                  <span>{manualOverride ? "POLICE MANUAL INTERVENE" : "AI AUTONOMOUS"}</span>
                </div>
              </div>

              {!isAuthorized && (
                <div className="unauthorized-warning glass-card">
                  <AlertTriangle size={24} className="warning-icon" />
                  <div>
                    <h4>Access Restricted</h4>
                    <p>You are only assigned to manage <strong>{assignedLocation}</strong>. You cannot override settings for this node.</p>
                  </div>
                </div>
              )}

              {/* Emergency Dispatch Center Console */}
              {activeEmergencies.length > 0 && (
                <div className="admin-emergency-console glass-card" style={{ marginBottom: "20px", border: "1px solid rgba(255, 0, 85, 0.4)", background: "rgba(255, 0, 85, 0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--glass-border)" }}>
                    <Ambulance className="text-glow-red" style={{ color: "#ff0055" }} size={20} />
                    <h4 style={{ margin: 0, color: "#ff0055", letterSpacing: "1px", fontSize: "0.9rem" }}>EMERGENCY ROUTING CENTER</h4>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                    {activeEmergencies.map(e => {
                      const isPending = e.status === "Pending";
                      return (
                        <div 
                          key={e.id}
                          style={{
                            padding: "12px",
                            borderRadius: "6px",
                            background: isPending ? "rgba(255, 0, 85, 0.08)" : "rgba(255, 255, 255, 0.02)",
                            border: isPending ? "1px solid rgba(255, 0, 85, 0.3)" : "1px solid var(--glass-border)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "8px" }}>
                            <span>
                              <strong>{e.type.toUpperCase()} DISPATCH</strong>
                            </span>
                            <span style={{ 
                              fontWeight: "bold", 
                              color: e.status === "Routed" ? "var(--color-green)" : e.status === "Cleared" ? "var(--text-muted)" : "#ff0055" 
                            }}>
                              {e.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
                            Route: <strong>{e.start_location}</strong> ➡️ <strong>{e.destination_location}</strong>
                            {e.route && (
                              <div style={{ marginTop: "6px", color: "var(--color-green)", display: "flex", alignItems: "center", gap: "5px" }}>
                                <Navigation size={12} />
                                <span>Calculated Path: {e.route.join(" ➡️ ")}</span>
                              </div>
                            )}
                          </div>
                           
                          <div style={{ display: "flex", gap: "8px" }}>
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleDispatchRoute(e)}
                                disabled={routingLoading}
                                className="glow-btn-cyan"
                                style={{ padding: "6px 12px", fontSize: "0.75rem", fontWeight: "bold", width: "auto" }}
                              >
                                {routingLoading ? "Solving Path..." : "Dispatch Optimal Route"}
                              </button>
                            )}
                             
                            {e.status !== "Cleared" && (
                              <button
                                type="button"
                                onClick={() => handleClearEmergency(e.id)}
                                className="glow-btn-red"
                                style={{ padding: "6px 12px", fontSize: "0.75rem", fontWeight: "bold", width: "auto", background: "transparent", border: "1px solid #ff0055", color: "#ff0055" }}
                              >
                                Clear SOS Incident
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleUpdateOverride} className="override-form">
                {/* Manual Override Toggle */}
                <div className="control-section glass-card">
                  <div className="control-toggle-row">
                    <div>
                      <h4>Manual Grid Intervention</h4>
                      <p className="desc">Override the AI algorithm to control traffic lights and status manually.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => isAuthorized && setManualOverride(!manualOverride)}
                      className="toggle-button"
                      disabled={!isAuthorized}
                    >
                      {manualOverride ? (
                        <ToggleRight size={44} className="toggle-icon active" />
                      ) : (
                        <ToggleLeft size={44} className="toggle-icon" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Override */}
                <div className={`control-section glass-card ${!manualOverride ? "dimmed" : ""}`}>
                  <h4>Status Congestion Override</h4>
                  <p className="desc">Manually specify current traffic level at this intersection.</p>
                  
                  <div className="radio-statuses">
                    {["Low", "Medium", "Heavy", "Gridlock"].map(status => (
                      <label 
                        key={status} 
                        className={`status-radio-label ${trafficStatus === status ? "selected" : ""} ${!manualOverride ? "disabled" : ""}`}
                      >
                        <input 
                          type="radio" 
                          name="trafficStatus" 
                          value={status}
                          checked={trafficStatus === status}
                          onChange={(e) => isAuthorized && setTrafficStatus(e.target.value)}
                          disabled={!manualOverride || !isAuthorized}
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Timers Overrides */}
                <div className="control-section glass-card">
                  <h4>Traffic Light Interval Settings</h4>
                  <p className="desc">Adjust cycle timing intervals (seconds) for lights.</p>
                  
                  <div className="sliders-grid">
                    {/* Axis 1: North-South (CH-1 / CH-2) Green Light Time */}
                    <div className="slider-item">
                      <div className="slider-labels">
                        <span className="light-lbl green" style={{ color: "#00ff66" }}>🟢 North-South Axis Green Time (CH-1/CH-2)</span>
                        <span className="value-lbl font-mono">{greenTime}s</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" 
                        max="120"
                        value={greenTime}
                        onChange={(e) => isAuthorized && setGreenTime(e.target.value)}
                        disabled={!isAuthorized || !manualOverride}
                        className="slider-input green"
                      />
                    </div>

                    {/* Axis 2: East-West (CH-3 / CH-4) Green Light Time */}
                    <div className="slider-item">
                      <div className="slider-labels">
                        <span className="light-lbl red" style={{ color: "#ff3366" }}>🟢 East-West Axis Green Time (CH-3/CH-4)</span>
                        <span className="value-lbl font-mono">{redTime}s</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" 
                        max="120"
                        value={redTime}
                        onChange={(e) => isAuthorized && setRedTime(e.target.value)}
                        disabled={!isAuthorized || !manualOverride}
                        className="slider-input red"
                      />
                    </div>

                    {/* Yellow Light Duration (Buffer) */}
                    <div className="slider-item">
                      <div className="slider-labels">
                        <span className="light-lbl yellow" style={{ color: "#ffcc00" }}>🟡 Transition Yellow Buffer (All Channels)</span>
                        <span className="value-lbl font-mono">{yellowTime}s</span>
                      </div>
                      <input 
                        type="range" 
                        min="2" 
                        max="15"
                        value={yellowTime}
                        onChange={(e) => isAuthorized && setYellowTime(e.target.value)}
                        disabled={!isAuthorized || !manualOverride}
                        className="slider-input yellow"
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "10px", lineHeight: "1.4" }}>
                    ℹ️ <strong>Crossroads Logic:</strong> A standard junction alternates priority between the North-South axis and East-West axis. Adjusting the Green Time determines the clearance duration for that specific axis, while the Yellow Buffer sets the safety clearing transition interval.
                  </p>
                </div>

                {isAuthorized && (
                  <button 
                    type="submit" 
                    className="glow-btn-cyan save-override-btn"
                    disabled={updating}
                  >
                    <Save size={18} />
                    {updating ? "Syncing Grid Operations..." : "Apply Grid Changes"}
                  </button>
                )}
              </form>
            </div>
          ) : assignedLocation ? (
            <div className="no-selection glass-panel">
              <Activity size={48} className="no-selection-icon spin" style={{ color: "var(--color-cyan)" }} />
              <h3>Loading {assignedLocation} Control Panel...</h3>
              <p>Establishing secure connection to grid node telemetry...</p>
            </div>
          ) : (
            <div className="no-selection glass-panel">
              <MapPin size={48} className="no-selection-icon" />
              <h3>Select Intersect Node</h3>
              <p>Please select an authorized active intersection to configure controls.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
