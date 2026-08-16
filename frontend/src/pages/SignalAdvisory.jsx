import React, { useState, useEffect } from "react";
import { TrafficCone, AlertTriangle, ShieldCheck, Clock, ShieldAlert, Navigation } from "lucide-react";
import "./SignalAdvisory.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function SignalAdvisory() {
  const [locations, setLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(false);

  const activeCitizenLoc = sessionStorage.getItem("active_citizen_location");

  useEffect(() => {
    fetchAdvisoryData();
    const interval = setInterval(fetchAdvisoryData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdvisoryData = async (isBackground = true) => {
    if (!isBackground) setLoading(true);
    try {
      const locRes = await fetch(`${import.meta.env.VITE_API_URL}/traffic/locations`);
      const emRes = await fetch(`${import.meta.env.VITE_API_URL}/traffic/emergencies`);

      if (locRes.ok && emRes.ok) {
        const locData = await locRes.json();
        const emData = await emRes.json();

        setEmergencies(emData);

        if (activeCitizenLoc) {
          const matched = locData.find(loc => matchLocationNames(loc.name, activeCitizenLoc));
          if (matched) {
            setActiveLocation(matched);
            setLocations([matched]);
          } else {
            // Construct virtual node for unregistered areas (e.g. Maholi)
            const activeLocDetailsStr = sessionStorage.getItem("active_citizen_location_details");
            let virtualNode = {
              id: "active-loc",
              name: activeCitizenLoc,
              traffic_status: "Low",
              manual_override: false,
              current_density: 0.0,
              is_video_data: false,
              red_time: 30,
              green_time: 30,
              yellow_time: 5,
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
          setActiveLocation(null);
          setLocations([]);
        }
      }
    } catch (err) {
      console.error("Error loading transit advisory data:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
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

  return (
    <div className="advisory-container">
      <div className="advisory-header glass-panel">
        <div className="advisory-header-meta">
          <TrafficCone className="advisory-header-icon text-glow-yellow" style={{ color: "var(--color-yellow)" }} />
          <div>
            <h1>LIVE SIGNAL & TRANSIT ADVISORY</h1>
            <p>Real-time AI signal timings, congestion delay forecasts, and emergency wave dispatches.</p>
          </div>
        </div>
        <button onClick={() => fetchAdvisoryData(false)} className="glow-btn-cyan refresh-advisory-btn">
          Refresh Updates
        </button>
      </div>

      {!activeCitizenLoc ? (
        <div className="no-advisory-output glass-card" style={{ padding: "50px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "20px" }}>
          <AlertTriangle size={42} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            📍 Please select or search a location on the main map dashboard to view its live signal advisory & transit alerts.
          </p>
        </div>
      ) : (
        activeLocation && (
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
                    <span className="phase-timer font-mono">{activeLocation.red_time || 30}s</span>
                  </div>
                  <div className="timer-val-row yellow-bg">
                    <span className="phase-lbl">🟡 YELLOW LIGHT DURATION</span>
                    <span className="phase-timer font-mono">{activeLocation.yellow_time || 5}s</span>
                  </div>
                  <div className="timer-val-row green-bg">
                    <span className="phase-lbl">🟢 GREEN LIGHT DURATION</span>
                    <span className="phase-timer font-mono">{activeLocation.green_time || 30}s</span>
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
        )
      )}
    </div>
  );
}
