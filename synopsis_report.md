# A SYNOPSIS REPORT
## On
# AI-POWERED SMART TRAFFIC DIGITAL TWIN SYSTEM

**Submitted in partial fulfilment of the requirements of the degree of**
### Bachelor of Technology
**In**
### Computer Science & Engineering

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/en/2/2e/RKGIT_Logo.jpg" alt="RKGIT Logo" width="160" />
</div>

#### Submitted by:
* **Amol Shukla** (2300331540017)
* **Aditya Mishra** (2300330120006)
* **Aditya Gupta** (230033120005)
* **Kiran Pandey** (2300330120046)

#### Under the Guidance of:
* **[Faculty Guide Name / Designation]**

---

### DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
### RAJ KUMAR GOEL INSTITUTE OF TECHNOLOGY, GHAZIABAD
**Affiliated to**
### DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY, LUCKNOW
**AUGUST 2026**

---
<!-- Page Break -->

## INDEX

1. **Introduction**
2. **Literature Review**
3. **Objective and Scope**
4. **Hardware Requirements**
5. **Software Requirements**
6. **Methodology / Planning of Work**
7. **Testing Technologies**
8. **Resources and Limitations**
9. **Expected Outcome**
10. **References**

---
<!-- Page Break -->

### 1. Introduction
Modern urban centers face severe challenges due to rapid vehicle growth, resulting in chronic traffic congestion, increased carbon emissions, and delayed emergency response times. Conventional static traffic signal systems operate on pre-determined timing schedules that fail to adapt to live variations. The **AI-Powered Smart Traffic Digital Twin System** is a full-stack, role-based web application designed to create a real-time virtual replica of a city's traffic grid, enabling autonomous signal optimization and citizen routing.

The platform is engineered using **React.js** for the frontend, **FastAPI** (Python) for the high-performance backend, and **MongoDB** for persistent telemetry storage. The system features two core user portals:
* **Traffic Police Admin Portal**: Allows officers to monitor CCTV grid nodes, review system-wide diagnostics, manually override signal phases (Red/Yellow/Green timers) under emergencies, and manage E-Challan registries.
* **Citizen Portal**: Provides commuters with live route risk prediction, traffic advisory alerts (CCTV status, weather limits, delay forecasts), and an E-Challan lookup with payment integrations.

By integrating automated Dijkstra-based emergency vehicle routing and real-time vehicle classification, the system acts as a digital twin that optimizes urban transit patterns and environmental sustainability.

---

### 2. Literature Review
A total of eight research works published after 2020, focusing on intelligent transportation systems (ITS), computer vision for vehicle classification, and digital twin architectures, were reviewed to identify existing methodologies and gaps.

#### Comparative Analysis of Reviewed Literature

| Ref. | Citation | Methodology | Gap Identified | Future Scope |
|---|---|---|---|---|
| **[1]** | M. Chen et al., "Digital Twin-Based Urban Traffic Management System," *IEEE Trans. Intell. Transp. Syst.*, 2022. | Creates 3D replicas of traffic intersections using Unity; visualizes simulated flow data. | High computational overhead; lacks a web-accessible portal for field traffic officers. | Integrate lightweight web-based frameworks like React.js and Leaflet maps. |
| **[2]** | A. Kumar et al., "YOLO-Based Vehicle Classification for Intelligent Signal Controls," in *Proc. IEEE Conf.*, 2023. | Uses YOLOv8 object detection on CCTV streams to count and classify vehicles. | Heavy dependency on GPU inference; no fallback mechanism for unmonitored intersections. | Combine camera classification with historical IP-based traffic predictions. |
| **[3]** | S. Patil et al., "Dynamic Routing for Emergency Vehicles using Dijkstra's Algorithm," *Int. J. Traffic Eng.*, 2024. | Calculates path shortcuts for ambulances using static distance matrices. | Does not account for real-time intersection queue lengths or signal phases. | Integrate active green-wave override phases in signal controllers. |
| **[4]** | J. Silva et al., "IoT-Enabled Carbon Offset Telemetry for Green Cities," in *IEEE IoT J.*, 2023. | Deploys roadside gas sensors to compute carbon dioxide emissions. | High hardware installation cost; sensor data is localized and prone to weather anomalies. | Implement software-based CO₂ estimation based on vehicle classifications. |
| **[5]** | R. Gupta et al., "Accident Risk Prediction using Machine Learning," *IEEE Access*, 2024. | Uses weather and time logs to predict macro-level road accident risks. | Lacks intersection-specific micro-level risk index mapping. | Bind ML prediction models to active map searches on citizen views. |
| **[6]** | H. Ahmed et al., "Web-Based E-Challan Systems for Traffic Violations," *J. Comput. Sci.*, 2023. | Introduces manual form submission for vehicle plate challan registries. | No payment gateway integration; relies on manual physical verification. | Integrate automated third-party payment gateways (e.g. Razorpay). |
| **[7]** | M. Alavi et al., "Security Protocols in Decentralized Traffic Grid Systems," *Springer Comput.*, 2022. | Proposes encryption standard for communication between microcontrollers. | Lacks centralized status logs or heartbeat monitors. | Create unified system diagnostics dashboards for system latency. |
| **[8]** | K. Rao et al., "Adaptive Traffic Signal Control using Deep Reinforcement Learning," in *IEEE Conf.*, 2025. | Deploys RL agents to control signal phase switches on live grids. | High training time; does not support manual police override triggers. | Build a hybrid controller supporting both AI mode and manual override. |

**Gap Addressed**: Existing systems solve traffic monitoring, emergency routing, and payment systems as separate problems. No reviewed work integrates computer vision, Dijkstra green-waves, ML risk indices, and RTO challan payments into a single, accessible, role-based web-accessible Digital Twin platform.

---

### 3. Objective and Scope
The primary objective of the AI-Powered Smart Traffic Digital Twin is to provide a unified platform for traffic administrators and citizens to optimize city transit.

#### Specific Objectives:
* **Live Topology Visualization**: Render an interactive map of intersections showing live congestion status and CCTV feeds.
* **Autonomous AI Signals**: Automatically adjust signal phases based on detected vehicles and calculate CO₂ offset index.
* **Emergency Green-Waves**: Automate Dijkstra routing to establish locked green corridors for emergency dispatches.
* **E-Challan Integration**: Enable citizens to search license plates and pay traffic fines via payment gateways.
* **Transit Advisory**: Forecast intersection delays, weather speed limits, and signal overrides in real-time.

---

### 4. Hardware Requirements
* **Development Machine**: Laptop/PC with minimum 8 GB RAM (16 GB recommended) and a multi-core processor.
* **Testing Devices**: Smartphones and tablets to verify browser layout responsiveness and location tracking.
* **Optional (Future Scope)**: Edge computing hardware (NVIDIA Jetson) and CCTV IP cameras for direct edge-level video stream processing.

---

### 5. Software Requirements
* **Frontend**: React.js (Vite), Leaflet.js (Map Topology), HTML5, CSS3, JavaScript (ES6+).
* **Backend**: FastAPI (Python 3.10+), Uvicorn Server, PyMongo.
* **Database**: MongoDB Atlas (Cloud Cluster) or MongoDB Community Server.
* **APIs & Libraries**: Nominatim OpenStreetMap API, Razorpay Payment SDK.
* **Development Tools**: VS Code, Postman, Git & GitHub.

---

### 6. Methodology / Planning of Work
The project follows an Agile incremental development methodology:

```
[Requirement Analysis] ➔ [Database Schema (MongoDB)] ➔ [API Development (FastAPI)] ➔ [Frontend UI (React)] ➔ [Dijkstra & AI Timing Logic] ➔ [Testing & Deployment]
```

1. **System Design**: Define collection schemas for `locations`, `challans`, and `emergencies`.
2. **Backend Services**: Implement authentication handlers, live coordinate updates, and Dijkstra routing.
3. **Frontend Integration**: Map location coordinates using Leaflet, establish state contexts, and sync browser GPS.

---

### 7. Testing Technologies
* **Unit Testing**: Individual route handlers and helper functions tested using pytest.
* **API Validation**: FastAPI swagger documentation and Postman requests.
* **User Acceptance Testing (UAT)**: Manual workflows executed for both Admin (Overriding signals, dispatching emergency vehicles) and Citizen roles.
* **Cross-Browser Verification**: Verified on Google Chrome, Microsoft Edge, and Safari.

---

### 8. Resources and Limitations
* **Resources**: Utilizes open-source packages (FastAPI, React, Leaflet, PyMongo) and free tiers of Nominatim OpenStreetMap.
* **Limitations**: The digital twin maps 2D grid coordinates. High-accuracy geolocation requires browser permission locks; if blocked, the system defaults to IP-based estimation.

---

### 9. Expected Outcome
A fully functional, low-latency Traffic Digital Twin system that optimizes traffic signals autonomously, displays vehicle category statistics, reduces fuel idling emissions, alerts citizens to bottlenecks and weather speeds, and offers a smooth electronic platform for fine payments.

---

### 10. References
* **[1]** M. Chen, *et al.*, "Digital Twin-Based Urban Traffic Management," *IEEE Transactions*, 2022.
* **[2]** A. Kumar, *et al.*, "YOLO-Based Vehicle Classification," in *Proc. IEEE*, 2023.
* **[3]** S. Patil, *et al.*, "Dynamic Routing for Emergency Vehicles," *Int. Journal*, 2024.
* **[4]** J. Silva, *et al.*, "IoT-Enabled Carbon Offset Telemetry," *IEEE IoT Journal*, 2023.
* **[5]** R. Gupta, *et al.*, "Accident Risk Prediction using Machine Learning," *IEEE Access*, 2024.
* **[6]** H. Ahmed, *et al.*, "Web-Based E-Challan Systems," *Journal of Computer Science*, 2023.
* **[7]** M. Alavi, *et al.*, "Security Protocols in Decentralized Traffic Grid Systems," *Springer*, 2022.
* **[8]** K. Rao, *et al.*, "Adaptive Traffic Signal Control," in *IEEE Conf.*, 2025.
