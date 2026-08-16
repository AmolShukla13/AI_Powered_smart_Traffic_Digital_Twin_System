import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Shield, CheckCircle, Loader, User, MapPin, Award } from "lucide-react";
import "./OfficerVerify.css";

export default function OfficerVerify() {
  const { username } = useParams();
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const verifyBadge = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-badge/${username}`);
        if (res.ok) {
          const data = await res.json();
          setOfficer(data);
        } else {
          setError("This identification badge signature could not be verified by the Central Traffic Registry.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error: Could not establish a secure handshake with the verification database.");
      } finally {
        setLoading(false);
      }
    };
    verifyBadge();
  }, [username]);

  if (loading) {
    return (
      <div className="verify-portal-container">
        <div className="verify-card glass-panel" style={{ textAlign: "center", padding: "40px" }}>
          <Loader className="spin text-glow-cyan" size={36} style={{ color: "var(--color-cyan)" }} />
          <h2 style={{ marginTop: "15px", letterSpacing: "1px" }}>DECRYPTING SIGNATURE...</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Querying Central Police Registry Database</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="verify-portal-container">
        <div className="verify-card glass-panel error-border" style={{ textAlign: "center", padding: "40px", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
          <Shield size={48} style={{ color: "#ff3366", filter: "drop-shadow(0 0 10px #ff3366)" }} />
          <h2 style={{ color: "#ff3366", letterSpacing: "1px", margin: 0 }}>SECURITY WARNING</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.5", maxWidth: "340px" }}>
            {error}
          </p>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            HANDSHAKE CODE: ERR_BADGE_SIG_INVALID
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-portal-container">
      <div className="verify-card glass-panel success-border">
        {/* Hologram Header */}
        <div className="verify-header">
          <Shield size={32} style={{ color: "var(--color-green)", filter: "drop-shadow(0 0 5px var(--color-green))" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--color-green)", fontWeight: "900", letterSpacing: "2px" }}>OFFICIAL VERIFICATION GATEWAY</span>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#fff", letterSpacing: "1px" }}>CLEARANCE VERIFIED</h2>
          </div>
        </div>

        {/* Verification Success Seal */}
        <div className="verification-seal">
          <CheckCircle size={18} />
          <span>OFFICER IN GOOD STANDING</span>
        </div>

        {/* Officer Credentials Summary */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "15px", margin: "20px 0" }}>
          <div style={{ 
            width: "100px", 
            height: "100px", 
            borderRadius: "50%", 
            border: "3px solid var(--color-green)", 
            boxShadow: "0 0 15px rgba(0, 255, 102, 0.2)",
            background: "rgba(0,255,102,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            color: "var(--color-green)"
          }}>
            {officer.profile_pic ? (
              <img src={officer.profile_pic} alt="Verified Officer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <User size={48} />
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.3rem", color: "#fff", fontWeight: "900", textTransform: "uppercase", margin: "0 0 4px 0" }}>
              {officer.full_name}
            </h3>
            <span style={{ fontSize: "0.8rem", color: "var(--color-yellow)", fontWeight: "bold", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
              <Award size={14} />
              {officer.rank}
            </span>
          </div>
        </div>

        {/* Detail Records Grid */}
        <div className="verify-records">
          <div className="verify-rec-row">
            <span className="rec-lbl">REGISTRY ID</span>
            <strong className="rec-val font-mono">{officer.badge_number}</strong>
          </div>
          <div className="verify-rec-row">
            <span className="rec-lbl">ASSIGNED JURISDICTION</span>
            <strong className="rec-val" style={{ color: "var(--color-cyan)" }}>{officer.assigned_location}</strong>
          </div>
          <div className="verify-rec-row">
            <span className="rec-lbl">COMMAND STATION</span>
            <strong className="rec-val">SITAPUR TRAFFIC GRID</strong>
          </div>
          <div className="verify-rec-row">
            <span className="rec-lbl">AUTHORIZATION STATUS</span>
            <strong className="rec-val" style={{ color: "var(--color-green)", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00ff66", display: "inline-block" }}></span>
              ACTIVE SYSTEM DUTY
            </strong>
          </div>
        </div>

        {/* System Barcode stamp */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", width: "100%", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", height: "18px", gap: "1.5px", width: "100%" }}>
            <span style={{ flexGrow: 1, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 2, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 1, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 3, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 1, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 2, background: "rgba(0, 255, 102, 0.25)" }}></span>
            <span style={{ flexGrow: 1, background: "rgba(0, 255, 102, 0.25)" }}></span>
          </div>
          <div style={{ fontSize: "0.55rem", color: "var(--color-green)", textContent: "center", textAlign: "center", letterSpacing: "1px", fontFamily: "var(--font-mono)" }}>
            VERIFIED STATE SIGNATURE BLOCK // PORTAL-UP-VERIFY
          </div>
        </div>
      </div>
    </div>
  );
}
