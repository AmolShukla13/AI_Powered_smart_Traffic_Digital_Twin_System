import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./services/api";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Login";
import UserView from "./pages/UserView";
import AdminDashboard from "./pages/AdminDashboard";
import VideoDemo from "./pages/VideoDemo";
import AccidentPrediction from "./pages/AccidentPrediction";
import Diagnostics from "./pages/Diagnostics";
import EmergencyLogs from "./pages/EmergencyLogs";
import TrafficAnalytics from "./pages/TrafficAnalytics";
import AdminProfile from "./pages/AdminProfile";
import SignalAdvisory from "./pages/SignalAdvisory";
import OfficerID from "./pages/OfficerID";
import OfficerVerify from "./pages/OfficerVerify";
import ChallanPortal from "./pages/ChallanPortal";
import "./App.css";

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === "/login";
  const isPublicPage = isLoginPage || location.pathname.startsWith("/verify/");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Force login on app startup (if no token in sessionStorage, redirect to /login)
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token && location.pathname !== "/login" && !location.pathname.startsWith("/verify/")) {
      navigate("/login");
    }
  }, [location.pathname, navigate]);
  // Load and apply HUD Theme on boot
  useEffect(() => {
    const cachedTheme = localStorage.getItem("hud_theme") || "Default Cyber-Blue";
    const root = document.documentElement;
    if (cachedTheme === "Neon-Purple (Glow Mode)" || cachedTheme === "Linear-Purple") {
      root.style.setProperty("--color-cyan", "#bd00ff");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(189, 0, 255, 0.5)");
    } else if (cachedTheme === "Neon-Green" || cachedTheme === "Autonomous Green (Eco-Mode)") {
      root.style.setProperty("--color-cyan", "#00ff66");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(0, 255, 102, 0.5)");
    } else {
      root.style.setProperty("--color-cyan", "#00f0ff");
      root.style.setProperty("--text-glow-cyan", "0 0 10px rgba(0, 240, 255, 0.5)");
    }
  }, []);
  // Lifted Video Analytics States to keep running in background
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoResults, setVideoResults] = useState(null);
  const [activeFrameStats, setActiveFrameStats] = useState(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isCCTVConnected, setIsCCTVConnected] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(() => sessionStorage.getItem("assigned_location") || "");
  const [activeTab, setActiveTab] = useState("file");
  const [streamUrl, setStreamUrl] = useState("");
  const [cctvPasskey, setCctvPasskey] = useState("");

  const lastSyncTimeRef = React.useRef(0);

  // Simulated playback progress in the background when VideoDemo is unmounted
  useEffect(() => {
    if (!videoResults || !videoResults.processed_frames) return;
    
    // Check if we are currently on the video-demo page
    const isVideoDemoPage = location.pathname === "/video-demo";
    if (isVideoDemoPage) return; // If on the page, the HTML video player handles it

    const interval = setInterval(() => {
      setPlaybackTime((prevTime) => {
        const nextTime = prevTime + 0.5; // increments of 0.5s to match frame timestamps
        const duration = videoResults.duration || 30;
        const finalTime = nextTime >= duration ? 0 : nextTime;

        // Update active frame stats in the background
        const frames = videoResults.processed_frames;
        if (frames.length === 0) return finalTime;

        const maxTimestamp = frames[frames.length - 1].timestamp;
        const lookupTime = maxTimestamp > 0 ? finalTime % (maxTimestamp + 1.0) : finalTime;

        let closest = frames[0];
        let minDiff = Math.abs(frames[0].timestamp - lookupTime);
        for (let i = 1; i < frames.length; i++) {
          const diff = Math.abs(frames[i].timestamp - lookupTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = frames[i];
          }
        }
        setActiveFrameStats(closest);

        return finalTime;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [videoResults, location.pathname]);

  // Periodically sync live detection data to the backend database (runs globally)
  useEffect(() => {
    if (!selectedLocation || !activeFrameStats) return;
    if (!videoResults && !isCCTVConnected && !videoUrl) return; // Only sync if video or CCTV is active
    
    const token = sessionStorage.getItem("token");
    if (!token) return;

    const now = Date.now();
    // Sync every 1.5 seconds (1500ms) without clearing interval issues for near real-time updates
    if (now - lastSyncTimeRef.current >= 1500) {
      lastSyncTimeRef.current = now;

      const syncDB = async () => {
        try {
          await fetch(`${API_BASE_URL}/admin/locations/${selectedLocation}/override`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              // We omit manual_override, red_time, green_time, and yellow_time here
              // so that if the admin has set custom manual overrides, we don't overwrite them!
              current_density: activeFrameStats.density,
              vehicle_counts: {
                car: activeFrameStats.vehicle_counts?.car || 0,
                bus: activeFrameStats.vehicle_counts?.bus || 0,
                auto: activeFrameStats.vehicle_counts?.auto || 0,
                motorcycle: activeFrameStats.vehicle_counts?.motorcycle || 0,
                bicycle: activeFrameStats.vehicle_counts?.bicycle || 0
              },
              is_video_data: true,
              predicted_weather: videoResults?.predicted_weather || "Clear"
            })
          });
        } catch (err) {
          console.error("Error syncing traffic analytics to DB:", err);
        }
      };
      syncDB();
    }
  }, [selectedLocation, activeFrameStats]);

  return (
    <div className="app-container" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Animated matrix dots in background */}
      <div className="traffic-bg-grid"></div>
      
      {!isPublicPage && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      
      <div 
        className={isPublicPage ? "login-layout-wrapper" : `main-layout ${sidebarOpen ? "sidebar-open" : ""}`}
      >
        {!isPublicPage && <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
        
        <main className={isPublicPage ? "public-main-content" : "main-content"}>
          <Routes>
            <Route path="/" element={<UserView />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify/:username" element={<OfficerVerify />} />
            <Route 
              path="/video-demo" 
              element={
                <VideoDemo 
                  videoFile={videoFile} setVideoFile={setVideoFile}
                  videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                  results={videoResults} setResults={setVideoResults}
                  playbackTime={playbackTime} setPlaybackTime={setPlaybackTime}
                  activeFrameStats={activeFrameStats} setActiveFrameStats={setActiveFrameStats}
                  selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation}
                  isCCTVConnected={isCCTVConnected} setIsCCTVConnected={setIsCCTVConnected}
                  activeTab={activeTab} setActiveTab={setActiveTab}
                  streamUrl={streamUrl} setStreamUrl={setStreamUrl}
                  cctvPasskey={cctvPasskey} setCctvPasskey={setCctvPasskey}
                />
              } 
            />
            <Route path="/accident-reports" element={<AccidentPrediction />} />
            <Route path="/challans" element={<ChallanPortal />} />
            <Route 
              path="/diagnostics" 
              element={
                <Diagnostics 
                  videoResults={videoResults}
                  activeFrameStats={activeFrameStats}
                  selectedLocation={selectedLocation}
                />
              } 
            />
            <Route path="/emergencies" element={<EmergencyLogs />} />
            <Route 
              path="/analytics" 
              element={
                <TrafficAnalytics 
                  videoResults={videoResults}
                  activeFrameStats={activeFrameStats}
                  selectedLocation={selectedLocation}
                />
              } 
            />
            
            <Route 
              path="/profile" 
              element={
                <PrivateRoute>
                  <AdminProfile />
                </PrivateRoute>
              } 
            />            
            <Route 
              path="/officer-id" 
              element={
                <PrivateRoute adminOnly={false}>
                  <OfficerID />
                </PrivateRoute>
              } 
            />            
            <Route 
              path="/transit-alerts" 
              element={
                <SignalAdvisory />
              } 
            />

            {/* Protected Control Room Dashboard */}
            <Route 
              path="/admin" 
              element={
                <PrivateRoute adminOnly={true}>
                  <AdminDashboard 
                    selectedLocation={selectedLocation}
                    setSelectedLocation={setSelectedLocation}
                  />
                </PrivateRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
