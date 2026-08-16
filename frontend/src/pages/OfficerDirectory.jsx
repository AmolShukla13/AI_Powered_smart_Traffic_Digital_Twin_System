import React, { useState, useEffect } from "react";
import { Users, Mail, MapPin, Radio, ShieldCheck } from "lucide-react";
import "./OfficerDirectory.css";

export default function OfficerDirectory() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/admin/directory");
      if (res.ok) {
        const data = await res.json();
        setOfficers(data);
      }
    } catch (err) {
      console.error("Error loading officers list:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="directory-container">
      <div className="directory-header glass-panel">
        <div className="directory-header-meta">
          <Users className="directory-header-icon text-glow-cyan" />
          <div>
            <h1>OFFICER DIRECTORY</h1>
            <p>Authorized Traffic Police Admins currently assigned to grid nodes and active camera feeds.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-box font-mono">Syncing Registry...</div>
      ) : (
        <div className="officer-grid">
          {officers.map((officer, i) => (
            <div className="officer-card glass-panel" key={i}>
              <div className="card-top">
                <div className="avatar-circle">
                  <ShieldCheck size={28} className="shield-icon" />
                </div>
                <div className="badge-row">
                  <span className="active-ping-badge">
                    <span className="ping-dot"></span>
                    ACTIVE
                  </span>
                </div>
              </div>

              <div className="officer-info">
                <h3>{officer.username}</h3>
                <span className="officer-role-lbl">Orchestration Officer</span>
                
                <div className="info-item">
                  <Mail size={14} className="info-icon" />
                  <span>{officer.email}</span>
                </div>

                <div className="info-item assigned-loc-box">
                  <MapPin size={14} className="info-icon cyan" />
                  <div>
                    <span className="lbl">ASSIGNED NODE</span>
                    <strong className="val">{officer.assigned_location}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {officers.length === 0 && (
            <div className="no-officers-card glass-panel">
              <Users size={48} className="no-icon" />
              <h4>No Officers Registered</h4>
              <p>Sign up a Traffic Police Admin on the login screen to populate this list.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
