import React, { useState, useEffect } from "react";
import { TrafficCone, AlertTriangle, ShieldCheck, Clock, ShieldAlert, Navigation, Eye, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./SignalAdvisory.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function SignalAdvisory() {
  const [locations, setLocations] = useState([]);
  const [allLocationNames, setAllLocationNames] = useState([]);
  const [selectedLocName, setSelectedLocName] = useState("");
  const [activeLocation, setActiveLocation] = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Alert Management States
  const [alertFilter, setAlertFilter] = useState("all"); // all, active, acknowledged
  const [localAlerts, setLocalAlerts] = useState([]);

  const activeCitizenLoc = selectedLocName;

  useEffect(() => {
    fetchAdvisoryData(true);
    const interval = setInterval(() => fetchAdvisoryData(false), 4000);
    return () => clearInterval(interval);
  }, [selectedLocName]);

  const fetchAdvisoryData = async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const locRes = await fetch(`${API_BASE_URL}/traffic/locations`);
      const emRes = await fetch(`${API_BASE_URL}/traffic/emergencies`);

      if (locRes.ok && emRes.ok) {
        const locData = await locRes.json();
        const emData = await emRes.json();

        setEmergencies(emData);

        // Populate location dropdown registry
        const names = locData.map(loc => loc.name);
        setAllLocationNames(names);

        // Auto-select location fallback sequence
        let activeLocName = selectedLocName;
        if (!activeLocName) {
          const citizenLoc = sessionStorage.getItem("active_citizen_location");
          const assignedLoc = sessionStorage.getItem("assigned_location");
          activeLocName = citizenLoc || (assignedLoc && assignedLoc !== "global" ? assignedLoc : "") || (names.length > 0 ? names[0] : "Sitapur Junction");
          setSelectedLocName(activeLocName);
        }

        const matched = locData.find(loc => matchLocationNames(loc.name, activeLocName));
        if (matched) {
          setActiveLocation(matched);
          setLocations([matched]);
        } else if (activeLocName) {
          // Construct virtual node for unregistered areas (e.g. Maholi)
          const activeLocDetailsStr = sessionStorage.getItem("active_citizen_location_details");
          let virtualNode = {
            id: "active-loc",
            name: activeLocName,
            traffic_status: "Low",
            manual_override: false,
            current_density: 0.0,
            is_video_data: false,
            red_time: null,
            green_time: null,
            yellow_time: null,
            vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 }
          };
          if (activeLocDetailsStr) {
            try {
              const details = JSON.parse(activeLocDetailsStr);
              virtualNode = { ...virtualNode, ...details };
            } catch (e) {
              console.error("Error parsing virtual location details:", e);
            }
          }
          setActiveLocation(virtualNode);
          setLocations([virtualNode]);
        }
      } else {
        setError("Failed to fetch current traffic signal registries.");
      }
    } catch (err) {
      console.error("Error loading transit advisory data:", err);
      setError("Unable to sync with digital twin transit gateway API.");
    } finally {
      if (isFirstLoad) setLoading(false);
      else setRefreshing(false);
    }
  };

  // Handle local alert Acknowledge/Resolve toggle
  const handleAcknowledgeAlert = (id) => {
    setLocalAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: "Acknowledged" } : alert
    ));
  };

  // Determine Transit Delay from Live Density
  const getDelayForecast = (density) => {
    if (density < 20) return { text: "Minimal (0-2 mins delay)", color: "var(--color-green)", desc: "Commute routes are completely clear. Standard signal loops active." };
    if (density < 50) return { text: "Light Commute (2-5 mins delay)", color: "var(--color-green)", desc: "Traffic building up. Minor lane queues, AI optimization wave keeps cars rolling." };
    if (density < 80) return { text: "Heavy Congestion (6-12 mins delay)", color: "var(--color-yellow)", desc: "Commuter peak hours active. Expect slower movement through lane intersections." };
    return { text: "Critical Gridlock (+15 mins delay)", color: "var(--color-red)", desc: "Extreme congestion. AI agent recommends avoiding this node or routing through alternative corridors." };
  };

  // Safety Speed advisory from Weather
  const getWeatherAdvisory = (weatherState) => {
    const state = (weatherState || "Clear").toLowerCase();
    if (state.includes("rain")) return { limit: "40 km/h", caution: "Slippery Road Surface", advice: "Reduce speeds. Maintain 3-car spacing due to damp braking friction." };
    if (state.includes("fog") || state.includes("haze")) return { limit: "30 km/h", caution: "Extremely Low Visibility", advice: "Turn on fog lamps. Avoid lane changes on active intersections." };
    if (state.includes("storm") || state.includes("wind")) return { limit: "30 km/h", caution: "Overhead Freight Restriction", advice: "Restricting multi-axle freight vehicles from overhead flyover lanes." };
    return { limit: "60 km/h", caution: "Grip Surface Optimal", advice: "Clear weather conditions. Observe standard digital speed limit guidelines." };
  };

  // Get active priority corridors matching this intersection
  const getCorridorAlert = () => {
    if (!activeLocation) return null;
    const activeRoute = emergencies.find(
      e => (e.status === "Routed" || e.status === "Pending") &&
           (e.route && e.route.some(r => matchLocationNames(r, activeLocation.name)))
    );
    return activeRoute;
  };

  const isFeedActive = activeLocation && activeLocation.is_video_data;

  const delay = activeLocation 
    ? (isFeedActive 
        ? getDelayForecast(activeLocation.current_density || 0)
        : { text: "N/A (Feed Awaiting)", color: "var(--text-muted)", desc: "Awaiting live CCTV neural feed or operator override inputs from the control room." })
    : null;

  const weatherAdvisory = activeLocation
    ? (isFeedActive
        ? getWeatherAdvisory(activeLocation.predicted_weather)
        : { limit: "N/A", caution: "Awaiting Calibration", advice: "Real-time safety speed guidelines offline. Drive with standard speed limits." })
    : null;

  const priorityCorridor = activeLocation ? getCorridorAlert() : null;

  // Compile active warnings list (merging local alerts and db emergencies passing through location)
  const getDisplayAlerts = () => {
    let combined = [];

    // Add DB emergency if it affects this location
    if (priorityCorridor) {
      combined.push({
        id: `db-${priorityCorridor.id || priorityCorridor._id}`,
        type: "Emergency SOS Dispatch",
        message: `Priority emergency wave requested from ${priorityCorridor.start_location} to ${priorityCorridor.destination_location}.`,
        priority: "Critical",
        status: priorityCorridor.status === "Pending" ? "Active" : "Acknowledged",
        timestamp: "Live"
      });
    }

    // Add local alerts
    combined = [...combined, ...localAlerts];

    // Filter
    if (alertFilter === "active") {
      return combined.filter(a => a.status === "Active");
    }
    if (alertFilter === "acknowledged") {
      return combined.filter(a => a.status === "Acknowledged");
    }
    return combined;
  };

  return (
    <div className="advisory-container">
      
      {/* Header with Selector Controls */}
      <div className="advisory-header glass-panel" style={{ flexWrap: "wrap", gap: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="advisory-header-meta" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <TrafficCone className="advisory-header-icon text-glow-yellow" style={{ color: "var(--color-yellow)" }} />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", letterSpacing: "1px" }}>LIVE SIGNAL & TRANSIT ADVISORY</h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Real-time AI signal timings, congestion delay forecasts, and emergency wave dispatches.</p>
          </div>
        </div>

        {/* Dropdown controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>SELECT INTERSECTION</span>
            <select
              value={selectedLocName}
              onChange={(e) => setSelectedLocName(e.target.value)}
              style={{
                background: "rgba(10, 14, 23, 0.85)",
                border: "1px solid rgba(255, 183, 0, 0.3)",
                color: "var(--text-primary)",
                padding: "6px 12px",
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

          <button 
            onClick={() => fetchAdvisoryData(false)} 
            className="glow-btn-cyan refresh-advisory-btn"
            disabled={refreshing}
            style={{ padding: "8px 15px", fontSize: "0.75rem", alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "6px" }}
          >
            {refreshing ? (
              <>
                <span className="logo-pulse-icon" style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>🔄</span>
                <span>REFRESHING...</span>
              </>
            ) : (
              <span>REFRESH UPDATES</span>
            )}
          </button>
        </div>
      </div>

      {/* Loading & Error Indicators */}
      {error ? (
        <div className="no-advisory-output glass-card" style={{ padding: "50px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "20px", border: "1px solid rgba(255, 51, 51, 0.3)", background: "rgba(255, 51, 51, 0.05)" }}>
          <AlertTriangle size={42} style={{ color: "var(--color-red)" }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-red)", fontWeight: "bold" }}>
            {error}
          </p>
        </div>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80px", color: "var(--color-yellow)", gap: "10px", margin: "15px 0" }} className="glass-panel">
          <span className="logo-pulse-icon">⚡</span>
          <span style={{ fontSize: "0.8rem", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>LOADING DIGITAL TWIN TRANSIT TELEMETRY...</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="no-advisory-output glass-card" style={{ padding: "50px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "20px" }}>
          <AlertTriangle size={42} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            📍 Please select or search a location on the main map dashboard to view its live signal advisory & transit alerts.
          </p>
        </div>
      ) : !isFeedActive ? (
        <div className="no-advisory-output glass-card" style={{ padding: "50px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "20px" }}>
          <AlertTriangle size={42} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            No live traffic data is available for {selectedLocName}. Please upload/process traffic data for this location first.
          </p>
        </div>
      ) : (
        activeLocation && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
            
            <div className="advisory-grid">
              
              {/* Left Column: Live Traffic Light Telemetry */}
              <div className="advisory-card glass-panel signal-visualizer">
                <div className="card-header border-bottom">
                  <Clock size={18} className="card-icon cyan" style={{ color: "var(--color-cyan)" }} />
                  <h4>LIVE SIGNAL CONTROLLER TIMER</h4>
                </div>

                <div className="signal-hud-layout">
                  {/* Visual Glowing Traffic Light */}
                  <div className="traffic-light-pole glass-card">
                    <div className={`light red-light ${isFeedActive && activeLocation.current_density >= 60 ? "active-red" : ""}`}></div>
                    <div className={`light yellow-light ${isFeedActive && activeLocation.current_density >= 40 && activeLocation.current_density < 60 ? "active-yellow" : ""}`}></div>
                    <div className={`light green-light ${isFeedActive && activeLocation.current_density < 40 ? "active-green" : ""}`}></div>
                  </div>

                  {/* Timers metadata */}
                  <div className="timer-values-list">
                    <div className="timer-val-row red-bg">
                      <span className="phase-lbl">🔴 RED LIGHT DURATION</span>
                      <span className="phase-timer font-mono">
                        {activeLocation.red_time !== undefined && activeLocation.red_time !== null ? `${activeLocation.red_time}s` : "N/A"}
                      </span>
                    </div>
                    <div className="timer-val-row yellow-bg">
                      <span className="phase-lbl">🟡 YELLOW LIGHT DURATION</span>
                      <span className="phase-timer font-mono">
                        {activeLocation.yellow_time !== undefined && activeLocation.yellow_time !== null ? `${activeLocation.yellow_time}s` : "N/A"}
                      </span>
                    </div>
                    <div className="timer-val-row green-bg">
                      <span className="phase-lbl">🟢 GREEN LIGHT DURATION</span>
                      <span className="phase-timer font-mono">
                        {activeLocation.green_time !== undefined && activeLocation.green_time !== null ? `${activeLocation.green_time}s` : "N/A"}
                      </span>
                    </div>

                    {/* Controller Override Status */}
                    <div className="override-badge-container" style={{ marginTop: "15px" }}>
                      {!isFeedActive ? (
                        <div className="override-status-alert" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}>
                          <span>○ AWAITING LIVE CAMERA CALIBRATION</span>
                        </div>
                      ) : activeLocation.manual_override ? (
                        <div className="override-status-alert manual">
                          <ShieldAlert size={14} />
                          <span>POLICE MANUAL OVERRIDE IN FORCE</span>
                        </div>
                      ) : (
                        <div className="override-status-alert autonomous">
                          <ShieldCheck size={14} />
                          <span>AI AUTONOMOUS WAVE ACTIVE</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Transit Delay & Green Wave Alert */}
              <div className="advisory-card glass-panel">
                <div className="card-header border-bottom">
                  <Navigation size={18} className="card-icon purple" style={{ color: "var(--color-purple)" }} />
                  <h4>COMMUTER DELAY FORECAST</h4>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  
                  {/* Delay status bar */}
                  <div className="advisory-status-box glass-card" style={{ borderLeft: `4px solid ${delay.color}` }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold" }}>CURRENT ESTIMATED DELAY</div>
                    <strong style={{ fontSize: "1.1rem", color: delay.color, display: "block", marginTop: "4px" }}>{delay.text}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "4px", lineHeight: "1.4" }}>
                      {delay.desc}
                    </span>
                  </div>

                  {/* Green Wave dispatch alerts */}
                  <div className="advisory-status-box glass-card">
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold" }}>PRIORITY SIGNAL DISPATCH</div>
                    {priorityCorridor ? (
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "flex-start" }}>
                        <span className="ping-dot" style={{ background: "var(--color-red)" }}></span>
                        <div>
                          <strong style={{ fontSize: "0.8rem", color: "var(--color-red)", display: "block" }}>
                            🚨 DISPATCH ROUTING ({priorityCorridor.type.toUpperCase()})
                          </strong>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                            Emergency wave cleared through lane intersection. Yield right-of-way.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--color-green)", display: "block", marginTop: "6px", fontWeight: "bold" }}>
                        🟢 NORMAL GRID OPERATION: No active emergency priority dispatches.
                      </span>
                    )}
                  </div>

                  {/* Safe Speed limits */}
                  <div className="advisory-status-box glass-card">
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold" }}>
                      WEATHER-ADJUSTED SAFE SPEED LIMIT
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                      <div>
                        <strong style={{ fontSize: "1.2rem", color: "var(--color-cyan)" }}>{weatherAdvisory.limit}</strong>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                          Condition: {activeLocation.predicted_weather || "Clear"} ({weatherAdvisory.caution})
                        </span>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", maxWidth: "160px", textAlign: "right", lineHeight: "1.3" }}>
                        {weatherAdvisory.advice}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* LOWER FULL-WIDTH COMPONENT: TRANSIT WARNINGS & ALERT PANEL */}
            <div className="glass-panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <AlertTriangle size={18} style={{ color: "var(--color-yellow)" }} />
                  <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: 0, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    ⚠️ SYSTEM INCIDENTS & TRANSIT WARNINGS
                  </h3>
                </div>

                {/* Filter Alerts controls */}
                <div style={{ display: "flex", gap: "6px" }}>
                  {["all", "active", "acknowledged"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setAlertFilter(filter)}
                      className={`glow-btn-cyan ${alertFilter === filter ? "active" : ""}`}
                      style={{
                        padding: "4px 8px",
                        fontSize: "0.68rem",
                        background: alertFilter === filter ? "rgba(0, 240, 255, 0.15)" : "transparent",
                        borderColor: alertFilter === filter ? "var(--color-cyan)" : "rgba(255,255,255,0.1)",
                        color: alertFilter === filter ? "var(--color-cyan)" : "var(--text-secondary)"
                      }}
                    >
                      {filter.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert items list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {getDisplayAlerts().length > 0 ? (
                  getDisplayAlerts().map((alert) => {
                    const isCritical = alert.priority === "Critical";
                    const isMedium = alert.priority === "Medium";
                    const isAcked = alert.status === "Acknowledged";
                    const borderColor = isAcked 
                      ? "rgba(255, 255, 255, 0.1)" 
                      : (isCritical ? "var(--color-red)" : isMedium ? "var(--color-yellow)" : "var(--color-cyan)");
                    
                    const badgeBg = isAcked
                      ? "rgba(255, 255, 255, 0.05)"
                      : (isCritical ? "rgba(255, 51, 51, 0.15)" : isMedium ? "rgba(255, 183, 0, 0.15)" : "rgba(0, 240, 255, 0.15)");
                    
                    const badgeColor = isAcked
                      ? "var(--text-muted)"
                      : (isCritical ? "var(--color-red)" : isMedium ? "var(--color-yellow)" : "var(--color-cyan)");

                    return (
                      <div 
                        key={alert.id} 
                        className="glass-card" 
                        style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          padding: "12px 20px", 
                          border: `1px solid ${borderColor}`,
                          borderRadius: "6px",
                          background: isAcked ? "rgba(18, 26, 43, 0.2)" : "rgba(18, 26, 43, 0.5)",
                          opacity: isAcked ? 0.6 : 1,
                          transition: "all 0.3s ease"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "70%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span 
                              style={{ 
                                fontSize: "0.55rem", 
                                fontWeight: "bold", 
                                padding: "1px 5px", 
                                borderRadius: "3px", 
                                background: badgeBg, 
                                color: badgeColor,
                                border: `1px solid ${badgeColor}`
                              }}
                            >
                              {alert.type.toUpperCase()}
                            </span>
                            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{alert.timestamp}</span>
                          </div>
                          <span style={{ fontSize: "0.8rem", color: isAcked ? "var(--text-muted)" : "var(--text-primary)", fontWeight: "600" }}>
                            {alert.message}
                          </span>
                        </div>

                        <div>
                          {isAcked ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", color: "var(--color-green)", fontWeight: "bold" }}>
                              <CheckCircle2 size={14} />
                              <span>ACKNOWLEDGED</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="glow-btn-cyan"
                              style={{ padding: "6px 12px", fontSize: "0.7rem", background: "rgba(0, 240, 255, 0.05)" }}
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.75rem" }} className="glass-card">
                    No live data available. System operational state: nominal.
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      )}

    </div>
  );
}
