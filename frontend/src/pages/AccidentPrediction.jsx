import React, { useState, useEffect } from "react";
import { AlertOctagon, ShieldAlert, CloudRain, Sun, CloudLightning, ShieldCheck, Thermometer, Wind, Eye } from "lucide-react";
import "./AccidentPrediction.css";

export default function AccidentPrediction() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState("Clear");
  const [selectedLocForSim, setSelectedLocForSim] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isManualWeather, setIsManualWeather] = useState(false);

  const userRole = sessionStorage.getItem("role") || "user";
  const isCitizen = userRole !== "admin";

  // Auto-sync weather state to AI predicted weather from video feed if user hasn't overridden it
  useEffect(() => {
    if ((!isManualWeather || isCitizen) && selectedLocForSim) {
      setWeather(selectedLocForSim.predicted_weather || "Clear");
    }
  }, [selectedLocForSim, isManualWeather, selectedLocForSim?.predicted_weather, isCitizen]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(() => {
      fetchLocations(true); // Background poll every 3 seconds
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedLocForSim]);

  const fetchLocations = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/traffic/locations");
      const data = await res.json();
      
      const activeLocName = sessionStorage.getItem("active_citizen_location");
      const activeLocDetailsStr = sessionStorage.getItem("active_citizen_location_details");

      if (isCitizen) {
        if (!activeLocName) {
          setLocations([]);
          setSelectedLocForSim(null);
          if (!isBackground) setLoading(false);
          return;
        }

        if (activeLocDetailsStr) {
          try {
            const details = JSON.parse(activeLocDetailsStr);
            setLocations([details]);
            setSelectedLocForSim(details);
            if (!isBackground) setLoading(false);
            return;
          } catch (e) {
            console.error("Error parsing virtual location details:", e);
          }
        }

        const matched = data.find(l => l.name.toLowerCase() === activeLocName.toLowerCase());
        if (matched) {
          setLocations([matched]);
          setSelectedLocForSim(matched);
        } else {
          // Construct fallback virtual node for Nominatim external search queries (like Maholi/Hardoi)
          const virtualNode = {
            id: "active-loc",
            name: activeLocName,
            traffic_status: "Low",
            manual_override: false,
            current_density: 15.0,
            is_video_data: true,
            isUnregistered: true
          };
          setLocations([virtualNode]);
          setSelectedLocForSim(virtualNode);
        }
      } else {
        // Admin View (Police controller - can see all managed intersections)
        const assigned = sessionStorage.getItem("assigned_location");
        const filteredData = assigned 
          ? data.filter(loc => loc.name === assigned) 
          : data;

        setLocations(filteredData);
        
        if (filteredData.length > 0) {
          if (!selectedLocForSim) {
            setSelectedLocForSim(filteredData[0]);
          } else {
            const updated = filteredData.find(l => l.name === selectedLocForSim.name);
            if (updated) {
              setSelectedLocForSim(updated);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading locations:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const runSimulator = () => {
    setIsSimulated(true);
  };

  const minMax = (val, min, max) => {
    return Math.min(max, Math.max(min, val));
  };

  const getRiskClass = (level) => {
    return level?.toLowerCase() || "low";
  };

  // Compute simulation results reactively so it changes dynamically in real-time as traffic density updates!
  const getSimResults = () => {
    if (!selectedLocForSim) return null;
    
    // Fetch latest polled metrics from locations array for this node
    const latestLoc = locations.find(l => l.name === selectedLocForSim.name) || selectedLocForSim;
    
    
    
    let prob = 0.05;
    const factors = [];
    const suggestions = [];

    const status = latestLoc.traffic_status;
    if (status === "Heavy") {
      prob += 0.25;
      factors.push("High vehicle density and congestion");
      suggestions.push("Enforce strict speed limit control on adjacent lanes");
    } else if (status === "Gridlock") {
      prob += 0.40;
      factors.push("Severe gridlock traffic slowing reaction times");
      suggestions.push("Deploy traffic wardens to manual intersection controls");
    } else if (status === "Medium") {
      prob += 0.10;
      factors.push("Moderate traffic density");
      suggestions.push("Monitor pedestrian crossings for peak times");
    } else {
      factors.push("Low vehicle density (safe flow)");
    }
      
    if (weather === "Rainy") {
      prob += 0.20;
      factors.push("Wet road conditions and reduced braking efficiency");
      suggestions.push("Display 'Slippery Road' warnings on digital signs");
      suggestions.push("Extend yellow light duration by 2 seconds");
    } else if (weather === "Foggy") {
      prob += 0.35;
      factors.push("Poor visibility below 50 meters (high risk of pileup)");
      suggestions.push("Activate high-intensity fog warning beacons");
      suggestions.push("Maintain 3x safe stopping distance");
    } else if (weather === "Stormy") {
      prob += 0.30;
      factors.push("Strong crosswinds affecting two-wheelers");
      suggestions.push("Close underpasses if water levels exceed 10cm");
    } else {
      factors.push("Dry road surfaces and optimal atmospheric visibility");
    }

    prob = minMax(prob, 0.02, 0.95);
    
    let riskLevel = "Low";
    if (prob >= 0.75) riskLevel = "Critical";
    else if (prob >= 0.50) riskLevel = "High";
    else if (prob >= 0.20) riskLevel = "Medium";

    return {
      name: latestLoc.name,
      probability: prob,
      riskLevel,
      factors,
      suggestions
    };
  };

  const simResults = (isSimulated || isCitizen) ? getSimResults() : null;

  return (
    <div className="risk-analytics-container">
      <div className="risk-header glass-panel">
        <div className="risk-header-meta">
          <ShieldAlert className="risk-header-icon text-glow-red" />
          <div>
            <h1>ACCIDENT PREDICTION & RISK ANALYTICS</h1>
            <p>Predictive safety algorithms assessing collision factors across connected grid intersections.</p>
          </div>
        </div>
      </div>

      <div className="risk-grid">
        {/* Left Panel: Grid-wide Risk Index Comparison */}
        <div className="risk-left glass-panel">
          <div className="section-title">
            <h3>GRID RISK INDEX CHART</h3>
          </div>
          
          <div className="chart-wrapper glass-card">
            <div className="custom-bar-chart">
              {locations.length === 0 ? (
                <p className="no-data">Syncing grid data...</p>
              ) : (
                locations.map(loc => {
                  let baseProb = 0;
                  if (loc.is_video_data) {
                    baseProb = loc.traffic_status === "Gridlock" ? 95 : 
                               loc.traffic_status === "Heavy" ? 75 : 
                               loc.traffic_status === "Medium" ? 45 : 15;
                  }
                  
                  const color = !loc.is_video_data ? "var(--text-muted)" :
                                baseProb < 20 ? "var(--color-green)" :
                                baseProb < 50 ? "var(--color-yellow)" :
                                baseProb < 80 ? "var(--color-red)" : "var(--color-purple)";
                                
                  return (
                    <div className="chart-bar-row" key={loc.id} style={{ opacity: loc.is_video_data ? 1 : 0.5 }}>
                      <span className="bar-label">{loc.name.split(" ")[0]}</span>
                      <div className="bar-track">
                        <div 
                          className="bar-fill" 
                          style={{ 
                            width: `${loc.is_video_data ? baseProb : 0}%`,
                            backgroundColor: color,
                            boxShadow: loc.is_video_data ? `0 0 10px ${color}` : "none"
                          }}
                        ></div>
                      </div>
                      <span className="bar-value font-mono">
                        {loc.is_video_data ? `${baseProb}%` : "OFFLINE"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Environmental Safety Recommendations */}
          <div className="safety-tips-card glass-card">
            <h4>ENVIRONMENTAL RISK PROTOCOLS</h4>
            <div className="prot-grid">
              <div className="prot-item">
                <Sun size={18} className="prot-icon green" />
                <div className="prot-desc">
                  <strong>Clear Weather:</strong> Keep traffic signals running at AI optimized standard intervals.
                </div>
              </div>
              <div className="prot-item">
                <CloudRain size={18} className="prot-icon yellow" />
                <div className="prot-desc">
                  <strong>Rain Conditions:</strong> Reduce speed limits dynamically by 20km/h on digital displays.
                </div>
              </div>
              <div className="prot-item">
                <Eye size={18} className="prot-icon red" />
                <div className="prot-desc">
                  <strong>Fog/Haze:</strong> Switch light signals to flash yellow/red caution indicators.
                </div>
              </div>
              <div className="prot-item">
                <CloudLightning size={18} className="prot-icon purple" />
                <div className="prot-desc">
                  <strong>Storm/Gale:</strong> Restrict heavy multi-axle freight vehicles from overhead bridges.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Predictive Simulator */}
        <div className="risk-right glass-panel">
          <div className="section-title">
            <h3>{isCitizen ? "LIVE RISK ASSESSMENT" : "ACCIDENT RISK SIMULATOR"}</h3>
            <p className="sub-desc">{isCitizen ? "Real-time AI collision threat assessment synced with telemetry." : "Simulate atmospheric weather changes to predict congestion safety scores."}</p>
          </div>

          <div className="sim-form-card glass-card">
            {isCitizen ? (
              <div className="sim-input-row" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label>📍 Active Monitored Area</label>
                <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "#fff", fontSize: "0.85rem", fontWeight: "bold" }}>
                  {selectedLocForSim?.name || "No active location selected"}
                </div>
              </div>
            ) : (
              <div className="sim-input-row">
                <label>Select Target Intersection</label>
                <select 
                  className="form-input"
                  value={selectedLocForSim?.name || ""}
                  onChange={(e) => setSelectedLocForSim(locations.find(l => l.name === e.target.value))}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isCitizen ? (
              <div className="sim-input-row" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label>Active Weather Telemetry</label>
                <div style={{ padding: "10px", background: "rgba(0, 240, 255, 0.05)", border: "1px solid rgba(0, 240, 255, 0.15)", borderRadius: "4px", color: "var(--color-cyan)", fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase" }}>
                  ☁️ {weather || "Clear"}
                </div>
              </div>
            ) : (
              <>
                <div className="sim-input-row" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ margin: 0 }}>Atmospheric Weather</label>
                    {selectedLocForSim?.is_video_data && (
                      <span style={{ 
                        fontSize: "0.6rem", 
                        padding: "2px 6px", 
                        borderRadius: "4px", 
                        fontWeight: "bold", 
                        background: isManualWeather ? "rgba(255, 170, 0, 0.15)" : "rgba(0, 255, 102, 0.15)", 
                        color: isManualWeather ? "var(--color-yellow)" : "var(--color-green)", 
                        border: isManualWeather ? "1px solid rgba(255, 170, 0, 0.3)" : "1px solid rgba(0, 255, 102, 0.3)",
                        letterSpacing: "0.5px"
                      }}>
                        {isManualWeather ? "⚙️ USER OVERRIDE" : "🤖 AI DETECTED"}
                      </span>
                    )}
                  </div>
                  <select 
                    className="form-input"
                    value={weather}
                    onChange={(e) => {
                      setWeather(e.target.value);
                      setIsManualWeather(true);
                    }}
                  >
                    <option value="Clear">Clear Skies</option>
                    <option value="Rainy">Rainy / Monsoon</option>
                    <option value="Foggy">Foggy / Low Haze</option>
                    <option value="Stormy">Heavy Gale Storm</option>
                  </select>
                  {isManualWeather && selectedLocForSim?.is_video_data && (
                    <button 
                      onClick={() => setIsManualWeather(false)} 
                      style={{ 
                        background: "none", 
                        border: "none", 
                        color: "var(--color-cyan)", 
                        fontSize: "0.65rem", 
                        textDecoration: "underline", 
                        cursor: "pointer", 
                        marginTop: "3px", 
                        padding: 0, 
                        textAlign: "left",
                        width: "fit-content"
                      }}
                    >
                      Reset to AI Detection
                    </button>
                  )}
                </div>

                <button onClick={runSimulator} className="glow-btn-cyan sim-submit-btn">
                  Execute Safety Simulation
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Simulated Results Output Panel */}
      {simResults ? (
        simResults.error ? (
          <div className="sim-output-box-full glass-card animated-field error" style={{ border: "1px solid var(--color-yellow)", background: "rgba(255, 170, 0, 0.02)" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", color: "var(--color-yellow)" }}>
              <ShieldAlert size={28} />
              <div>
                <h4 style={{ margin: 0 }}>MODEL OFFLINE</h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                  {simResults.error}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={`sim-output-box-full glass-card animated-field ${getRiskClass(simResults.riskLevel)}`}>
            <div className="sim-output-header">
              <AlertOctagon size={26} className={`sim-risk-icon ${getRiskClass(simResults.riskLevel)}`} />
              <div>
                <span className="sim-lbl">SIMULATED RISK ASSESSMENT</span>
                <h3 className={`sim-risk-val ${getRiskClass(simResults.riskLevel)}`}>
                  {simResults.riskLevel.toUpperCase()} ({Math.round(simResults.probability * 100)}%)
                </h3>
              </div>
            </div>

            {/* Glowing Linear Risk Level Meter */}
            <div className="risk-meter-container" style={{ margin: "20px 0 25px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "bold", letterSpacing: "0.5px" }}>
                <span>SAFE FLOW</span>
                <span>MODERATE WARNING</span>
                <span>CRITICAL RISK</span>
              </div>
              <div className="risk-meter-track" style={{ height: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "5px", overflow: "hidden", position: "relative", border: "1px solid var(--glass-border)" }}>
                <div className="risk-meter-fill" style={{
                  height: "100%",
                  width: `${simResults.probability * 100}%`,
                  background: `linear-gradient(90deg, var(--color-green) 0%, var(--color-yellow) 40%, var(--color-red) 75%, var(--color-purple) 100%)`,
                  borderRadius: "5px",
                  transition: "width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1.0)",
                  boxShadow: simResults.riskLevel === "Low" ? "0 0 10px rgba(0, 255, 102, 0.3)" :
                             simResults.riskLevel === "Medium" ? "0 0 10px rgba(255, 183, 0, 0.3)" :
                             simResults.riskLevel === "High" ? "0 0 10px rgba(255, 51, 51, 0.4)" : "0 0 15px rgba(189, 0, 255, 0.5)"
                }}></div>
              </div>
            </div>

            <div className="sim-lists">
              <div className="sim-list-col">
                <h5>TRIGGER FACTORS</h5>
                <ul className="sim-ul">
                  {simResults.factors.map((f, i) => (
                    <li key={i} className="sim-li font-size-8"><AlertOctagon size={12} className="bullet-warn" /> {f}</li>
                  ))}
                </ul>
              </div>
              <div className="sim-list-col">
                <h5>ACTION RULES</h5>
                <ul className="sim-ul">
                  {simResults.suggestions.map((s, i) => (
                    <li key={i} className="sim-li font-size-8"><ShieldCheck size={12} className="bullet-shield" /> {s}</li>
                  ))}
                  {simResults.suggestions.length === 0 && <li className="sim-li"><ShieldCheck size={12} className="bullet-shield" /> No immediate changes required.</li>}
                </ul>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="no-sim-output-full glass-card" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <ShieldAlert size={36} style={{ color: "var(--color-yellow)", opacity: 0.8 }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", maxWidth: "600px" }}>
            {isCitizen 
              ? "📍 Please select or search a location on the main map dashboard to view its live risk analytics."
              : "Configure atmospheric coordinates and click the simulation button above to run local neural predictions."
            }
          </p>
        </div>
      )}
    </div>
  );
}
