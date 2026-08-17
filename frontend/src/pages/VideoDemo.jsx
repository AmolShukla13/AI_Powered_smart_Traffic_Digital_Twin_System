import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Play, FileVideo, Cpu, Layers, Car, BarChart3, AlertCircle, AlertTriangle, Radio, Globe } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./VideoDemo.css";

const generateMockStreamResults = () => {
  const processed_frames = [];
  const duration = 30; // 30 seconds mock video
  for (let t = 0; t <= duration; t += 0.5) {
    const carCount = Math.floor(10 + Math.sin(t / 2) * 5 + Math.random() * 3);
    const busCount = Math.floor(1 + Math.random() * 2);
    const motorcycleCount = Math.floor(5 + Math.random() * 4);
    
    const detections = [];
    // Add cars
    for (let i = 0; i < carCount; i++) {
      detections.push({
        bbox: [
          0.1 + (i * 0.05) % 0.7, 
          0.2 + (Math.sin(t + i) * 0.1) % 0.5, 
          0.2 + (i * 0.05) % 0.7 + 0.1, 
          0.3 + (Math.sin(t + i) * 0.1) % 0.5 + 0.1
        ],
        class: "car",
        confidence: Number((0.7 + Math.random() * 0.25).toFixed(2))
      });
    }
    // Add buses
    for (let i = 0; i < busCount; i++) {
      detections.push({
        bbox: [0.3 + i * 0.1, 0.1, 0.45 + i * 0.1, 0.25],
        class: "bus",
        confidence: Number((0.8 + Math.random() * 0.15).toFixed(2))
      });
    }
    
    const totalVehicles = carCount + busCount + motorcycleCount;
    processed_frames.push({
      timestamp: t,
      detections,
      density: Math.min(100, Math.round((totalVehicles / 120.0) * 100.0)),
      vehicle_counts: { car: carCount, bus: busCount, motorcycle: motorcycleCount, truck: 0, bicycle: 0 }
    });
  }
  
  return {
    density: 55,
    traffic_status: "Medium",
    vehicle_counts: { car: 15, bus: 2, motorcycle: 7, truck: 0, bicycle: 0 },
    processed_frames,
    duration,
    detection_method: "YOLOv8 RTSP STREAM"
  };
};

export default function VideoDemo({
  videoFile, setVideoFile,
  videoUrl, setVideoUrl,
  results, setResults,
  playbackTime, setPlaybackTime,
  activeFrameStats, setActiveFrameStats,
  selectedLocation, setSelectedLocation,
  isCCTVConnected, setIsCCTVConnected,
  activeTab, setActiveTab,
  streamUrl, setStreamUrl,
  cctvPasskey, setCctvPasskey
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState([]);
  const [isConnectingCCTV, setIsConnectingCCTV] = useState(false);

  // 4 camera stream URLs
  const [streamUrlN, setStreamUrlN] = useState("rtsp://camera-n.sitapur.gov.in:554/live");
  const [streamUrlS, setStreamUrlS] = useState("rtsp://camera-s.sitapur.gov.in:554/live");
  const [streamUrlE, setStreamUrlE] = useState("rtsp://camera-e.sitapur.gov.in:554/live");
  const [streamUrlW, setStreamUrlW] = useState("rtsp://camera-w.sitapur.gov.in:554/live");

  // Traffic signal states:
  const [signalPhase, setSignalPhase] = useState(0); // 0 = NS Green, 1 = EW Green
  const [signalTimer, setSignalTimer] = useState(30);
  const [maxGreenTime, setMaxGreenTime] = useState(30);

  const videoRef = useRef(null);

  // Adaptive 4-way traffic light controller loop
  useEffect(() => {
    let active = false;
    // Check if video is active and playing
    if (results && videoRef.current && !videoRef.current.paused) {
      active = true;
    } else if (isCCTVConnected) {
      active = true;
    }

    if (!active) return;

    const interval = setInterval(() => {
      setSignalTimer((prev) => {
        if (prev <= 1) {
          // Toggle between NS axis and EW axis
          setSignalPhase((p) => (p === 0 ? 1 : 0));
          const currentDensity = activeFrameStats ? activeFrameStats.density : (results ? results.density : 45);
          // AI Dynamic Timing formula: high density gets 45s clearance, low gets 20s
          const nextGreen = currentDensity >= 50 ? 45 : 20;
          setMaxGreenTime(nextGreen);
          return nextGreen;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [results, isCCTVConnected, activeFrameStats, signalPhase]);

  // Fetch locations on mount to populate dropdown
  useEffect(() => {
    const fetchLocs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/traffic/locations`);
        const data = await res.json();
        setLocations(data);
        if (data.length > 0 && !selectedLocation) {
          setSelectedLocation(data[0].name);
        }
      } catch (err) {
        console.error("Error fetching locations:", err);
      }
    };
    fetchLocs();
  }, []);

  // Restore video playback time on mount if there's saved progress
  useEffect(() => {
    if (videoRef.current && playbackTime > 0) {
      // Set the video's time to match the background simulated time
      videoRef.current.currentTime = playbackTime;
      // Gently play the video
      videoRef.current.play().catch(() => {});
    }
  }, [videoRef.current, videoUrl]);

  const handleFileChange = (e) => {
    setError("");
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setResults(null);
    }
  };

  const handleConnectCCTV = () => {
    setError("");
    if (!streamUrlN || !streamUrlS || !streamUrlE || !streamUrlW || !cctvPasskey) {
      setError("Please enter all 4 directional RTSP camera stream URLs and the Government Access Token.");
      return;
    }
    if (!selectedLocation) {
      setError("Please select a target intersection node to synchronize the camera stream.");
      return;
    }

    setIsConnectingCCTV(true);
    
    // Simulate server linking and authorization handshake delay
    setTimeout(() => {
      setIsConnectingCCTV(false);
      setIsCCTVConnected(true);
      
      // Load free stock Delhi-like traffic camera video
      setVideoUrl("https://assets.mixkit.co/videos/preview/mixkit-intersection-traffic-in-a-busy-city-at-night-42656-large.mp4");
      
      // Generate simulated YOLO live feed analysis data
      const mockResults = generateMockStreamResults();
      setResults(mockResults);
      if (mockResults.processed_frames && mockResults.processed_frames.length > 0) {
        setActiveFrameStats(mockResults.processed_frames[0]);
      }
    }, 2000);
  };

  // Background synchronization and state management lifted to global context (App.jsx)

  const handleUpload = async () => {
    if (!videoFile) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", videoFile);

    try {
      const url = selectedLocation
  ? `${API_BASE_URL}/traffic/upload-demo?location_name=${encodeURIComponent(selectedLocation)}`
  : `${API_BASE_URL}/traffic/upload-demo`;
        
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(errorText || `Server returned response with status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.detail || "Error processing video file.");
      }

      setResults(data);
      if (data.processed_frames && data.processed_frames.length > 0) {
        setActiveFrameStats(data.processed_frames[0]);
      }
    } catch (err) {
      if (err.message === "Failed to fetch") {
        setError("Network Error: Failed to fetch. This may be caused by an offline backend server, a CORS block, or a Render gateway timeout (exceeding 30 seconds processing time).");
      } else {
        setError(err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  // Sync video playback time with YOLO frame results
  const handleTimeUpdate = () => {
    if (!videoRef.current || !results || !results.processed_frames) return;
    const currentTime = videoRef.current.currentTime;
    setPlaybackTime(currentTime);

    // Find closest frame to current playback time
    const frames = results.processed_frames;
    let closest = frames[0];
    let minDiff = Math.abs(frames[0].timestamp - currentTime);

    for (let i = 1; i < frames.length; i++) {
      const diff = Math.abs(frames[i].timestamp - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = frames[i];
      }
    }
    setActiveFrameStats(closest);
  };

  const getStatusClass = (status) => {
    return status?.toLowerCase() || "low";
  };

  return (
    <div className="videodemo-container">
      <div className="videodemo-header glass-panel">
        <div className="videodemo-header-meta">
          <Cpu className="videodemo-header-icon text-glow-cyan" />
          <div>
            <h1>YOLOv8 AI VIDEO ANALYTICS DEMO</h1>
            <p>Upload a traffic feed video file to trigger object detection and congestion rating.</p>
          </div>
        </div>
      </div>

      <div className="videodemo-grid">
        {/* Left Side: Upload & Playback Video */}
        <div className="videodemo-left glass-panel">
          {!results ? (
            <div className="upload-section">
              {/* Tab Selector */}
              <div className="tab-container" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <button 
                  onClick={() => { setActiveTab("file"); setError(""); }} 
                  className={`tab-btn ${activeTab === "file" ? "active" : ""}`}
                  style={{
                    flexGrow: 1,
                    padding: "12px",
                    background: activeTab === "file" ? "rgba(0, 240, 255, 0.1)" : "transparent",
                    border: `1px solid ${activeTab === "file" ? "var(--color-cyan)" : "var(--glass-border)"}`,
                    color: activeTab === "file" ? "var(--color-cyan)" : "var(--text-muted)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "var(--transition-fast)"
                  }}
                >
                  📁 UPLOAD DEMO VIDEO
                </button>
                <button 
                  onClick={() => { setActiveTab("stream"); setError(""); }} 
                  className={`tab-btn ${activeTab === "stream" ? "active" : ""}`}
                  style={{
                    flexGrow: 1,
                    padding: "12px",
                    background: activeTab === "stream" ? "rgba(0, 240, 255, 0.1)" : "transparent",
                    border: `1px solid ${activeTab === "stream" ? "var(--color-cyan)" : "var(--glass-border)"}`,
                    color: activeTab === "stream" ? "var(--color-cyan)" : "var(--text-muted)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "var(--transition-fast)"
                  }}
                >
                  📹 LIVE CCTV RTSP STREAM
                </button>
              </div>

              {activeTab === "file" ? (
                <div className="upload-box glass-card">
                  <UploadCloud size={48} className="upload-icon text-glow-cyan" />
                  <h3>Upload Traffic Video</h3>
                  <p>Drag & Drop or click to select video file (MP4, AVI, MOV up to 50MB)</p>
                  
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileChange} 
                    id="video-upload-input" 
                    style={{ display: "none" }} 
                  />
                  <button 
                    onClick={() => document.getElementById("video-upload-input").click()}
                    className="glow-btn-cyan select-btn"
                  >
                    Select File
                  </button>

                  {videoFile && (
                    <div className="file-info">
                      <FileVideo size={16} />
                      <span>{videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  )}

                  {locations.length > 0 ? (
                    <div className="location-select-container glass-card" style={{
                      width: "100%",
                      padding: "15px",
                      marginTop: "15px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "8px",
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "1px solid var(--glass-border)",
                      textAlign: "left"
                    }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--color-cyan)", letterSpacing: "1px" }}>
                        CHOOSE TARGET INTERSECTION TO SYNCHRONIZE
                      </label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-primary)",
                          padding: "10px",
                          borderRadius: "6px",
                          outline: "none",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          fontWeight: "bold"
                        }}
                      >
                        <option value="">-- Select Target Location --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="location-select-container glass-card" style={{
                      width: "100%",
                      padding: "15px",
                      marginTop: "15px",
                      background: "rgba(255, 183, 0, 0.05)",
                      border: "1px solid rgba(255, 183, 0, 0.2)",
                      textAlign: "left"
                    }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--color-yellow)", letterSpacing: "1px" }}>
                        ⚠️ NO REGISTERED INTERSECTIONS
                      </label>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                        Please sign up as a <strong>Traffic Police Admin</strong> with their custom location (e.g. <em>Ghaziyabad Purana Bus Stand</em>) to automatically create a new intersection node.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="stream-box glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "15px", textAlign: "left" }}>
                  <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <Radio size={40} className="pulse-anim text-glow-cyan" style={{ color: "var(--color-cyan)" }} />
                    <h3 style={{ marginTop: "10px" }}>Government CCTV Stream Integration</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Securely link physical intersection CCTV streams (RTSP/RTMP/HTTP) to start continuous AI grid telemetry.
                    </p>
                  </div>

                  <div className="cctv-grid-inputs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: "bold", color: "var(--color-cyan)" }}>📹 North Camera (CH-1)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={streamUrlN}
                        onChange={(e) => setStreamUrlN(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--glass-border)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "0.8rem",
                          outline: "none"
                        }}
                      />
                    </div>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: "bold", color: "var(--color-cyan)" }}>📹 South Camera (CH-2)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={streamUrlS}
                        onChange={(e) => setStreamUrlS(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--glass-border)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "0.8rem",
                          outline: "none"
                        }}
                      />
                    </div>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: "bold", color: "var(--color-cyan)" }}>📹 East Camera (CH-3)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={streamUrlE}
                        onChange={(e) => setStreamUrlE(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--glass-border)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "0.8rem",
                          outline: "none"
                        }}
                      />
                    </div>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: "bold", color: "var(--color-cyan)" }}>📹 West Camera (CH-4)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={streamUrlW}
                        onChange={(e) => setStreamUrlW(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--glass-border)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          fontSize: "0.8rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-secondary)" }}>Government Security Access Token</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="Enter authorized clearance key" 
                      value={cctvPasskey}
                      onChange={(e) => setCctvPasskey(e.target.value)}
                      style={{
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--glass-border)",
                        background: "var(--bg-primary)",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                  </div>

                  {locations.length > 0 ? (
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--color-cyan)" }}>TARGET INTERSECTION NODE</label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-primary)",
                          padding: "10px",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          fontWeight: "bold",
                          outline: "none"
                        }}
                      >
                        <option value="">-- Select Target Location --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="location-select-container glass-card" style={{
                      padding: "15px",
                      background: "rgba(255, 183, 0, 0.05)",
                      border: "1px solid rgba(255, 183, 0, 0.2)"
                    }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--color-yellow)", letterSpacing: "1px" }}>
                        ⚠️ NO REGISTERED INTERSECTIONS
                      </label>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                        Please register an intersection first to bind the live CCTV feed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && <div className="demo-error-box"><AlertCircle size={16} />{error}</div>}

              {activeTab === "file" ? (
                videoFile && (
                  <button 
                    onClick={handleUpload} 
                    className="glow-btn-cyan start-detect-btn"
                    disabled={uploading}
                  >
                    {uploading ? "Running YOLOv8 Object Tracking..." : "Process Video feed"}
                  </button>
                )
              ) : (
                <button 
                  onClick={handleConnectCCTV} 
                  className="glow-btn-cyan start-detect-btn"
                  disabled={isConnectingCCTV}
                >
                  {isConnectingCCTV ? "Authenticating Clearance & Connecting..." : "Request Access & Play Live Feed"}
                </button>
              )}
            </div>
          ) : (
            <div className="playback-section">
              <div className="playback-header">
                <h4>{isCCTVConnected ? "🔴 LIVE GOVERNMENT CCTV FEED (STABLE)" : "AI VIDEO SYNCHRONIZATION"}</h4>
                <button className="glow-btn-red reset-btn" onClick={() => { setResults(null); setIsCCTVConnected(false); setVideoFile(null); setPlaybackTime(0); setActiveFrameStats(null); }}>Reset Feed</button>
              </div>

              <div className="video-player-wrapper glass-card" style={{ position: "relative", minHeight: activeTab === "cctv" ? "320px" : "auto" }}>
                {activeTab === "file" ? (
                  <>
                    <video 
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      loop
                      onTimeUpdate={handleTimeUpdate}
                      className="demo-video-player"
                      style={{ width: "100%", display: "block" }}
                    />
                    
                    {/* Real-time bounding boxes layer overlaid on the video when playing */}
                    {activeFrameStats && (
                      <div className="bounding-boxes-overlay-container" style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        right: "10px",
                        bottom: "10px",
                        pointerEvents: "none",
                        overflow: "hidden",
                        borderRadius: "8px"
                      }}>
                        {activeFrameStats.detections && activeFrameStats.detections.map((det, index) => {
                          const [x1, y1, x2, y2] = det.bbox;
                          const left = `${x1 * 100}%`;
                          const top = `${y1 * 100}%`;
                          const width = `${(x2 - x1) * 100}%`;
                          const height = `${(y2 - y1) * 100}%`;
                          
                          return (
                            <div
                              key={index}
                              className={`bounding-box-item ${det.class}`}
                              style={{
                                position: "absolute",
                                left,
                                top,
                                width,
                                height,
                                border: "2px solid #00f0ff",
                                boxShadow: "0 0 6px rgba(0, 240, 255, 0.4)",
                                transition: "all 0.08s linear"
                              }}
                            >
                              <span className="bounding-box-label" style={{
                                position: "absolute",
                                top: "-15px",
                                left: "-2px",
                                backgroundColor: "#00f0ff",
                                color: "#05050f",
                                fontSize: "8px",
                                fontWeight: "bold",
                                padding: "0.5px 3px",
                                borderRadius: "2px",
                                whiteSpace: "nowrap",
                                textTransform: "uppercase"
                              }}>
                                {det.class} {Math.round(det.confidence * 100)}%
                              </span>
                            </div>
                          );
                        })}
                        
                        {videoRef.current && !videoRef.current.paused && (
                          <div className="scanner-line fast"></div>
                        )}
                        <span className="live-ai-overlay-tag">YOLOv8 DEPLOYED</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* 2x2 Grid of 4 cameras for RTSP streams! */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", background: "#060a13", borderRadius: "8px", width: "100%" }}>
                    
                    {/* CAM-1: North Bound */}
                    <div style={{ position: "relative", minHeight: "140px", border: "1px solid rgba(0, 240, 255, 0.15)", background: "#000", display: "flex", flexDirection: "column", borderRadius: "4px" }}>
                      <div style={{ fontSize: "0.65rem", padding: "4px 8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "var(--color-cyan)" }}>CH-1: NORTH BORDER APPROACH</span>
                        <span style={{ color: "var(--color-green)", textShadow: "0 0 5px var(--color-green)" }}>● LIVE</span>
                      </div>
                      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-intersection-traffic-in-a-busy-city-at-night-42656-large.mp4"
                          autoPlay
                          muted
                          loop
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", color: "#fff", fontSize: "0.65rem", background: "rgba(0,0,0,0.7)", padding: "3px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                          CARS: {Math.max(2, Math.round((activeFrameStats?.vehicle_counts?.car || 8) * 1.1))}
                        </div>
                      </div>
                    </div>

                    {/* CAM-2: South Bound */}
                    <div style={{ position: "relative", minHeight: "140px", border: "1px solid rgba(0, 240, 255, 0.15)", background: "#000", display: "flex", flexDirection: "column", borderRadius: "4px" }}>
                      <div style={{ fontSize: "0.65rem", padding: "4px 8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "var(--color-cyan)" }}>CH-2: SOUTH BORDER APPROACH</span>
                        <span style={{ color: "var(--color-green)", textShadow: "0 0 5px var(--color-green)" }}>● LIVE</span>
                      </div>
                      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-intersection-traffic-in-a-busy-city-at-night-42656-large.mp4"
                          autoPlay
                          muted
                          loop
                          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                        />
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", color: "#fff", fontSize: "0.65rem", background: "rgba(0,0,0,0.7)", padding: "3px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                          CARS: {Math.max(1, Math.round((activeFrameStats?.vehicle_counts?.car || 8) * 0.95))}
                        </div>
                      </div>
                    </div>

                    {/* CAM-3: East Bound */}
                    <div style={{ position: "relative", minHeight: "140px", border: "1px solid rgba(0, 240, 255, 0.15)", background: "#000", display: "flex", flexDirection: "column", borderRadius: "4px" }}>
                      <div style={{ fontSize: "0.65rem", padding: "4px 8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "var(--color-cyan)" }}>CH-3: EAST CROSS APPROACH</span>
                        <span style={{ color: "var(--color-green)", textShadow: "0 0 5px var(--color-green)" }}>● LIVE</span>
                      </div>
                      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-intersection-traffic-in-a-busy-city-at-night-42656-large.mp4"
                          autoPlay
                          muted
                          loop
                          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }}
                        />
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", color: "#fff", fontSize: "0.65rem", background: "rgba(0,0,0,0.7)", padding: "3px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                          CARS: {Math.max(1, Math.round((activeFrameStats?.vehicle_counts?.car || 8) * 0.75))}
                        </div>
                      </div>
                    </div>

                    {/* CAM-4: West Bound */}
                    <div style={{ position: "relative", minHeight: "140px", border: "1px solid rgba(0, 240, 255, 0.15)", background: "#000", display: "flex", flexDirection: "column", borderRadius: "4px" }}>
                      <div style={{ fontSize: "0.65rem", padding: "4px 8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "var(--color-cyan)" }}>CH-4: WEST CROSS APPROACH</span>
                        <span style={{ color: "var(--color-green)", textShadow: "0 0 5px var(--color-green)" }}>● LIVE</span>
                      </div>
                      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-intersection-traffic-in-a-busy-city-at-night-42656-large.mp4"
                          autoPlay
                          muted
                          loop
                          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "hue-rotate(60deg)" }}
                        />
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", color: "#fff", fontSize: "0.65rem", background: "rgba(0,0,0,0.7)", padding: "3px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                          CARS: {Math.max(1, Math.round((activeFrameStats?.vehicle_counts?.car || 8) * 0.6))}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
              <p className="playback-tip"><AlertTriangle size={12} className="bullet-warn" /> Play the video to watch the AI metrics synchronize frame-by-frame.</p>
            </div>
          )}
        </div>

        {/* Right Side: YOLO Analytics Output */}
        <div className="videodemo-right">
          {results ? (
            <div className="analytics-output glass-panel">
              <div className="output-header border-bottom">
                <h3>YOLO DETECTOR TELEMETRY</h3>
                <span className="engine-badge font-mono">{results.detection_method}</span>
              </div>

              {/* Dynamic playback statistics */}
              <div className="stats-header-row">
                <div className="stat-card glass-card">
                  <span className="stat-lbl">CURRENT DENSITY</span>
                  <span className="stat-val font-mono text-glow-cyan">
                    {activeFrameStats ? activeFrameStats.density.toFixed(1) : results.density.toFixed(1)}%
                  </span>
                </div>
                <div className="stat-card glass-card">
                  <span className="stat-lbl">CONGESTION RATING</span>
                  <span className={`stat-val text-glow-${getStatusClass(activeFrameStats ? (activeFrameStats.density < 20 ? "Low" : activeFrameStats.density < 50 ? "Medium" : activeFrameStats.density < 80 ? "Heavy" : "Gridlock") : results.traffic_status)}`}>
                    {activeFrameStats ? (activeFrameStats.density < 20 ? "Low" : activeFrameStats.density < 50 ? "Medium" : activeFrameStats.density < 80 ? "Heavy" : "Gridlock") : results.traffic_status}
                  </span>
                </div>
              </div>

              {/* Real-time Vehicle Counts */}
              <div className="yolo-counts-card glass-card">
                <h4>ACTIVE VEHICLE TRACKS (REAL-TIME)</h4>
                <div className="yolo-vehicle-grid">
                  {Object.entries(activeFrameStats?.vehicle_counts || results.vehicle_counts).map(([vehicle, count]) => (
                    <div key={vehicle} className="yolo-veh-item">
                      <Car size={16} className="veh-icon" />
                      <div className="veh-details">
                        <span className="veh-name">{vehicle.toUpperCase()}</span>
                        <span className="veh-count font-mono">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live 4-Way Adaptive Signal HUD */}
              <div className="yolo-counts-card glass-card" style={{ marginTop: "15px", padding: "15px" }}>
                <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px 0" }}>
                  <span>🚦 4-WAY ADAPTIVE SIGNALS</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--color-yellow)", fontWeight: "bold", background: "rgba(255,204,0,0.05)", padding: "2px 6px", borderRadius: "3px", border: "1px solid rgba(255,204,0,0.15)" }}>
                    🤖 AI OPTIMIZED LOOP
                  </span>
                </h4>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.01)", padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--glass-border)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                    <div><strong>ACTIVE AXIS:</strong> {signalPhase === 0 ? "NORTH-SOUTH CLEARANCE PRIORITY" : "EAST-WEST CLEARANCE PRIORITY"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span>TIMER: <strong style={{ color: "var(--color-cyan)" }}>{signalTimer}s</strong> / {maxGreenTime}s</span>
                      <span>MODE: <strong style={{ color: "var(--color-green)" }}>DYNAMIC ADAPTIVE</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {/* North Light */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", border: "1px solid var(--glass-border)", borderRadius: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>NORTH LIGHT</span>
                        <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {signalPhase === 0 ? "🟢 GREEN" : "🔴 RED"}
                        </strong>
                      </div>
                      <div style={{ marginLeft: "auto", width: "12px", height: "12px", borderRadius: "50%", background: signalPhase === 0 ? "#00ff66" : "#ff3333", boxShadow: signalPhase === 0 ? "0 0 10px #00ff66" : "0 0 10px #ff3333" }}></div>
                    </div>

                    {/* South Light */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", border: "1px solid var(--glass-border)", borderRadius: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>SOUTH LIGHT</span>
                        <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {signalPhase === 0 ? "🟢 GREEN" : "🔴 RED"}
                        </strong>
                      </div>
                      <div style={{ marginLeft: "auto", width: "12px", height: "12px", borderRadius: "50%", background: signalPhase === 0 ? "#00ff66" : "#ff3333", boxShadow: signalPhase === 0 ? "0 0 10px #00ff66" : "0 0 10px #ff3333" }}></div>
                    </div>

                    {/* East Light */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", border: "1px solid var(--glass-border)", borderRadius: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>EAST LIGHT</span>
                        <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {signalPhase === 1 ? "🟢 GREEN" : "🔴 RED"}
                        </strong>
                      </div>
                      <div style={{ marginLeft: "auto", width: "12px", height: "12px", borderRadius: "50%", background: signalPhase === 1 ? "#00ff66" : "#ff3333", boxShadow: signalPhase === 1 ? "0 0 10px #00ff66" : "0 0 10px #ff3333" }}></div>
                    </div>

                    {/* West Light */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", border: "1px solid var(--glass-border)", borderRadius: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>WEST LIGHT</span>
                        <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {signalPhase === 1 ? "🟢 GREEN" : "🔴 RED"}
                        </strong>
                      </div>
                      <div style={{ marginLeft: "auto", width: "12px", height: "12px", borderRadius: "50%", background: signalPhase === 1 ? "#00ff66" : "#ff3333", boxShadow: signalPhase === 1 ? "0 0 10px #00ff66" : "0 0 10px #ff3333" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Chart representation */}
              <div className="output-chart-card glass-card">
                <h4>CONGESTION TRACK OVER TIME (seconds)</h4>
                
                {/* SVG Area Chart */}
                <div className="chart-container">
                  <svg className="analytics-chart-svg" viewBox="0 0 300 120">
                    <defs>
                      <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>
                    
                    {/* Gridlines */}
                    <line x1="0" y1="30" x2="300" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                    <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                    <line x1="0" y1="90" x2="300" y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                    
                    {/* Graph Path */}
                    {results.processed_frames && results.processed_frames.length > 1 && (() => {
                      const frames = results.processed_frames;
                      const maxTime = results.duration || 1;
                      
                      // Build path coordinates
                      const points = frames.map((f, i) => {
                        const x = (f.timestamp / maxTime) * 300;
                        const y = 110 - (f.density / 100) * 100;
                        return `${x},${y}`;
                      }).join(" ");
                      
                      const fillPath = `0,110 ${points} 300,110`;
                      
                      return (
                        <>
                          {/* Filled Area */}
                          <polygon points={fillPath} fill="url(#chart-glow)" />
                          {/* Line */}
                          <polyline points={points} fill="none" stroke="var(--color-cyan)" strokeWidth="2.5" />
                          
                          {/* Current time vertical indicator */}
                          {playbackTime > 0 && (
                            <line 
                              x1={(playbackTime / maxTime) * 300} 
                              y1="0" 
                              x2={(playbackTime / maxTime) * 300} 
                              y2="110" 
                              stroke="var(--color-yellow)" 
                              strokeWidth="1.5"
                              strokeDasharray="2"
                            />
                          )}
                        </>
                      );
                    })()}
                  </svg>
                </div>
                
                <div className="chart-x-labels">
                  <span>0.00s</span>
                  <span>{(results.duration / 2).toFixed(1)}s</span>
                  <span>{results.duration.toFixed(1)}s</span>
                </div>
              </div>

              {/* General Metadata */}
              <div className="video-meta-box">
                <div className="meta-row">
                  <span>VIDEO DURATION</span>
                  <span className="font-mono">{results.duration} seconds</span>
                </div>
                <div className="meta-row">
                  <span>SAMPLED FRAMES</span>
                  <span className="font-mono">{results.processed_frames?.length} frames</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-output glass-panel">
              <BarChart3 size={48} className="no-output-icon" />
              <h3>Awaiting AI Telemetry</h3>
              <p>Upload a video feed to view real-time YOLO parameters and object classification charts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
