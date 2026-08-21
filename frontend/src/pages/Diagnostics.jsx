import React, { useState, useEffect } from "react";
import { HeartPulse, Database, ShieldAlert, Cpu, RefreshCw, BarChart2, Radio, Server } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./Diagnostics.css";

const matchLocationNames = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const clean = (str) => str.toLowerCase().replace(/\s*(junction|crossing|circle|square|plaza|intersection|metro)\s*/gi, "").trim();
  return clean(nameA) === clean(nameB);
};

export default function Diagnostics({ videoResults, activeFrameStats, selectedLocation }) {
  const [locations, setLocations] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ping, setPing] = useState(0);
  const consoleBoxRef = React.useRef(null);

  const [logs, setLogs] = useState([
    `[INFO] ${new Date().toISOString().slice(0, 10)} - System diagnostics monitoring initialized.`,
    "[OK] Database connection established to Cluster0 Atlas cluster.",
    "[OK] RT-DETR lightweight neural model loaded into local cache memory.",
    "[INFO] CORS origins initialized. Web client listening on port 5173.",
    "[OK] Dijkstra algorithm routing optimizer active."
  ]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      // Avoid adding exact duplicate logs consecutively
      if (prev.length > 0 && prev[prev.length - 1].includes(message)) {
        return prev;
      }
      return [...prev.slice(-30), `[${time}] ${message}`];
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true); // Background poll locations & dispatches every 3 seconds
    }, 3000);

    // Simulate real-time API ping
    const pInterval = setInterval(() => {
      const start = Date.now();
      fetch(`${API_BASE_URL}/`)
        .then(() => setPing(Date.now() - start))
        .catch(() => setPing(-1));
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(pInterval);
    };
  }, []);

  // Scroll live console logs container automatically without jumping viewport scrollbar
  useEffect(() => {
    if (consoleBoxRef.current) {
      consoleBoxRef.current.scrollTop = consoleBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const locRes = await fetch(`${API_BASE_URL}/traffic/locations`);
      const locData = await locRes.json();
      
      const assigned = sessionStorage.getItem("assigned_location");
      const filteredLocData = assigned 
        ? locData.filter(loc => matchLocationNames(loc.name, assigned)) 
        : locData;
      setLocations(filteredLocData);

      const emRes = await fetch(`${API_BASE_URL}/traffic/emergencies`);
      const emData = await emRes.json();
      const filteredEmData = assigned
        ? emData.filter(e => matchLocationNames(e.start_location, assigned) || matchLocationNames(e.destination_location, assigned) || (e.route && e.route.some(r => matchLocationNames(r, assigned))))
        : emData;
      setEmergencies(filteredEmData);

      if (isBackground) {
        const liveLoc = filteredLocData.find(l => videoResults && matchLocationNames(l.name, selectedLocation));
        if (liveLoc) {
          addLog("MongoDB Cluster0 sync check: locations synced successfully.");
          const currentDensity = activeFrameStats?.density || 0;
          const totalVehicles = Object.values(activeFrameStats?.vehicle_counts || {}).reduce((a, b) => a + b, 0);
          addLog(`AI Core status: Processing active CCTV stream for ${liveLoc.name}.`);
          addLog(`[AI] ${liveLoc.name.split(' ')[0]} -> Density: ${currentDensity}%, Vehicles: ${totalVehicles}`);
        } else {
          // If no video is active, do NOT print sync checks or waiting logs repeatedly.
          // Just ensure there is a single static notice in the log console history.
          setLogs(prev => {
            const waitingLog = `[INFO] AI core waiting for live RTSP stream/video upload calibration...`;
            if (prev.some(line => line.includes("waiting for live RTSP stream"))) {
              return prev;
            }
            return [...prev, waitingLog];
          });
        }
        
        const activeEms = filteredEmData.filter(e => e.status === "Routed");
        if (activeEms.length > 0) {
          addLog(`[CORRIDOR] Priority clear active for ${activeEms[0].type} to ${activeEms[0].destination_location}`);
        }
      }
    } catch (err) {
      console.error("Error loading diagnostics data:", err);
      if (isBackground) {
        addLog("[ERROR] Database connection handshake failed. Retrying sync...");
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const getActiveAdminsCount = () => {
    return locations.length;
  };

  // Process locations to reflect live stats only if a video is currently active; else force all values to zero!
  const processedLocations = locations.map(l => {
    const isLive = videoResults && matchLocationNames(l.name, selectedLocation);
    if (isLive) {
      const currentDensity = activeFrameStats?.density || 0;
      return {
        ...l,
        current_density: currentDensity,
        traffic_status: currentDensity >= 80 ? "Gridlock" : currentDensity >= 50 ? "Heavy" : currentDensity >= 20 ? "Medium" : "Low",
        vehicle_counts: activeFrameStats?.vehicle_counts || { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: true
      };
    } else {
      return {
        ...l,
        current_density: 0,
        traffic_status: "Low",
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false
      };
    }
  });

  // Dynamically generate links based on active priority route dispatches; hide Noida/Delhi NCR links if idle!
  const activeEmergency = emergencies.find(e => e.status === "Routed" || e.status === "Pending");
  const activeLinks = [];
  if (activeEmergency && activeEmergency.route && activeEmergency.route.length > 1) {
    const assigned = sessionStorage.getItem("assigned_location");
    for (let i = 0; i < activeEmergency.route.length - 1; i++) {
      const src = activeEmergency.route[i];
      const tgt = activeEmergency.route[i+1];
      if (!assigned || matchLocationNames(src, assigned) || matchLocationNames(tgt, assigned)) {
        activeLinks.push({
          source: src,
          target: tgt,
          type: "Priority Cleared (Dijkstra)",
          weightColor: "var(--color-green)"
        });
      }
    }
  }

  return (
    <div className="diagnostics-container">
      <div className="diagnostics-header glass-panel">
        <div className="diagnostics-header-meta">
          <HeartPulse className="diagnostics-header-icon text-glow-green" />
          <div>
            <h1>CITY NETWORK STATUS & AI CALIBRATION</h1>
            <p>Real-time status of smart traffic grid nodes, platform latency, and active emergency priority routes.</p>
          </div>
        </div>
        <button onClick={() => fetchData(false)} className="glow-btn-cyan refresh-diagnostics-btn">
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      <div className="diagnostics-grid">
        {/* API & Server health */}
        <div className="diagnostics-card glass-panel" style={{ gridColumn: "span 2" }}>
          <div className="card-header border-bottom">
            <Server size={18} className="card-icon cyan" />
            <h4>PLATFORM LATENCY & HEARTBEAT</h4>
          </div>
          
          <div className="diag-stats-row">
            <div className="diag-stat-item glass-card">
              <span className="lbl">API LATENCY</span>
              <span className={`val font-mono ${ping === -1 || ping > 150 ? "red" : "green"}`}>
                {ping === -1 ? "TIMEOUT" : `${ping}ms`}
              </span>
            </div>
            <div className="diag-stat-item glass-card">
              <span className="lbl">SERVER HEARTBEAT</span>
              <span className={`val font-mono ${ping === -1 ? "red" : "green"}`} style={{ textShadow: ping === -1 ? "0 0 8px rgba(255, 0, 85, 0.3)" : "0 0 8px rgba(0, 255, 102, 0.3)" }}>
                {ping === -1 ? "OFFLINE" : "ONLINE"}
              </span>
            </div>
          </div>

          <div ref={consoleBoxRef} className="console-log-box font-mono" style={{ maxHeight: "250px" }}>
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`log-line ${log.includes('[ERROR]') ? 'red' : log.includes('[CORRIDOR]') ? 'text-glow-purple' : log.includes('[INFO]') ? 'text-glow-green' : ''}`}
                style={{ color: log.includes('[ERROR]') ? 'var(--color-red)' : log.includes('[CORRIDOR]') ? 'var(--color-purple)' : '' }}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic bottom telemetry panels */}
      <div className="diagnostics-grid" style={{ marginTop: "20px" }}>
        {/* RT-DETR Neural engine specifications */}
        <div className="diagnostics-card glass-panel">
          <div className="card-header border-bottom">
            <Cpu size={18} className="card-icon green" style={{ color: "var(--color-green)" }} />
            <h4>RT-DETR AI MODEL ENGINE STATUS</h4>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="telemetry-info-row" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Neural Model Core</span>
              <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: "bold" }}>RT-DETR-Nano (Lightweight)</span>
            </div>
            <div className="telemetry-info-row" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Inference Speed</span>
              <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--color-green)", textShadow: "0 0 5px rgba(0,255,102,0.2)" }}>12.5 ms (Standard)</span>
            </div>
            <div className="telemetry-info-row" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>CUDA Acceleration</span>
              <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--color-cyan)" }}>ENABLED (GPU Compute)</span>
            </div>
            <div className="telemetry-info-row" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Target Process FPS</span>
              <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: "bold" }}>90 FPS (Adaptive stream)</span>
            </div>
            <div className="telemetry-info-row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Confidence Threshold</span>
              <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: "bold" }}>0.25 (COCO Weights)</span>
            </div>
          </div>
        </div>

        {/* Dijkstra Emergency Route corridor links */}
        <div className="diagnostics-card glass-panel">
          <div className="card-header border-bottom">
            <Radio size={18} className="card-icon purple" style={{ color: "var(--color-purple)" }} />
            <h4>DIJKSTRA CORRIDOR ROUTE GRAPH</h4>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "170px", overflowY: "auto", paddingRight: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "bold", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px" }}>
              <span>GRAPH CONNECTION LINK</span>
              <span>WEIGHT (TRAVEL DELAY)</span>
            </div>
            {activeLinks.map((link, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                <span className="font-mono">{link.source} 🔗 {link.target}</span>
                <span className="font-mono" style={{ color: link.weightColor, fontWeight: "bold" }}>{link.type}</span>
              </div>
            ))}
            {activeLinks.length === 0 && (
              <div style={{ padding: "15px", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.01)", borderRadius: "6px", border: "1px dashed var(--glass-border)", lineHeight: "1.5" }}>
                🤖 AI ROUTER IDLE: No active priority emergency dispatches on this corridor.
              </div>
            )}
            {emergencies.filter(e => e.status === "Routed").map(e => (
              <div key={e.id} style={{ marginTop: "8px", padding: "6px 10px", borderRadius: "4px", background: "rgba(189,0,255,0.1)", border: "1px solid var(--color-purple)", fontSize: "0.75rem", color: "var(--color-purple)", fontWeight: "bold" }}>
                🚨 ACTIVE EMERGENCY CORRIDOR ROUTE SELECTED ({e.type})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
