import React, { useState, useEffect } from "react";
import { Search, ShieldAlert, CheckCircle, CreditCard, Gauge, MapPin, Clock, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import "./Diagnostics.css"; // Reuse general HUD diagnostics / portal styling variables

export default function ChallanPortal() {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [queriedPlate, setQueriedPlate] = useState("");
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [message, setMessage] = useState("");

  const [rtoApiActive, setRtoApiActive] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Load locations and config on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/traffic/locations`)
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch((err) => console.error("Error fetching locations for speed guide:", err));

    fetch(`${API_BASE_URL}/traffic/challans-config`)
      .then((res) => res.json())
      .then((data) => setRtoApiActive(data.rto_api_active))
      .catch((err) => console.error("Error fetching challan api config:", err));
  }, []);

  const handleSearchChallans = async (e) => {
    if (e) e.preventDefault();
    if (!vehicleNumber.trim()) return;

    setIsDemoMode(false);
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/traffic/challans/${encodeURIComponent(vehicleNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setChallans(data);
        setQueriedPlate(vehicleNumber.trim().toUpperCase());
        if (data.length === 0) {
          setMessage("No active challans found for this vehicle plate.");
        }
      }
    } catch (err) {
      console.error("Error fetching challans:", err);
      setMessage("Failed to fetch challan records.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemoChallan = () => {
    setMessage("");
    const plate = vehicleNumber.trim() ? vehicleNumber.trim().toUpperCase() : "UP34U3577";
    setVehicleNumber(plate);
    setQueriedPlate(plate);
    setIsDemoMode(true);
    setChallans([
      {
        challan_id: "CH-DEMO-98124",
        vehicle_number: plate,
        location: "Sitapur Highway Junction",
        violation_type: "Overspeeding (82 km/h in 60 km/h zone) [AI RADAR PREVIEW]",
        fine_amount: 1000,
        status: "Unpaid",
        timestamp: new Date().toLocaleString(),
        isDemoPreview: true
      }
    ]);
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000); // 5 seconds timeout fallback

      script.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      script.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  const handlePayChallan = async (challan) => {
    setPayingId(challan.challan_id);
    
    // 1. Hybrid Sandbox Bypass for Demo Challans (bypasses all backend calls to prevent network hangs)
    if (challan.isDemoPreview) {
      const confirmPayment = window.confirm(`💰 Demo Payment Checkout:\n\nDo you want to settle the simulated fine of ₹${challan.fine_amount.toLocaleString()} for vehicle ${challan.vehicle_number} via Sandbox?`);
      if (confirmPayment) {
        setChallans([{ ...challan, status: "Paid" }]);
      }
      setPayingId(null);
      return;
    }

    // 2. Production Integration for Real Government / RTO records
    try {
      const orderRes = await fetch(`${API_BASE_URL}/traffic/challans/${challan.challan_id}/create-order`, {
        method: "POST"
      });
      if (!orderRes.ok) {
        alert("Failed to create transaction order.");
        setPayingId(null);
        return;
      }
      
      const orderData = await orderRes.json();
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert("Razorpay checkout SDK failed to load. Please check your internet or disable adblocker.");
        setPayingId(null);
        return;
      }

      const options = {
        key: "rzp_test_demoKeyId", 
        amount: orderData.amount,
        currency: orderData.currency,
        name: "CITY TRAFFIC DIGITAL TWIN",
        description: `Challan Settle: ${challan.violation_type}`,
        order_id: orderData.id,
        handler: async function (response) {
          const verifyRes = await fetch(`${API_BASE_URL}/traffic/challans/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id || orderData.id,
              razorpay_payment_id: response.razorpay_payment_id || "pay_sandbox_123",
              razorpay_signature: response.razorpay_signature || "sandbox_sig_123",
              challan_id: challan.challan_id
            })
          });
          
          if (verifyRes.ok) {
            if (challan.isDemoPreview) {
              setChallans([{ ...challan, status: "Paid" }]);
              return;
            }
            const searchRes = await fetch(`${API_BASE_URL}/traffic/challans/${encodeURIComponent(queriedPlate)}`);
            if (searchRes.ok) {
              const data = await searchRes.json();
              setChallans(data);
            }
          } else {
            alert("Transaction verification failed on server.");
          }
        },
        prefill: {
          name: sessionStorage.getItem("username") || "Citizen User",
          email: "citizen@smartcity.gov.in"
        },
        theme: {
          color: "#00f0ff"
        }
      };

      const paymentWindow = new window.Razorpay(options);
      paymentWindow.open();
    } catch (err) {
      console.error("Payment setup error:", err);
    } finally {
      setPayingId(null);
    }
  };

  // Helper mapping speed limits dynamically
  const getSpeedLimit = (locName) => {
    if (locName.includes("Highway") || locName.includes("Toll") || locName.includes("Sidhauli")) return 80;
    if (locName.includes("Junction") || locName.includes("Khairabad")) return 60;
    return 40; // Default urban speed limit
  };

  return (
    <div className="diagnostics-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div className="diagnostics-header glass-panel" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        <ShieldAlert className="diagnostics-header-icon text-glow-cyan" style={{ color: "var(--color-cyan)" }} size={32} />
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "1px" }}>AI CAMERA E-CHALLAN REGISTRY</h1>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Review and settle automated traffic violation tickets detected by the smart digital twin grid cameras.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "20px" }}>
        {/* Left Column: Intersections & Radar Guide */}
        <div className="diag-left glass-panel" style={{ display: "flex", flexDirection: "column", gap: "15px", padding: "20px" }}>
          <div>
            <h3 style={{ margin: "0 0 5px 0", fontSize: "1rem", color: "var(--color-cyan)" }}>AI SPEED RADAR NETWORK</h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>Active speed limits and live camera verification status.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            {locations.map((loc) => {
              const speedLimit = getSpeedLimit(loc.name);
              const isRadarOnline = loc.has_admin && loc.is_video_data;
              return (
                <div 
                  key={loc.id} 
                  className="glass-card" 
                  style={{ 
                    padding: "12px 15px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    borderLeft: isRadarOnline ? "3px solid var(--color-green)" : "3px solid var(--text-muted)"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>{loc.name}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={12} /> Speed Limit: <strong style={{ color: "var(--color-cyan)" }}>{speedLimit} km/h</strong>
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                    <span 
                      style={{ 
                        fontSize: "0.6rem", 
                        padding: "2px 6px", 
                        borderRadius: "3px", 
                        fontWeight: "bold",
                        background: isRadarOnline ? "rgba(0, 255, 102, 0.1)" : "rgba(255,255,255,0.05)",
                        color: isRadarOnline ? "var(--color-green)" : "var(--text-secondary)",
                        border: isRadarOnline ? "1px solid rgba(0, 255, 102, 0.2)" : "1px solid rgba(255,255,255,0.1)"
                      }}
                    >
                      {isRadarOnline ? "ONLINE" : "OFFLINE"}
                    </span>
                    {isRadarOnline && (
                      <span style={{ fontSize: "0.55rem", color: "var(--color-cyan)", display: "flex", alignItems: "center", gap: "3px" }}>
                        <span className="blink-dot" style={{ width: "4px", height: "4px" }}></span> Radar Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {locations.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                No active traffic intersections found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Violation Search & Payment */}
        <div className="diag-right glass-panel" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "20px" }}>
          <div>
            <h3 style={{ margin: "0 0 5px 0", fontSize: "1rem", color: "var(--color-cyan)" }}>VEHICLE VIOLATION SEARCH</h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>Query automated speed camera fines using vehicle plate number.</p>
          </div>

          <form onSubmit={handleSearchChallans} style={{ display: "flex", gap: "10px" }}>
            <div style={{ position: "relative", flexGrow: 1 }}>
              <input 
                type="text" 
                placeholder="Enter Plate No. (e.g. UP32-AB-8888)"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px 15px", 
                  background: "rgba(255, 255, 255, 0.03)", 
                  border: "1px solid var(--glass-border)", 
                  borderRadius: "4px", 
                  color: "#fff", 
                  fontSize: "0.85rem",
                  textTransform: "uppercase"
                }}
              />
            </div>
            <button 
              type="submit" 
              className="glow-btn-cyan" 
              style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 20px" }}
              disabled={loading}
            >
              <Search size={15} />
              <span>Query Records</span>
            </button>
          </form>

          {!rtoApiActive && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: "6px", alignItems: "center", marginTop: "-10px" }}>
              <span>💡 Don't have a registered challan?</span>
              <button 
                type="button" 
                onClick={handleLoadDemoChallan} 
                style={{ background: "none", border: "none", color: "var(--color-cyan)", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: "0.75rem", fontWeight: "bold" }}
              >
                Click here to load a Demo UI Preview
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Accessing AI Speed Camera logs...
            </div>
          )}

          {!loading && message && (
            <div className="glass-card" style={{ padding: "25px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={32} style={{ color: "var(--color-green)" }} />
              <h4 style={{ margin: 0, color: "var(--color-green)" }}>No Active Violations</h4>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Vehicle <strong style={{ color: "#fff" }}>{queriedPlate}</strong> has a clean safety score. No pending E-Challans logged.
              </p>
            </div>
          )}

          {!loading && challans.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Found <strong style={{ color: "var(--color-cyan)" }}>{challans.length}</strong> violations registered for <strong style={{ color: "#fff" }}>{queriedPlate}</strong>:
              </div>

              {challans.map((challan) => (
                <div 
                  key={challan.challan_id} 
                  className="glass-card" 
                  style={{ 
                    padding: "20px", 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "15px", 
                    position: "relative",
                    border: challan.status === "Unpaid" ? "1px solid rgba(255, 0, 85, 0.2)" : "1px solid rgba(0, 255, 102, 0.2)" 
                  }}
                >
                  {challan.isDemoPreview && (
                    <div style={{ position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(255, 170, 0, 0.15)", border: "1px solid var(--color-yellow)", color: "var(--color-yellow)", padding: "3px 12px", borderRadius: "3px", fontSize: "0.6rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>
                      ⚠️ DEMO PREVIEW MODE
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: challan.isDemoPreview ? "15px" : "0" }}>
                    <div>
                      <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)", letterSpacing: "0.5px" }}>CHALLAN ID</span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "0.9rem", color: "var(--color-cyan)" }}>{challan.challan_id}</h4>
                    </div>

                    <span 
                      style={{ 
                        fontSize: "0.65rem", 
                        padding: "4px 10px", 
                        borderRadius: "4px", 
                        fontWeight: "bold",
                        background: challan.status === "Unpaid" ? "rgba(255,0,85,0.15)" : "rgba(0, 255, 102, 0.15)",
                        color: challan.status === "Unpaid" ? "#ff0055" : "var(--color-green)",
                        border: challan.status === "Unpaid" ? "1px solid rgba(255,0,85,0.3)" : "1px solid rgba(0, 255, 102, 0.3)"
                      }}
                    >
                      {challan.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.75rem", background: "rgba(255,255,255,0.02)", padding: "10px 15px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={12} className="text-glow-cyan" /> <span>{challan.location}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={12} /> <span>{challan.timestamp}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", gridColumn: "span 2" }}><AlertTriangle size={12} style={{ color: "var(--color-yellow)" }} /> <span>{challan.violation_type}</span></div>
                  </div>

                  {/* License Plate HUD Zoom (Evidence visual) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>AI CAMERA EVIDENCE SCAN</span>
                    <div 
                      style={{ 
                        height: "80px", 
                        background: "#080b11", 
                        border: "1px solid rgba(0, 240, 255, 0.2)", 
                        borderRadius: "4px", 
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden"
                      }}
                    >
                      {/* Grid overlay */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)", backgroundSize: "10px 10px" }}></div>
                      {/* Target HUD brackets */}
                      <div style={{ position: "absolute", top: "10px", left: "10px", width: "10px", height: "10px", borderLeft: "2px solid var(--color-cyan)", borderTop: "2px solid var(--color-cyan)" }}></div>
                      <div style={{ position: "absolute", top: "10px", right: "10px", width: "10px", height: "10px", borderRight: "2px solid var(--color-cyan)", borderTop: "2px solid var(--color-cyan)" }}></div>
                      <div style={{ position: "absolute", bottom: "10px", left: "10px", width: "10px", height: "10px", borderLeft: "2px solid var(--color-cyan)", borderBottom: "2px solid var(--color-cyan)" }}></div>
                      <div style={{ position: "absolute", bottom: "10px", right: "10px", width: "10px", height: "10px", borderRight: "2px solid var(--color-cyan)", borderBottom: "2px solid var(--color-cyan)" }}></div>
                      {/* License plate rendering */}
                      <div style={{ background: "#f1f1f1", color: "#111", padding: "5px 20px", border: "3px solid #222", borderRadius: "3px", fontWeight: "bold", fontSize: "1.1rem", fontFamily: "monospace", letterSpacing: "1px", boxShadow: "0 0 10px rgba(0,0,0,0.5)" }}>
                        {challan.vehicle_number}
                      </div>
                      <div style={{ position: "absolute", bottom: "5px", right: "15px", fontSize: "0.55rem", color: "var(--color-cyan)", fontFamily: "monospace" }}>
                        ZOOM: 250% [OSD CAM-02]
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                    <div>
                      <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>PENALTY AMOUNT</span>
                      <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff", fontWeight: "bold" }}>₹{challan.fine_amount.toLocaleString()}</h3>
                    </div>

                    {challan.status === "Unpaid" ? (
                      <button 
                        onClick={() => handlePayChallan(challan)} 
                        className="glow-btn-cyan" 
                        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", height: "38px" }}
                        disabled={payingId === challan.challan_id}
                      >
                        <CreditCard size={15} />
                        <span>{payingId === challan.challan_id ? "Processing Payment..." : "Settle Fine Online"}</span>
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-green)", fontSize: "0.75rem", fontWeight: "bold" }}>
                        <CheckCircle size={16} />
                        <span>VIOLATION CLEARED</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
