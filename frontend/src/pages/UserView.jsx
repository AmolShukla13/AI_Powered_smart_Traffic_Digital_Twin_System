import React, { useState, useEffect } from "react";
import { Search, MapPin, AlertTriangle, CloudRain, Shield, RefreshCw, Navigation, Car, AlertOctagon, Ambulance, Lock } from "lucide-react";
import "./UserView.css";

export default function UserView() {
  const [locations, setLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [weather, setWeather] = useState("Clear");
  const [riskReport, setRiskReport] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Emergency SOS state
  const [emergencyType, setEmergencyType] = useState("Ambulance");
  const [emergencyStart, setEmergencyStart] = useState("");
  const [emergencyDest, setEmergencyDest] = useState("");
  const [sosSent, setSosSent] = useState(false);
  const [emergencies, setEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [sosError, setSosError] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);

  const assigned = sessionStorage.getItem("assigned_location");
  const activeEmergencies = emergencies.filter(e => {
    if (e.status === "Cleared") return false;
    if (assigned) {
      return e.route && e.route.includes(assigned);
    }
    return true;
  });

  // Sync selected location to session storage for other citizen portals (like Accident Prediction)
  useEffect(() => {
    if (selectedLoc) {
      sessionStorage.setItem("active_citizen_location", selectedLoc.name);
      if (selectedLoc.isUnregistered) {
        sessionStorage.setItem("active_citizen_location_details", JSON.stringify(selectedLoc));
      } else {
        sessionStorage.removeItem("active_citizen_location_details");
      }
    } else {
      sessionStorage.removeItem("active_citizen_location");
      sessionStorage.removeItem("active_citizen_location_details");
    }
  }, [selectedLoc]);

  // Fetch locations on mount and poll periodically to update telemetry in real-time
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(() => {
      fetchLocations(searchQuery, true); // silent background poll
    }, 3000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  // Fetch emergency requests periodically
  const fetchEmergencies = async () => {
    try {
      const res = await fetch("https://smart-traffic-backend-q3q9.onrender.com/traffic/emergencies");
      if (res.ok) {
        const data = await res.json();
        setEmergencies(data);
        
        // Update selected emergency state
        if (selectedEmergency) {
          const updated = data.find(e => e.id === selectedEmergency.id);
          if (updated) setSelectedEmergency(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching emergencies:", err);
    }
  };

  useEffect(() => {
    fetchEmergencies();
    const interval = setInterval(fetchEmergencies, 3000);
    return () => clearInterval(interval);
  }, [selectedEmergency]);

  const detectLiveLocation = () => {
    setSearchError("");
    setLoading(true);

    const handleSuccess = async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserCoords({ latitude: lat, longitude: lng });

      try {
        let detectedName = "Current Location";
        try {
          const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            headers: { "Accept-Language": "en" }
          });
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json();
            if (reverseData && reverseData.address) {
              detectedName = reverseData.address.town || 
                             reverseData.address.city || 
                             reverseData.address.village || 
                             reverseData.address.suburb || 
                             reverseData.display_name.split(",")[0] || 
                             "Current Location";
            }
          }
        } catch (err) {
          console.error("Reverse geocoding error:", err);
        }

        const res = await fetch("https://smart-traffic-backend-q3q9.onrender.com/traffic/locations");
        if (res.ok) {
          const dbData = await res.json();
          
          let closest = null;
          let minDist = Infinity;
          
          dbData.forEach((loc) => {
            const dist = Math.sqrt(Math.pow(loc.latitude - lat, 2) + Math.pow(loc.longitude - lng, 2));
            if (dist < minDist) {
              minDist = dist;
              closest = loc;
            }
          });

          if (closest && minDist < 0.01) {
            setSelectedLoc(closest);
            setSearchQuery(closest.name);
            setLocations([closest]);
          } else {
            const virtualPlace = {
              id: "my-loc",
              name: detectedName,
              latitude: lat,
              longitude: lng,
              traffic_status: "OFFLINE",
              manual_override: false,
              red_time: 0,
              green_time: 0,
              yellow_time: 0,
              current_density: 0,
              vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
              is_video_data: false,
              has_admin: false,
              isUnregistered: true
            };
            setSelectedLoc(virtualPlace);
            setSearchQuery(detectedName);
            setLocations([virtualPlace]);
          }
        }
      } catch (err) {
        console.error("Error setting location:", err);
      } finally {
        setLoading(false);
      }
    };

    const handleIPFallback = async () => {
      console.log("Attempting IP-based geolocation fallback...");
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            console.log("IP Geolocation successful:", ipData.city, ipData.latitude, ipData.longitude);
            const position = {
              coords: {
                latitude: ipData.latitude,
                longitude: ipData.longitude
              }
            };
            await handleSuccess(position);
            return;
          }
        }
      } catch (ipErr) {
        console.error("IP Geolocation fallback failed:", ipErr);
      }
      setLoading(false);
    };

    if (!navigator.geolocation) {
      handleIPFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        console.warn("High-accuracy location request failed, retrying with standard accuracy...", err);
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err2) => {
            console.warn("Standard accuracy geolocation failed, falling back to IP geolocation...", err2);
            if (err2.code === 1 || err.code === 1) {
              setSearchError("📍 Browser GPS is Blocked. Showing network IP location (Maghar). To get your exact location (Maholi), click the lock icon in the URL bar and select 'Allow' location.");
              setTimeout(() => setSearchError(""), 12000);
            }
            handleIPFallback();
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: Infinity }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Mount useEffect: Load locations natively on boot, no permissions requested on load
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async (search = "", isBackground = false) => {
    if (selectedLoc?.isUnregistered) {
      // Don't poll DB for unregistered search fallbacks
      return;
    }

    const assigned = sessionStorage.getItem("assigned_location");
    if (!search.trim() && !assigned) {
      setLocations([]);
      setSelectedLoc(null);
      if (!isBackground) setLoading(false);
      return;
    }

    if (!isBackground) setLoading(true);
    try {
      const url = search 
        ? `https://smart-traffic-backend-q3q9.onrender.com/traffic/locations?search=${encodeURIComponent(search)}`
        : "https://smart-traffic-backend-q3q9.onrender.com/traffic/locations";
      const res = await fetch(url);
      const data = await res.json();
      
      const filteredData = assigned 
        ? data.filter(loc => loc.name.toLowerCase() === assigned.toLowerCase()) 
        : data;

      setLocations(filteredData);
      setAllLocations(data);
      
      // Auto-select first location if none selected
      if (filteredData.length > 0 && !selectedLoc) {
        const matched = assigned ? filteredData.find(l => l.name.toLowerCase() === assigned.toLowerCase()) : null;
        setSelectedLoc(matched || filteredData[0]);
      } else if (selectedLoc) {
        const updated = filteredData.find(l => l.name === selectedLoc.name);
        if (updated) setSelectedLoc(updated);
      }

      // Prepopulate SOS fields using full global nodes list
      if (data.length > 0) {
        if (!emergencyStart) {
          setEmergencyStart(assigned || data[0].name);
        }
        if (!emergencyDest) {
          const dest = data.find(l => l.name !== assigned);
          setEmergencyDest(dest ? dest.name : data[0].name);
        }
      }
    } catch (err) {
      console.error("Error fetching locations:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    
    if (!searchQuery.trim()) {
      fetchLocations("");
      return;
    }

    setLoading(true);
    try {
      // 1. Search in local database
      const url = `https://smart-traffic-backend-q3q9.onrender.com/traffic/locations?search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      const assigned = sessionStorage.getItem("assigned_location");
      const filteredData = assigned 
        ? data.filter(loc => loc.name.toLowerCase() === assigned.toLowerCase()) 
        : data;

      if (filteredData.length > 0) {
        setLocations(filteredData);
        setSelectedLoc(filteredData[0]);
        setLoading(false);
      } else {
        // 2. Local search failed. Fallback to OpenStreetMap Nominatim API
        setIsSearchingExternal(true);
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
        const geoRes = await fetch(geoUrl, {
          headers: { "Accept-Language": "en" }
        });
        
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            const externalPlace = {
              id: "ext-" + Date.now(),
              name: geoData[0].display_name.split(",")[0] || searchQuery,
              latitude: parseFloat(geoData[0].lat),
              longitude: parseFloat(geoData[0].lon),
              traffic_status: "OFFLINE",
              manual_override: false,
              red_time: 0,
              green_time: 0,
              yellow_time: 0,
              current_density: 0,
              vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
              is_video_data: false,
              has_admin: false,
              isUnregistered: true
            };
            setLocations([externalPlace]);
            setSelectedLoc(externalPlace);
          } else {
            setLocations([]);
            setSelectedLoc(null);
            setSearchError(`🔍 No registered intersections or places matching '${searchQuery}' were found. Please try another search (e.g. Sitapur Junction or Rajiv Chowk).`);
          }
        } else {
          setLocations([]);
          setSelectedLoc(null);
          setSearchError("Network geocoding search failed. Please try a registered intersection name.");
        }
        setIsSearchingExternal(false);
        setLoading(false);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Failed to search grid topology.");
      setLoading(false);
    }
  };

  const handleSelectLocation = (loc) => {
    setSelectedLoc(loc);
    setRiskReport(null);
  };

  // Live Auto-running Accident Risk Prediction whenever selected location or its parameters change
  useEffect(() => {
    if (selectedLoc) {
      const isTelemetryActive = selectedLoc.has_admin && (selectedLoc.is_video_data || selectedLoc.manual_override);
      if (isTelemetryActive) {
        const runAutoPredict = async () => {
          setPredicting(true);
          try {
            const weatherToUse = selectedLoc.predicted_weather || "Clear";
            const res = await fetch(
              `https://smart-traffic-backend-q3q9.onrender.com/traffic/predict-accident/${encodeURIComponent(selectedLoc.name)}?weather=${weatherToUse}`
            );
            if (res.ok) {
              const data = await res.json();
              setRiskReport(data);
            }
          } catch (err) {
            console.error("Error auto-running prediction:", err);
          } finally {
            setPredicting(false);
          }
        };
        runAutoPredict();
      } else {
        setRiskReport(null);
      }
    } else {
      setRiskReport(null);
    }
  }, [selectedLoc?.name, selectedLoc?.traffic_status, selectedLoc?.predicted_weather, selectedLoc?.is_video_data, selectedLoc?.manual_override]);

  const getStatusClass = (status) => {
    return status?.toLowerCase() || "low";
  };

  return (
    <div className="userview-container">
      {/* Search Header */}
      <div className="search-header glass-panel">
        <div className="header-meta">
          <Navigation className="header-icon text-glow-cyan" />
          <div>
            <h1>CITY TRAFFIC GRID PORTAL</h1>
            {sessionStorage.getItem("assigned_location") ? (
              <span className="location-auth-tag restricted" style={{
                fontSize: "0.75rem",
                color: "var(--color-yellow)",
                border: "1px solid rgba(255, 183, 0, 0.4)",
                padding: "3px 8px",
                borderRadius: "4px",
                fontWeight: "bold",
                background: "rgba(255, 183, 0, 0.05)",
                display: "inline-block",
                marginTop: "4px"
              }}>
                🔒 RESTRICTED POLICE VIEW: {sessionStorage.getItem("assigned_location")}
              </span>
            ) : (
              <p>Citizen Digital Twin Access & Real-Time Congestion Index</p>
            )}
          </div>
        </div>
        
        {!sessionStorage.getItem("assigned_location") && (
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search intersection, street name (e.g. Connaught Place)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="glow-btn-cyan">Search Grid</button>
            <button 
              type="button" 
              onClick={detectLiveLocation} 
              className="glow-btn-cyan" 
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0, 240, 255, 0.05)", border: "1px solid var(--color-cyan)", padding: "0 15px", height: "42px", borderRadius: "4px" }}
              title="Detect my current location"
            >
              <Navigation size={14} style={{ transform: "rotate(45deg)" }} />
              <span>Locate Me</span>
            </button>
          </form>
        )}
      </div>

      {/* Grid Layout */}
      <div className="userview-grid">
        {/* Left Side - Interactive Digital Twin Node Selector */}
        <div className="grid-left glass-panel">
          <div className="panel-title">
            <h3>DIGITAL TWIN TOPOLOGY</h3>
            <button className="refresh-btn" onClick={() => fetchLocations(searchQuery)}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
          
          {/* Live GIS Interactive Map Centered on Selected Intersection */}
          <div className="mock-map-container glass-card" style={{ padding: "6px", height: "320px", display: "flex", flexDirection: "column", border: "1px solid var(--glass-border)", borderRadius: "8px", overflow: "hidden", background: "var(--bg-secondary)", marginBottom: "15px" }}>
            {selectedLoc ? (
              <iframe
                title="Geographical Digital Twin Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedLoc.longitude - 0.008}%2C${selectedLoc.latitude - 0.006}%2C${selectedLoc.longitude + 0.008}%2C${selectedLoc.latitude + 0.006}&layer=mapnik&marker=${selectedLoc.latitude}%2C${selectedLoc.longitude}`}
                style={{
                  border: "none",
                  borderRadius: "6px",
                  flexGrow: 1,
                  filter: "contrast(1.1) brightness(0.9)"
                }}
              ></iframe>
            ) : (
              <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Select an intersection to load telemetry map.
              </div>
            )}
          </div>

          <div className="location-list">
            {searchError ? (
              <div className="glass-card" style={{ padding: "15px", border: "1px solid rgba(255, 170, 0, 0.3)", background: "rgba(255, 170, 0, 0.05)", borderRadius: "6px", color: "var(--color-yellow)", fontSize: "0.8rem", lineHeight: "1.4" }}>
                {searchError}
              </div>
            ) : isSearchingExternal ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                🔍 Querying global GIS registry for '{searchQuery}'...
              </div>
            ) : locations.length === 0 ? (
              <p className="no-nodes">
                {!searchQuery.trim() && !sessionStorage.getItem("assigned_location")
                  ? "Please search for an intersection above (e.g. Rajiv Chowk) to verify live status."
                  : "No intersections connected."}
              </p>
            ) : (
              locations.map(loc => (
                <div 
                  key={loc.id} 
                  className={`location-list-item glass-card ${selectedLoc?.name === loc.name ? "active" : ""}`}
                  onClick={() => handleSelectLocation(loc)}
                >
                  <MapPin size={16} className="loc-pin" />
                  <div className="loc-meta">
                    <span className="loc-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.name}</span>
                    <span className="loc-coords">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                    <span className={`status-badge ${loc.has_admin && (loc.is_video_data || loc.manual_override) ? getStatusClass(loc.traffic_status) : "low"}`}>
                      {loc.isUnregistered ? "UNREGISTERED" : (loc.has_admin && (loc.is_video_data || loc.manual_override) ? loc.traffic_status : "OFFLINE")}
                    </span>
                    {loc.has_admin && loc.is_video_data && (
                      <span className="live-feed-badge-pulse" style={{ fontSize: "0.6rem", color: "var(--color-green)", display: "flex", alignItems: "center", gap: "3px", fontWeight: "bold" }}>
                        <span className="blink-dot"></span>
                        AI VIDEO LIVE
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Intersection Analytics View */}
        <div className="grid-right">
          {selectedLoc ? (() => {
            const isTelemetryActive = selectedLoc.has_admin && (selectedLoc.is_video_data || selectedLoc.manual_override);
            return (
              <div className="analytics-details glass-panel">
                {/* Custom warning message if location is found externally but not registered in the system (like Hardoi) */}
                {selectedLoc.isUnregistered ? (
                  <div style={{ background: "rgba(255, 170, 0, 0.08)", border: "1px solid var(--color-yellow)", color: "var(--color-yellow)", padding: "12px 15px", borderRadius: "6px", fontSize: "0.75rem", marginBottom: "15px", lineHeight: "1.4", fontWeight: "bold" }}>
                    ⚠️ Location Unregistered: '{selectedLoc.name}' is not enrolled in the Traffic Digital Twin grid. Live AI telemetry is unavailable.
                  </div>
                ) : !selectedLoc.has_admin ? (
                  <div style={{ background: "rgba(255, 0, 85, 0.08)", border: "1px solid #ff0055", color: "#ff0055", padding: "12px 15px", borderRadius: "6px", fontSize: "0.75rem", marginBottom: "15px", lineHeight: "1.4", fontWeight: "bold" }}>
                    ⚠️ Sorry: This intersection does not have an active Traffic Officer assigned to it. Live telemetry is offline.
                  </div>
                ) : null}
                
                <div className="details-header">
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedLoc.name}</h2>
                    {isTelemetryActive && selectedLoc.is_video_data && (
                      <div style={{ marginTop: "6px" }}>
                        <span className="live-feed-alert-tag" style={{
                          background: "rgba(0, 255, 102, 0.1)",
                          border: "1px solid var(--color-green)",
                          color: "var(--color-green)",
                          fontSize: "0.7rem",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontWeight: "700",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}>
                          <span className="blink-dot"></span>
                          REAL-TIME VIDEO STREAM TELEMETRY ACTIVE
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mode-tag glass-card">
                    {!selectedLoc.has_admin ? (
                      <span className="override-badge red" style={{ background: "rgba(255,0,85,0.15)", color: "#ff0055", border: "1px solid rgba(255,0,85,0.3)" }}>OFFLINE</span>
                    ) : selectedLoc.manual_override ? (
                      <span className="override-badge red">MANUAL OVERRIDE BY POLICE</span>
                    ) : (
                      <span className="override-badge green">AI OPTIMIZATION AUTO-RUNNING</span>
                    )}
                  </div>
                </div>
                {/* Status Row */}
                <div className="metrics-grid">
                  <div className="metric-box glass-card">
                    <span className="metric-title">TRAFFIC STATUS</span>
                    <span className={`metric-value text-glow-${isTelemetryActive ? getStatusClass(selectedLoc.traffic_status) : "low"}`} style={{ color: !isTelemetryActive ? "var(--text-muted)" : "" }}>
                      {isTelemetryActive ? selectedLoc.traffic_status : "OFFLINE"}
                    </span>
                  </div>
                  <div className="metric-box glass-card">
                    <span className="metric-title">GRID DENSITY</span>
                    <span className="metric-value font-mono text-glow-cyan">
                      {isTelemetryActive ? selectedLoc.current_density.toFixed(1) : "0.0"}%
                    </span>
                    <div className="density-progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: isTelemetryActive ? `${selectedLoc.current_density}%` : "0%",
                          backgroundColor: isTelemetryActive ? `var(--color-${getStatusClass(selectedLoc.traffic_status)})` : "var(--text-muted)"
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="metric-box glass-card">
                    <span className="metric-title">TRAFFIC LIGHT TIMINGS</span>
                    <div className="light-timers">
                      <div className="timer-circle red">{isTelemetryActive ? selectedLoc.red_time : 0}s</div>
                      <div className="timer-circle yellow">{isTelemetryActive ? selectedLoc.yellow_time : 0}s</div>
                      <div className="timer-circle green">{isTelemetryActive ? selectedLoc.green_time : 0}s</div>
                    </div>
                  </div>
                </div>

                {/* Vehicle Counts Visual */}
                <div className="vehicle-analytics glass-card">
                  <h4>AI VEHICLE DENSITY BREAKDOWN</h4>
                  <div className="vehicle-bars">
                    {Object.entries(isTelemetryActive ? (selectedLoc.vehicle_counts || {}) : { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 }).map(([vehicle, count]) => (
                      <div className="vehicle-bar-row" key={vehicle}>
                        <span className="vehicle-name"><Car size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} /> {vehicle.toUpperCase()}</span>
                        <div className="vehicle-progress-track">
                          <div className="vehicle-progress-fill" style={{ width: isTelemetryActive ? `${Math.min(100, (count / 120) * 100)}%` : "0%" }}></div>
                        </div>
                        <span className="vehicle-count font-mono">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="no-selection glass-panel">
              <MapPin size={48} className="no-selection-icon" />
              <h3>{!searchQuery.trim() && !sessionStorage.getItem("assigned_location") ? "Digital Twin Search Ready" : "No Intersection Selected"}</h3>
              <p>{!searchQuery.trim() && !sessionStorage.getItem("assigned_location") ? "Search and select an active node from the digital twin topology map to review real-time AI telemetry." : "Select an active node from the digital twin topology map on the left to review metrics."}</p>
            </div>
          )}
        </div>
      </div>

      {selectedLoc && (
        <div className="userview-bottom-sections" style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", marginTop: "20px" }}>
          {/* Accident Risk Predictor */}
          <div className="accident-predictor glass-card" style={{ width: "100%", margin: 0 }}>
            {(() => {
              const isTelemetryActive = selectedLoc.has_admin && (selectedLoc.is_video_data || selectedLoc.manual_override);
              return (
                <>
                  <div className="predictor-header">
                    <div>
                      <h4>ACCIDENT PREDICTION & RISK INDEX</h4>
                      <p className="sub-text">Evaluates probability based on weather conditions and road density.</p>
                    </div>
                    {isTelemetryActive && (
                      <div className="weather-selector-wrapper" style={{ padding: "4px 10px", background: "rgba(0,240,255,0.05)", borderRadius: "4px", border: "1px solid rgba(0,240,255,0.15)", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", color: "var(--color-cyan)" }}>
                        <CloudRain size={14} />
                        <span>LIVE WEATHER: <strong style={{ textTransform: "uppercase" }}>{selectedLoc.predicted_weather || "Clear"}</strong></span>
                      </div>
                    )}
                  </div>

                  {isTelemetryActive ? (
                    predicting && !riskReport ? (
                      <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        Running neural risk predictor...
                      </div>
                    ) : riskReport ? (
                      <div className="prediction-results animated-field" style={{ marginTop: 0 }}>
                        <div className="risk-level-display">
                          <AlertOctagon size={24} className={`risk-icon ${riskReport.risk_level.toLowerCase()}`} />
                          <div>
                            <span className="risk-label">RISK FACTOR LEVEL</span>
                            <h3 className={`risk-value ${riskReport.risk_level.toLowerCase()}`}>
                              {riskReport.risk_level} ({Math.round(riskReport.probability * 100)}%)
                            </h3>
                          </div>
                        </div>

                        <div className="results-grid">
                          <div className="results-column">
                            <h5>CONTRIBUTING RISK FACTORS</h5>
                            <ul>
                              {riskReport.contributing_factors.map((factor, idx) => (
                                 <li key={idx}><AlertTriangle size={12} className="bullet-warn" /> {factor}</li>
                              ))}
                              {riskReport.contributing_factors.length === 0 && <li>None detected. Safe environment.</li>}
                            </ul>
                          </div>

                          <div className="results-column">
                            <h5>AI MITIGATION & SAFETY SUGGESTIONS</h5>
                            <ul>
                              {riskReport.safety_suggestions.map((suggestion, idx) => (
                                <li key={idx}><Shield size={12} className="bullet-shield" /> {suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null
                  ) : (
                    <div className="risk-offline-notice" style={{
                      padding: "15px",
                      textAlign: "center",
                      background: "rgba(255, 183, 0, 0.05)",
                      border: "1px solid rgba(255, 183, 0, 0.2)",
                      borderRadius: "6px",
                      marginTop: "10px"
                    }}>
                      <AlertTriangle size={24} style={{ color: "var(--color-yellow)", marginBottom: "8px" }} />
                      <h5 style={{ color: "var(--color-yellow)", margin: "0 0 4px 0" }}>RISK INDEX OFFLINE</h5>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.4" }}>
                        AI Risk Index assessment requires live traffic telemetry from an active traffic administrator.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Citizen Emergency SOS Panel */}
          <div className="emergency-sos-panel glass-card" style={{ width: "100%", margin: 0, border: "1px solid rgba(255, 0, 85, 0.2)" }}>
            <div className="panel-header" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
              <Ambulance className="text-glow-red" style={{ color: "#ff0055" }} size={24} />
              <div>
                <h4 style={{ margin: 0, color: "#ff0055" }}>CITIZEN EMERGENCY SOS REQUEST</h4>
                <p className="sub-text" style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Request priority route clearing for emergency services.
                </p>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setSosError("");
              if (emergencyStart === emergencyDest) {
                setSosError("Start and destination intersections cannot be the same.");
                return;
              }
              
              try {
                const res = await fetch("https://smart-traffic-backend-q3q9.onrender.com/traffic/emergency", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: emergencyType,
                    start_location: emergencyStart,
                    destination_location: emergencyDest
                  })
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.detail || "SOS submission failed");
                }
                setSosSent(true);
                fetchEmergencies();
                setSelectedEmergency(data);
                setTimeout(() => setSosSent(false), 3000);
              } catch (err) {
                setSosError(err.message);
              }
            }} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>VEHICLE TYPE</label>
                  <select 
                    value={emergencyType} 
                    onChange={(e) => setEmergencyType(e.target.value)}
                    style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--glass-border)", padding: "8px", borderRadius: "6px", fontSize: "0.8rem", outline: "none" }}
                  >
                    <option value="Ambulance">Ambulance 🚑</option>
                    <option value="Fire">Fire Engine 🚒</option>
                    <option value="Police">Police Cruiser 🚓</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>START NODE</label>
                  <select 
                    value={emergencyStart} 
                    onChange={(e) => setEmergencyStart(e.target.value)}
                    style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--glass-border)", padding: "8px", borderRadius: "6px", fontSize: "0.8rem", outline: "none" }}
                  >
                    {allLocations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name.split(" ")[0]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>DESTINATION NODE</label>
                  <select 
                    value={emergencyDest} 
                    onChange={(e) => setEmergencyDest(e.target.value)}
                    style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--glass-border)", padding: "8px", borderRadius: "6px", fontSize: "0.8rem", outline: "none" }}
                  >
                    {allLocations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name.split(" ")[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {sosError && <div style={{ color: "var(--color-red)", fontSize: "0.8rem" }}>{sosError}</div>}
              {sosSent && <div style={{ color: "var(--color-green)", fontSize: "0.8rem" }}>SOS Request Sent Successfully! Notify Command Center.</div>}

              <button type="submit" className="glow-btn-red" style={{ width: "100%", padding: "10px", fontSize: "0.85rem", fontWeight: "bold" }}>
                ACTIVATE SOS DISPATCH
              </button>
            </form>

            {/* Active emergencies list */}
            {activeEmergencies.length > 0 && (
              <div className="active-sos-list" style={{ marginTop: "15px", borderTop: "1px solid var(--glass-border)", paddingTop: "10px" }}>
                <h5 style={{ fontSize: "0.75rem", margin: "0 0 8px 0", color: "var(--text-secondary)", letterSpacing: "0.5px" }}>ACTIVE SOS TRAFFIC ROUTING</h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                  {activeEmergencies.map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => setSelectedEmergency(e)}
                      className={`sos-item glass-card ${selectedEmergency?.id === e.id ? "active" : ""}`}
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "8px 12px", 
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        border: selectedEmergency?.id === e.id ? "1px solid var(--color-cyan)" : "1px solid var(--glass-border)",
                        background: e.status === "Routed" ? "rgba(0, 255, 102, 0.05)" : e.status === "Cleared" ? "rgba(255,255,255,0.02)" : "rgba(255, 51, 51, 0.05)"
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {e.type === "Ambulance" ? "🚑" : e.type === "Fire" ? "🚒" : "🚓"}
                        <strong>{e.type.toUpperCase()}</strong>: {e.start_location.split(" ")[0]} ➡️ {e.destination_location.split(" ")[0]}
                      </span>
                      <span style={{ 
                        fontWeight: "bold", 
                        color: e.status === "Routed" ? "var(--color-green)" : e.status === "Cleared" ? "var(--text-muted)" : "var(--color-red)" 
                      }}>
                        {e.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
