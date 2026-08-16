# AI-Powered Smart Traffic Digital Twin System

An intelligent, real-time web-based **Traffic Digital Twin** designed to map city intersections, optimize signal timings using AI density checks, clear corridors for emergency dispatches, and manage citizen traffic alerts and E-Challan payments.

The project is built as a role-based full-stack application featuring a high-performance **Python FastAPI** backend, a dynamic **React.js (Vite)** frontend, and a cloud **MongoDB Atlas** database cluster.

---

## 🚀 Key Features

### 1. Live GIS Map Topology
* Interactive **Leaflet.js** map rendering registered city intersections, telemetry statuses, and simulated live camera feeds.
* High-accuracy user location positioning with browser GPS targeting and an automatic IP-based Geolocation fallback (`ipapi.co`).

### 2. Autonomous AI Traffic Signals
* Adjusts light phase timers (Red, Yellow, Green cycle loops) dynamically based on real-time vehicle counts detected by computer vision simulation.
* Computes live ecological metrics, including **CO₂ Emissions Saved** index and fuel offset tracking.

### 3. Emergency SOS Green Waves
* Dijkstra-based dynamic routing to compute priority corridors for emergency dispatches (e.g., ambulances).
* Automates green-wave signals at target intersections along the dispatch pathway to minimize transit delays.

### 4. Traffic Advisory Feed
* Displays weather-adjusted speed limits, delay forecasts, and signal status alerts.
* Features automatic safety dimming checks for offline/uncalibrated intersections (`Feed Awaiting`).

### 5. E-Challan Registry & Payments
* Allows citizens to look up outstanding traffic fines by entering their vehicle license plate number.
* Integrates payment simulator nodes to process digital fine clearance.

---

## 🛠️ Technology Stack

* **Frontend**: React.js (Vite), Leaflet.js, HTML5, Vanilla CSS3, Lucide Icons
* **Backend**: Python 3.10+, FastAPI, Uvicorn, PyMongo, Pydantic, JWT Auth, Bcrypt
* **Database**: MongoDB Atlas / Local MongoDB Community Server

---

## 📂 Project Structure

```
AI-powered smart trafficdigital twin/
│
├── backend/                   # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # API Entrypoint
│   │   ├── models/            # Pydantic Schemas & DB Models
│   │   ├── routes/            # REST API Route Handlers
│   │   └── utils/             # Geocoding & Dijkstra Routing Algorithms
│   ├── requirements.txt       # Python Libraries
│   └── run.py                 # Startup Script
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI Components (Sidebar, PrivateRoute)
│   │   ├── pages/             # Page Nodes (UserView, AdminProfile, SignalAdvisory)
│   │   ├── App.jsx            # Application Router
│   │   └── main.jsx           # Mountpoint
│   └── package.json           # npm Dependencies
│
├── synopsis_report.pdf        # Academic Report PDF
└── README.md                  # System Documentation
```

---

## ⚙️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+)
* [Python](https://www.python.org/) (v3.10+)
* [MongoDB](https://www.mongodb.com/) (Atlas or local instance running on port `27017`)

---

### Step 1: Clone & Configure Database
1. Set up a MongoDB connection URI (local `mongodb://localhost:27017` or Atlas connection string).
2. Configure environment variables in `backend/.env`.

---

### Step 2: Run the Backend Server
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (cmd):
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python run.py
   ```
   *The backend will be available at: **`https://smart-traffic-backend-q3q9.onrender.com`***

---

### Step 3: Run the Frontend App
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will be available at: **`http://localhost:5173`***

---

## 🔒 User Roles & Credentials

For local testing, you can register new accounts or use these default credentials:

| Role | Username / Email | Password |
|---|---|---|
| **Traffic Police Admin** | `admin@traffic.in` | `admin123` |
| **Citizen (User)** | `citizen@traffic.in` | `citizen123` |
