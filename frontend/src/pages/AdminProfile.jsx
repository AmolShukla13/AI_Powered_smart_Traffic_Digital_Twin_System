import React, { useState, useEffect } from "react";
import { User, Mail, Shield, Phone, Award, Lock, CheckCircle, Smartphone, Camera, MapPin } from "lucide-react";
import "./AdminProfile.css";

export default function AdminProfile() {
  const [profile, setProfile] = useState({
    username: sessionStorage.getItem("username") || "",
    role: sessionStorage.getItem("role") || "",
    assigned_location: sessionStorage.getItem("assigned_location") || "Sitapur Junction",
    full_name: "",
    email: "",
    phone: "",
    rank: "",
    badge_number: "",
    profile_pic: ""
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Extra security states loaded from cache
  const [requirePasskey, setRequirePasskey] = useState(() => {
    return localStorage.getItem("require_passkey") !== "false";
  });
  const [sosAlerts, setSosAlerts] = useState(() => {
    return localStorage.getItem("push_sos_alerts") !== "false";
  });
  const [cyberMode, setCyberMode] = useState(() => {
    return localStorage.getItem("hud_theme") || "Default Cyber-Blue";
  });

  const [imageUploading, setImageUploading] = useState(false);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === "Neon-Purple (Glow Mode)" || theme === "Linear-Purple") {
      root.style.setProperty("--color-cyan", "#bd00ff");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(189, 0, 255, 0.5)");
    } else if (theme === "Neon-Green" || theme === "Autonomous Green (Eco-Mode)") {
      root.style.setProperty("--color-cyan", "#00ff66");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(0, 255, 102, 0.5)");
    } else {
      root.style.setProperty("--color-cyan", "#00f0ff");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(0, 240, 255, 0.5)");
    }
  };

  useEffect(() => {
    applyTheme(cyberMode);
  }, [cyberMode]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setErrorMsg("");
    const token = sessionStorage.getItem("token");
    if (!token) {
      setErrorMsg("🔒 Session Expired: No active login token found in sessionStorage. Please click the Sign Out button at the bottom and log in again to generate a secure token.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        const data = await res.json();
        if (res.status === 401) {
          setErrorMsg("🔒 Session Expired: Could not validate credentials. Please click the Sign Out button at the bottom and log in again to generate a fresh secure access token.");
        } else {
          setErrorMsg(data.detail || "Failed to load officer details.");
        }
      }
    } catch (err) {
      console.error("Error loading profile data:", err);
      setErrorMsg("Network error: Could not connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const reader = new FileReader();
      const base64Url = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      setProfile((prev) => ({ ...prev, profile_pic: base64Url }));
      setSuccessMsg("Photo loaded! Click Sync Account Details below to save.");
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMsg("Failed to read photo file.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    const token = sessionStorage.getItem("token");
    if (!token) {
      setErrorMsg("🔒 Session Expired: Click the Sign Out button at the bottom and log in again.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/auth/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          rank: profile.rank,
          badge_number: profile.badge_number,
          profile_pic: profile.profile_pic
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("✨ PROFILE SYNCED: Officer details updated in MongoDB Cluster0 successfully!");
        sessionStorage.setItem("username", profile.username);
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        if (res.status === 401) {
          setErrorMsg("🔒 Session Expired: Could not validate credentials. Please logout and login again.");
        } else {
          setErrorMsg(data.detail || "Failed to update profile details.");
        }
      }
    } catch (err) {
      setErrorMsg("Network error: Could not sync changes with Atlas DB.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-box font-mono">Loading Officer Profile...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header glass-panel">
        <div className="profile-header-meta">
          <User className="profile-header-icon text-glow-cyan" />
          <div>
            <h1>OFFICER ACCOUNT CONTROL</h1>
            <p>Modify credentials, security access rules, and link hardware credentials.</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="glass-panel" style={{ padding: "12px 20px", background: "rgba(0, 255, 102, 0.05)", border: "1px solid var(--color-green)", color: "var(--color-green)", fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="glass-panel" style={{ padding: "12px 20px", background: "rgba(255, 51, 51, 0.05)", border: "1px solid var(--color-red)", color: "var(--color-red)", fontSize: "0.85rem", fontWeight: "bold" }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
        
        {/* Left Column: Profile Information Form */}
        <form onSubmit={handleUpdate} className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 10px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
            👤 OFFICER INFORMATION REGISTRY
          </h3>

          {/* Holographic Avatar Upload Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "rgba(255,255,255,0.01)", padding: "15px", borderRadius: "6px", border: "1px solid var(--glass-border)" }}>
            <div style={{ position: "relative", width: "64px", height: "64px", borderRadius: "50%", border: "2px solid var(--color-cyan)", background: "rgba(0, 240, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 0 10px rgba(0, 240, 255, 0.15)", flexShrink: 0 }}>
              {profile.profile_pic ? (
                <img src={profile.profile_pic} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <User size={32} style={{ color: "var(--color-cyan)" }} />
              )}
              {imageUploading && (
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-cyan)" }}>
                  <span style={{ fontSize: "0.5rem" }}>UP...</span>
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-primary)" }}>OFFICER PROFILE PICTURE</span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <label className="glow-btn-cyan" style={{ padding: "6px 12px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Camera size={12} />
                  <span>Choose Photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={imageUploading} />
                </label>
                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Saved securely in local database records.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>SYSTEM USERNAME</label>
              <input 
                type="text" 
                value={profile.username} 
                disabled 
                style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "not-allowed", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }} 
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>OFFICIAL ROLE</label>
              <input 
                type="text" 
                value={profile.role.toUpperCase()} 
                disabled 
                style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "not-allowed", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }} 
              />
            </div>
          </div>

          {profile.role === "admin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>ASSIGNED COMMAND INTERSECTION</label>
                <span style={{ fontSize: "0.65rem", color: "var(--color-yellow)", fontWeight: "bold", background: "rgba(255, 204, 0, 0.05)", padding: "2px 6px", borderRadius: "3px", border: "1px solid rgba(255, 204, 0, 0.15)" }}>
                  🔒 SECURITY LOCATION LOCK
                </span>
              </div>
              <input 
                type="text" 
                value={profile.assigned_location} 
                disabled 
                style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "not-allowed", fontSize: "0.85rem", fontWeight: "bold" }} 
              />
            </div>
          )}

          {profile.role === "admin" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>OFFICER FULL NAME</label>
                  <input 
                    type="text" 
                    value={profile.full_name} 
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    required 
                    placeholder="Enter full name"
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem" }} 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>OFFICER RANK</label>
                  <input 
                    type="text" 
                    value={profile.rank} 
                    onChange={(e) => setProfile({ ...profile, rank: e.target.value })}
                    required 
                    placeholder="Orchestration Officer, Patrolman..."
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem" }} 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>BADGE IDENTIFICATION ID</label>
                  <input 
                    type="text" 
                    value={profile.badge_number} 
                    onChange={(e) => setProfile({ ...profile, badge_number: e.target.value })}
                    required 
                    placeholder="POL-84920"
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }} 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>OFFICIAL CONTACT EMAIL</label>
                  <input 
                    type="email" 
                    value={profile.email} 
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required 
                    placeholder="admin@traffic.gov.in"
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem" }} 
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>CITIZEN FULL NAME</label>
                  <input 
                    type="text" 
                    value={profile.full_name} 
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    required 
                    placeholder="Enter full name"
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem" }} 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>CONTACT EMAIL</label>
                  <input 
                    type="email" 
                    value={profile.email} 
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required 
                    placeholder="citizen@agency.gov.in"
                    style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem" }} 
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>EMERGENCY PHONE NUMBER</label>
            <input 
              type="text" 
              value={profile.phone} 
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              required 
              placeholder="+91 98765 43210"
              style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }} 
            />
          </div>

          <button 
            type="submit" 
            className="glow-btn-cyan" 
            disabled={saving}
            style={{ padding: "12px", width: "100%", marginTop: "10px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.85rem" }}
          >
            {saving ? "Synchronizing with MongoDB Cluster0..." : "💾 SYNC ACCOUNT DETAILS"}
          </button>
        </form>

        {/* Right Column: Security Preferences & Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Official Security Badge Card */}
          <div className="glass-panel" style={{ 
            padding: "24px", 
            background: "linear-gradient(135deg, rgba(6, 15, 30, 0.9) 0%, rgba(10, 24, 46, 0.9) 100%)", 
            border: "1px solid rgba(0, 240, 255, 0.25)",
            boxShadow: "0 0 15px rgba(0, 240, 255, 0.1)",
            position: "relative",
            overflow: "hidden",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "15px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(0, 240, 255, 0.2)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "var(--color-cyan)", fontWeight: "bold", letterSpacing: "1px" }}>{profile.role === "admin" ? "STATE TRAFFIC DEPT" : "CITIZEN TRAFFIC PORTAL"}</span>
                <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", letterSpacing: "0.5px" }}>{profile.role === "admin" ? "COMMAND AUTHENTICATION" : "USER AUTHENTICATION"}</strong>
              </div>
              <Shield size={24} style={{ color: "var(--color-cyan)", filter: "drop-shadow(0 0 5px var(--color-cyan))" }} />
            </div>

            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <div style={{ 
                width: "70px", 
                height: "70px", 
                borderRadius: "6px", 
                border: "2px solid var(--color-cyan)", 
                background: "rgba(0, 240, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-cyan)",
                boxShadow: "0 0 8px rgba(0, 240, 255, 0.2)",
                flexShrink: 0,
                overflow: "hidden"
              }}>
                {profile.profile_pic ? (
                  <img src={profile.profile_pic} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <User size={36} />
                )}
              </div>

              {/* ID Metadata */}
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profile.full_name || "Awaiting Setup"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--color-yellow)", fontWeight: "bold", textTransform: "uppercase" }}>
                  {profile.role === "admin" ? (profile.rank || "TRAFFIC CONTROL OFFICER") : "VERIFIED CITIZEN"}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                  {profile.role === "admin" ? "BADGE ID: " : "USER NODE ID: "}
                  <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                    {profile.role === "admin" ? (profile.badge_number || "N/A") : "CIT-84920"}
                  </strong>
                </span>
              </div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem" }}>
              {profile.role === "admin" && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>ASSIGNED NODE:</span>
                  <strong style={{ color: "#fff" }}>{profile.assigned_location}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>SYSTEM USERNAME:</span>
                <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>@{profile.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>CONTACT:</span>
                <span style={{ color: "var(--text-secondary)" }}>{profile.email || "N/A"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>PHONE:</span>
                <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{profile.phone || "N/A"}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.65rem", paddingTop: "5px" }}>
              <span style={{ color: "var(--color-green)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00ff66", display: "inline-block", boxShadow: "0 0 5px #00ff66" }}></span>
                SECURE ACTIVE SESSION
              </span>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>VER: 8.4.2 // SITAPUR</span>
            </div>
          </div>
          
          {profile.role === "admin" && (
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 15px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                🔒 SECURITY & ACCESS CONTROL
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <input 
                    type="checkbox" 
                    id="passkey-chk" 
                    checked={requirePasskey} 
                    onChange={(e) => {
                      setRequirePasskey(e.target.checked);
                      localStorage.setItem("require_passkey", e.target.checked ? "true" : "false");
                    }}
                    style={{ marginTop: "4px", cursor: "pointer" }}
                  />
                  <label htmlFor="passkey-chk" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer", lineHeight: "1.4" }}>
                    <strong style={{ color: "var(--text-primary)", display: "block" }}>Enable Government Passkey Login</strong>
                    Requires a physical secure security token and passkey confirmation when logging into the local node grid.
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px" }}>
                  <input 
                    type="checkbox" 
                    id="sos-chk" 
                    checked={sosAlerts} 
                    onChange={(e) => {
                      setSosAlerts(e.target.checked);
                      localStorage.setItem("push_sos_alerts", e.target.checked ? "true" : "false");
                    }}
                    style={{ marginTop: "4px", cursor: "pointer" }}
                  />
                  <label htmlFor="sos-chk" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer", lineHeight: "1.4" }}>
                    <strong style={{ color: "var(--text-primary)", display: "block" }}>Push Priority SOS Alerts</strong>
                    Broadcast dynamic Dijkstra emergency routing notifications immediately via official channels when an ambulance leaves the station.
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.95rem", letterSpacing: "1px", margin: "0 0 15px 0", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              🎨 INTERFACE CONFIGURATION
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>DIGITAL TWIN HUD THEME</label>
              <select 
                value={cyberMode} 
                onChange={(e) => {
                  setCyberMode(e.target.value);
                  localStorage.setItem("hud_theme", e.target.value);
                }}
                style={{ padding: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "0.8rem", width: "100%" }}
              >
                <option value="Default Cyber-Blue">Default Cyber-Blue (Recommended)</option>
                <option value="Linear-Purple">Neon-Purple (Glow Mode)</option>
                <option value="Neon-Green">Autonomous Green (Eco-Mode)</option>
              </select>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
