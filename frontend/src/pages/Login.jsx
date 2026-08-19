import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldAlert, Mail, Lock, User, MapPin, KeyRound, ArrowRight, Phone } from "lucide-react";
import API from "../services/api";
import "./Login.css";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [assignedLocation, setAssignedLocation] = useState("");
  const [availableLocations, setAvailableLocations] = useState([]);
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Forgot Password Fields
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBadgeNumber, setForgotBadgeNumber] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
      // Clear location state so the message doesn't persist on page refresh/navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await API.get("/traffic/locations");
        const data = res.data;
        setAvailableLocations(data);
        if (data.length > 0) {
          setSelectedLocationOption(data[0].name);
          setAssignedLocation(data[0].name);
        } else {
          setIsCustomLocation(true);
        }
      } catch (err) {
        console.error("Error loading locations:", err);
        setIsCustomLocation(true);
      }
    };
    fetchLocations();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Initial location permission granted:", position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("Initial location permission check:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const path = isLogin ? "/auth/login" : "/auth/signup";

    const body = isLogin 
      ? { username, password } 
      : { username, password, email, phone, role, assigned_location: role === "admin" ? assignedLocation : null };

    try {
      const response = await API.post(path, body);
      const data = response.data;

      // Store in sessionStorage and localStorage
      sessionStorage.setItem("token", data.access_token);
      sessionStorage.setItem("role", data.role);
      sessionStorage.setItem("username", data.username);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username);
      
      if (data.assigned_location) {
        const mappedLoc = data.assigned_location === "Sitapur" ? "Sitapur Junction" : data.assigned_location;
        sessionStorage.setItem("assigned_location", mappedLoc);
        localStorage.setItem("assigned_location", mappedLoc);
      } else {
        sessionStorage.removeItem("assigned_location");
        localStorage.removeItem("assigned_location");
      }

      // Redirect
      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      let errorMsg = "Authentication failed. Try again.";
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(", ");
        } else if (typeof detail === "object") {
          errorMsg = detail.message || JSON.stringify(detail);
        } else {
          errorMsg = detail;
        }
      } else {
        errorMsg = err.message || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      await API.post("/auth/forgot-password", {
        username: forgotUsername,
        email: forgotEmail,
        badge_number: forgotBadgeNumber,
        new_password: forgotNewPassword
      });

      setSuccessMsg("✨ PASSCODE RESET SUCCESSFUL: Please sign in with your new passcode.");
      setForgotUsername("");
      setForgotEmail("");
      setForgotBadgeNumber("");
      setForgotNewPassword("");
      setTimeout(() => {
        setIsForgot(false);
        setSuccessMsg("");
      }, 5000);
    } catch (err) {
      let errorMsg = "Verification failed. Please double check credentials.";
      if (err.response && err.response.data && err.response.data.detail) {
        errorMsg = err.response.data.detail;
      } else {
        errorMsg = err.message || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card glass-panel">
        
        {/* Brand Header */}
        <div className="login-brand">
          <ShieldAlert size={40} className="logo-pulse-icon text-glow-cyan" />
          <div className="brand-meta-info">
            <h1 className="logo-text">TRAFFIC<span className="text-glow-cyan">TWIN</span></h1>
            <span className="brand-subtitle">AI DIGITAL TWIN SYSTEM</span>
          </div>
        </div>

        {/* Live HUD Stats (Cohesive Info Bar) */}
        <div className="hud-stats-bar">
          <div className="hud-stat">
            <span className="hud-label">GRID NODES</span>
            <span className="hud-val text-glow-green">144/145</span>
          </div>
          <div className="hud-divider"></div>
          <div className="hud-stat">
            <span className="hud-label">AI ENGINE</span>
            <span className="hud-val text-glow-cyan">ACTIVE</span>
          </div>
          <div className="hud-divider"></div>
          <div className="hud-stat">
            <span className="hud-label">AVG DELAY</span>
            <span className="hud-val text-glow-yellow">-28.4%</span>
          </div>
        </div>

        <div className="form-header">
          <h2>{isForgot ? "Reset Node Passcode" : (isLogin ? "System Access" : "Create Account")}</h2>
          <p>{isForgot ? "Verify credentials to overwrite node access key" : (isLogin ? "Authenticate to access digital twin node" : "Register a new node in the traffic grid")}</p>
        </div>

        {error && <div className="auth-error-box">{error}</div>}
        {successMsg && <div className="auth-success-box" style={{ background: "rgba(0, 255, 102, 0.05)", border: "1px solid var(--color-green)", color: "var(--color-green)", padding: "10px 15px", borderRadius: "4px", fontSize: "0.8rem", marginBottom: "15px", textAlign: "center", fontWeight: "bold" }}>{successMsg}</div>}

        {isForgot ? (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="input-group">
              <label>Username</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter your system username"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@agency.gov.in"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <label>Official Badge ID</label>
              <div className="input-with-icon">
                <KeyRound size={18} className="input-icon" />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. POL-84920"
                  value={forgotBadgeNumber}
                  onChange={(e) => setForgotBadgeNumber(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <label>New Secure Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            <button type="submit" className="glow-btn-cyan submit-auth-btn" disabled={loading}>
              {loading ? "Verifying Identity..." : "Reset Secure Passcode"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="auth-form">
            {!isLogin && (
              <>
                <div className="input-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="name@agency.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={18} className="input-icon" />
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required 
                    />
                  </div>
                </div>
              </>
            )}

            <div className="input-group">
              <label>Username</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter node code or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <label>Secure Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              {isLogin && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                  <button 
                    type="button" 
                    onClick={() => { setIsForgot(true); setError(""); setSuccessMsg(""); }}
                    style={{ background: "none", border: "none", color: "var(--color-cyan)", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}
                  >
                    Forgot Passcode?
                  </button>
                </div>
              )}
            </div>

            {!isLogin && (
              <>
                <div className="input-group">
                  <label>Grid Access Role</label>
                  <div className="input-with-icon">
                    <KeyRound size={18} className="input-icon" />
                    <select 
                      className="form-input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="user">Citizen / User</option>
                      <option value="admin">Traffic Police Admin</option>
                    </select>
                  </div>
                </div>

                {role === "admin" && (
                  <div className="input-group animated-field">
                    <label>Assigned Location / Intersection</label>
                    <div className="input-with-icon">
                      <MapPin size={18} className="input-icon" />
                      {availableLocations.length > 0 ? (
                        <div style={{ width: "100%" }}>
                          <select 
                            className="form-input"
                            value={isCustomLocation ? "custom" : selectedLocationOption}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "custom") {
                                setIsCustomLocation(true);
                                setAssignedLocation("");
                              } else {
                                setIsCustomLocation(false);
                                setSelectedLocationOption(val);
                                setAssignedLocation(val);
                              }
                            }}
                          >
                            {availableLocations.map((loc) => (
                              <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                            <option value="custom">➕ Create Custom Location...</option>
                          </select>
                          {isCustomLocation && (
                            <div style={{ marginTop: "10px" }}>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Enter custom location name"
                                value={assignedLocation}
                                onChange={(e) => setAssignedLocation(e.target.value)}
                                required 
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Connaught Place Crossing"
                          value={assignedLocation}
                          onChange={(e) => setAssignedLocation(e.target.value)}
                          required 
                        />
                      )}
                    </div>
                    <small className="help-text">You will only be authorized to override traffic lights at this intersection.</small>
                  </div>
                )}
              </>
            )}

            <button type="submit" className="glow-btn-cyan submit-auth-btn" disabled={loading}>
              {loading ? "Syncing Grid..." : (isLogin ? "Connect Node" : "Register Node")}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        <div className="form-toggle-link">
          {isForgot ? (
            <span>
              Remember your access passcode?{" "}
              <button 
                type="button" 
                onClick={() => { setIsForgot(false); setError(""); setSuccessMsg(""); }}
                className="toggle-text-btn"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              {isLogin ? "Need a new access node? " : "Already registered? "}
              <button 
                type="button" 
                onClick={() => { setIsLogin(!isLogin); setError(""); setSuccessMsg(""); }}
                className="toggle-text-btn"
              >
                {isLogin ? "Request Registration" : "Sign In"}
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
