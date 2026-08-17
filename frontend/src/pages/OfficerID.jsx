import React, { useState, useEffect } from "react";
import { User, Shield, MapPin, Edit, Download, Camera, Loader } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../services/api";
import "./OfficerID.css";

export default function OfficerID() {
  const navigate = useNavigate();
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
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isAdmin = profile.role === "admin";

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setErrorMsg("");
    const token = sessionStorage.getItem("token");
    if (!token) {
      setErrorMsg("Session Expired. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setErrorMsg("Failed to retrieve profile information.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Connection error: Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const reader = new FileReader();
      const base64Url = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      // Save image URL to MongoDB via backend profile update endpoint
      const token = sessionStorage.getItem("token");
      const updateRes = await fetch(`${API_BASE_URL}/auth/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          profile_pic: base64Url
        })
      });

      if (updateRes.ok) {
        setProfile((prev) => ({ ...prev, profile_pic: base64Url }));
        setSuccessMsg("Profile photo saved successfully in database records!");
      } else {
        setErrorMsg("Failed to save profile picture in records.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMsg("Failed to upload profile photo.");
    } finally {
      setUploading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="id-card-view-container" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center", color: "var(--color-cyan)" }}>
          <Loader className="pulse-anim" size={32} />
          <p style={{ marginTop: "10px", fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}>Retrieving Badge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="id-card-view-container">
      <div className="id-card-header glass-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="font-mono">{isAdmin ? "OFFICER IDENTIFICATION" : "CITIZEN IDENTIFICATION"}</h1>
            <p>{isAdmin ? "Official Government Clearance ID Card for active Traffic Control Officer." : "Official Citizen Access ID Card for active Traffic Twin Node."}</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="glow-btn-cyan id-act-btn" onClick={() => navigate("/profile")}>
              <Edit size={16} />
              <span>Settings & Sync</span>
            </button>
            <button className="glow-btn-cyan id-act-btn" onClick={handlePrint} style={{ background: "rgba(255,255,255,0.05)" }}>
              <Download size={16} />
              <span>Print Badge</span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && <div className="status-banner success font-mono">{successMsg}</div>}
      {errorMsg && <div className="status-banner error font-mono">⚠️ {errorMsg}</div>}

      <div className="id-card-center-stage">
        {/* Holographic Interactive ID Card */}
        <div className="officer-id-badge-card glass-panel">
          {/* Shimmer Effect */}
          <div className="badge-card-shimmer"></div>

          {/* Top Header */}
          <div className="badge-header">
            <div className="header-text">
              <span className="dept-title">{isAdmin ? "UP POLICE TRAFFIC DEPT" : "TRAFFIC TWIN CITIZEN NETWORK"}</span>
              <strong className="badge-type">{isAdmin ? "COMMAND SERVICE IDENTITY" : "CITIZEN ACCESS IDENTITY"}</strong>
            </div>
            <Shield className="badge-header-shield" size={26} />
          </div>

          {/* Body Section */}
          <div className="badge-body">
            {/* Avatar Column */}
            <div className="avatar-wrapper">
              <div className="avatar-preview-box">
                {profile.profile_pic ? (
                  <img src={profile.profile_pic} alt="Avatar" className="avatar-img" />
                ) : (
                  <User size={64} className="avatar-placeholder" />
                )}
                {uploading && (
                  <div className="avatar-uploading-overlay">
                    <Loader className="spin" size={20} />
                  </div>
                )}
              </div>
              <label className="avatar-upload-trigger">
                <Camera size={14} />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
              </label>
            </div>

            {/* Metadata Info Column */}
            <div className="metadata-column">
              <div className="meta-row">
                <span className="meta-label">FULL NAME:</span>
                <strong className="meta-value name-highlight">{profile.full_name || "Awaiting Update"}</strong>
              </div>
              <div className="meta-row">
                <span className="meta-label">{isAdmin ? "OFFICIAL RANK:" : "NETWORK STATUS:"}</span>
                <strong className="meta-value rank-highlight">{isAdmin ? (profile.rank || "TRAFFIC CONTROL OFFICER") : "VERIFIED CITIZEN"}</strong>
              </div>
              <div className="meta-row">
                <span className="meta-label">{isAdmin ? "BADGE NUMBER:" : "MEMBER ID:"}</span>
                <span className="meta-value font-mono id-val">{isAdmin ? (profile.badge_number || "POL-99999") : (profile.badge_number || "CIT-84920")}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">{isAdmin ? "ASSIGNED ZONE:" : "REGISTERED REGION:"}</span>
                <strong className="meta-value zone-highlight">{profile.assigned_location || "Sitapur Junction"}</strong>
              </div>
            </div>
          </div>

          {/* Bottom Barcode Section */}
          <div className="badge-footer">
            <div className="metadata-grid" style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 1fr", gap: "10px" }}>
              <div>
                <span className="meta-label">NODE HOST:</span>
                <span className="meta-value font-mono">@{profile.username}</span>
              </div>
              <div>
                <span className="meta-label">CONTACT EMAIL:</span>
                <span className="meta-value" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={profile.email}>{profile.email || "citizen@agency.gov.in"}</span>
              </div>
              <div>
                <span className="meta-label">PHONE NUMBER:</span>
                <span className="meta-value font-mono" style={{ whiteSpace: "nowrap" }}>{profile.phone || "+91 98765 43210"}</span>
              </div>
            </div>

            {/* Centered Secure QR Code Verification Block */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", margin: "10px 0", background: "rgba(0,0,0,0.25)", padding: "15px", borderRadius: "8px", border: "1px solid rgba(0, 240, 255, 0.15)", width: "100%" }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&color=00f0ff&bgcolor=0c1c36&data=${encodeURIComponent(window.location.origin + "/verify/" + profile.username)}`} 
                alt="Verification QR" 
                style={{ width: "110px", height: "110px", borderRadius: "4px", border: "1px solid rgba(0, 240, 255, 0.4)", boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)" }}
              />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <span style={{ fontSize: "0.68rem", color: "var(--color-yellow)", fontWeight: "bold", letterSpacing: "1px" }}>
                  {isAdmin ? "🔒 SECURE QR VERIFICATION" : "🔒 CITIZEN QR VERIFICATION"}
                </span>
                <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>SCAN WITH PHONE CAMERA TO VERIFY ACCOUNT</span>
              </div>
            </div>

            <div className="badge-security-status">
              <span className="status-dot-green"></span>
              <span className="status-txt">
                {isAdmin ? "ACTIVE SECURE DIGITAL TWIN GRID" : "ACTIVE VERIFIED USER NODE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
