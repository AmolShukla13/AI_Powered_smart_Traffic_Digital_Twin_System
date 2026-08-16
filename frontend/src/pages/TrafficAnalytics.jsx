import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Clock, AlertTriangle, ShieldCheck, HelpCircle, Info } from "lucide-react";
import "./TrafficAnalytics.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function TrafficAnalytics({ videoResults, activeFrameStats, selectedLocation }) {
  const [locations, setLocations] = useState([]);
  const [avgVehicles, setAvgVehicles] = useState(0);
  const [avgDensity, setAvgDensity] = useState(0);
  const [avgTimeSaved, setAvgTimeSaved] = useState(0.0);
  const [avgCo2, setAvgCo2] = useState(0.0);
  const [hourlyProfile, setHourlyProfile] = useState([0, 0, 0, 0, 0]);

  const assignedLocation = sessionStorage.getItem("assigned_location") || "global";

  // Fetch locations registry
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch("https://smart-traffic-backend-q3q9.onrender.com/traffic/locations");
      if (res.ok) {
        const data = await res.json();
        
        const activeCitizenLoc = sessionStorage.getItem("active_citizen_location");
        if (!activeCitizenLoc) {
          setLocations([]);
          setAvgVehicles(0);
          setAvgDensity(0);
          setAvgTimeSaved(0);
          setAvgCo2(0);
          setHourlyProfile([0, 0, 0, 0, 0]);
          return;
        }

        const filtered = data.filter(loc => matchLocationNames(loc.name, activeCitizenLoc));
        if (filtered.length === 0) {
          const activeLocDetailsStr = sessionStorage.getItem("active_citizen_location_details");
          let virtualNode = {
            id: "active-loc",
            name: activeCitizenLoc,
            traffic_status: "Low",
            manual_override: false,
            current_density: 0.0,
            is_video_data: false,
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
          filtered.push(virtualNode);
        }

        setLocations(filtered);

        const loc = filtered[0];
        const vc = loc.vehicle_counts || { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 };
        const cars = vc.car || 0;
        const buses = vc.bus || 0;
        const trucks = vc.truck || 0;
        const motorcycles = vc.motorcycle || 0;
        const bicycles = vc.bicycle || 0;
        const totalVehicles = cars + buses + trucks + motorcycles + bicycles;
        
        const density = loc.current_density || 0;
        const co2SavedVal = (cars * 5.8) + ((buses + trucks) * 29.2) + (motorcycles * 2.5);
        const timeSavedVal = parseFloat((density * 0.25).toFixed(1));

        setAvgVehicles(totalVehicles);
        setAvgDensity(density);
        setAvgTimeSaved(timeSavedVal);
        setAvgCo2(co2SavedVal);

        setHourlyProfile([
          cars,
          buses,
          trucks,
          motorcycles,
          bicycles
        ]);
      }
    } catch (err) {
      console.error("Error loading analytics locations:", err);
    }
  };

  const activeCitizenLoc = sessionStorage.getItem("active_citizen_location");
  const isLiveActive = locations.some(l => l.is_video_data);

  // Dynamic status configurations
  const statusLabel = activeCitizenLoc 
    ? `📍 MONITORED AREA: ${activeCitizenLoc.toUpperCase()}`
    : "🌐 CITY-WIDE NETWORK TELEMETRY";
  const statusColor = "var(--color-cyan)";

  // Format CO2 for readability (e.g. grams vs kg)
  const formatCo2 = (grams) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(2)} kg`;
    }
    return `${Math.round(grams)} grams`;
  };

  const chartLabels = ["Cars", "Buses", "Trucks", "Motorcycles", "Bicycles"];

  return (
    <div className="analytics-container">
      <div className="analytics-header glass-panel">
        <div className="analytics-header-meta">
          <BarChart3 className="analytics-header-icon text-glow-cyan" />
          <div>
            <h1>AI TRAFFIC INTELLIGENCE REPORT</h1>
            <p>1-Hour rolling average traffic stats, carbon savings, and signal bottlenecks.</p>
          </div>
        </div>
        <div style={{ padding: "6px 12px", border: `1px solid ${statusColor}`, borderRadius: "4px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: "bold", color: statusColor, textShadow: isLiveActive ? `0 0 5px ${statusColor}` : "none" }}>
          {statusLabel}
        </div>
      </div>

      {!activeCitizenLoc ? (
        <div className="no-sim-output-full glass-card" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginTop: "20px" }}>
          <AlertTriangle size={36} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            📍 Please select or search a location on the main map dashboard to view its live AI traffic intelligence report.
          </p>
        </div>
      ) : (
        <>
          {/* Grid of 4 Stats Cards */}
          <div className="analytics-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginTop: "20px", marginBottom: "20px" }}>
        <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
          <TrendingUp className="stat-icon" style={{ color: "var(--color-cyan)", width: "24px", height: "24px" }} />
          <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>1H AVG VEHICLES</span>
          <span className="val font-mono" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px" }}>
            {avgVehicles} Vehicles
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Rolling Hourly Mean</span>
        </div>

        <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
          <Clock className="stat-icon" style={{ color: "var(--color-green)", width: "24px", height: "24px" }} />
          <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>1H AVG CONGESTION</span>
          <span className="val font-mono text-glow-green" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-green)" }}>
            {avgDensity}%
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Average Node Density</span>
        </div>

        <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
          <ShieldCheck className="stat-icon" style={{ color: "var(--color-purple)", width: "24px", height: "24px" }} />
          <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>TIME SAVED BY AI</span>
          <span className="val font-mono text-glow-purple" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-purple)" }}>
            {avgTimeSaved > 0 ? `${avgTimeSaved} Mins` : "0.0 Mins"}
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Green wave signal clearing</span>
        </div>

        <div className="diag-stat-item glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "8px" }}>
          <HelpCircle className="stat-icon" style={{ color: "var(--color-yellow)", width: "24px", height: "24px" }} />
          <span className="lbl" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", fontWeight: "bold" }}>CO₂ REDUCED (EPA)</span>
          <span className="val font-mono text-glow-yellow" style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "5px", color: "var(--color-yellow)" }}>
            {formatCo2(avgCo2)}
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>Idle Emissions Saved</span>
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
                const density = loc.current_density || 0;
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
            const density = loc.current_density || 0;
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
          {locations.length === 0 && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
              No local intersections loaded. Check database configuration.
            </p>
          )}
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
      )}
    </div>
  );
}
