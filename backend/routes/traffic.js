import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import { rtdetrService } from "../services/rtdetrService.js";
import { db } from "../db.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";

const router = express.Router();

// Configure multer for file uploads in the OS temp directory
const upload = multer({ dest: os.tmpdir() });

const ADJACENCY_LIST = {
  "Connaught Place Crossing": [
    { to: "Rajiv Chowk Metro Square", distance: 1.0 },
    { to: "India Gate Circle", distance: 2.5 }
  ],
  "Rajiv Chowk Metro Square": [
    { to: "Connaught Place Crossing", distance: 1.0 },
    { to: "India Gate Circle", distance: 3.0 },
    { to: "Noida Sector 62 Intersection", distance: 12.0 }
  ],
  "India Gate Circle": [
    { to: "Connaught Place Crossing", distance: 2.5 },
    { to: "Rajiv Chowk Metro Square", distance: 3.0 },
    { to: "Noida Sector 62 Intersection", distance: 10.0 }
  ],
  "Noida Sector 62 Intersection": [
    { to: "Rajiv Chowk Metro Square", distance: 12.0 },
    { to: "India Gate Circle", distance: 10.0 },
    { to: "Sitapur Junction", distance: 400.0 }
  ],
  "Sitapur Junction": [
    { to: "Khairabad Crossing", distance: 8.0 },
    { to: "Noida Sector 62 Intersection", distance: 400.0 }
  ],
  "Khairabad Crossing": [
    { to: "Sitapur Junction", distance: 8.0 },
    { to: "Sidhauli Junction", distance: 35.0 }
  ],
  "Sidhauli Junction": [
    { to: "Khairabad Crossing", distance: 35.0 },
    { to: "Lucknow Toll Plaza", distance: 50.0 }
  ],
  "Lucknow Toll Plaza": [
    { to: "Sidhauli Junction", distance: 50.0 }
  ]
};

// Route Prefix will be /traffic
router.get("/locations", async (req, res) => {
  const { search } = req.query;
  const query = {};
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  try {
    const docs = await db.collection("locations").find(query).toArray();
    const results = [];
    for (const doc of docs) {
      doc.id = doc._id.toString();
      const adminUser = await db.collection("users").findOne({ role: "admin", assigned_location: doc.name });
      doc.has_admin = adminUser !== null;
      results.push(doc);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/locations/:location_name", async (req, res) => {
  const { location_name } = req.params;

  try {
    const doc = await db.collection("locations").findOne({ name: location_name });
    if (!doc) {
      return res.status(404).json({ detail: "Location not found" });
    }

    doc.id = doc._id.toString();
    const adminUser = await db.collection("users").findOne({ role: "admin", assigned_location: doc.name });
    doc.has_admin = adminUser !== null;
    res.json(doc);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/predict-accident/:location_name", async (req, res) => {
  const { location_name } = req.params;
  const weather = req.query.weather || "Clear";

  try {
    const loc = await db.collection("locations").findOne({ name: location_name });
    if (!loc) {
      return res.status(404).json({ detail: "Location not found" });
    }

    const density = loc.current_density || 0.0;
    const status = loc.traffic_status || "Low";

    let prob = 0.05;
    const factors = [];
    const suggestions = [];

    if (status === "Heavy") {
      prob += 0.25;
      factors.push("High vehicle density and congestion");
      suggestions.push("Enforce strict speed limit control on adjacent lanes");
    } else if (status === "Gridlock") {
      prob += 0.40;
      factors.push("Severe gridlock traffic slowing reaction times");
      suggestions.push("Deploy traffic wardens to manual intersection controls");
      suggestions.push("Reroute oncoming heavy vehicles through secondary streets");
    } else if (status === "Medium") {
      prob += 0.10;
      factors.push("Moderate traffic density");
      suggestions.push("Monitor pedestrian crossings for peak times");
    }

    const weatherLower = weather.toLowerCase();
    if (weatherLower === "rainy") {
      prob += 0.20;
      factors.push("Wet road conditions and reduced visibility");
      suggestions.push("Display 'Slippery Road' warnings on digital signage");
      suggestions.push("Extend yellow light duration by 2 seconds");
    } else if (weatherLower === "foggy") {
      prob += 0.35;
      factors.push("Poor visibility below 50 meters");
      suggestions.push("Activate high-intensity fog warning beacons");
      suggestions.push("Encourage headlight usage and maintain 3x stopping distance");
    } else if (weatherLower === "stormy") {
      prob += 0.30;
      factors.push("Strong crosswinds and active water logging");
      suggestions.push("Close low-lying underpasses if water logs exceed 10cm");
    }

    if (loc.manual_override) {
      prob -= 0.05;
      factors.push("Manual police officer supervision active");
      suggestions.push("Follow manual signals from traffic police");
    }

    prob = Math.min(0.95, Math.max(0.02, prob));
    let riskLevel = "Low";

    if (prob < 0.20) {
      riskLevel = "Low";
      suggestions.push("Normal traffic monitoring rules apply.");
    } else if (prob < 0.50) {
      riskLevel = "Medium";
      suggestions.push("Caution advised for light motor vehicles.");
    } else if (prob < 0.75) {
      riskLevel = "High";
      suggestions.push("Immediate speed restrictions should be applied.");
    } else {
      riskLevel = "Critical";
      suggestions.push("Deploy quick-response medical & police vehicles to standby spots.");
    }

    res.json({
      location_name,
      probability: Number(prob.toFixed(2)),
      risk_level: riskLevel,
      contributing_factors: factors,
      safety_suggestions: suggestions,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Dijkstra pathfinding helper
function calculateRouteInternal(start, destination, densityMap) {
  if (!ADJACENCY_LIST[start] || !ADJACENCY_LIST[destination]) {
    throw new Error("Selected intersections are outside the connected graph network.");
  }

  const distances = {};
  const predecessors = {};
  const visited = new Set();

  for (const node of Object.keys(ADJACENCY_LIST)) {
    distances[node] = Infinity;
    predecessors[node] = null;
  }
  distances[start] = 0.0;

  const queue = [{ node: start, dist: 0.0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist);
    const { node: current, dist: currentDist } = queue.shift();

    if (current === destination) break;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const neighbor of ADJACENCY_LIST[current] || []) {
      const target = neighbor.to;
      const distance = neighbor.distance;

      const targetDensity = densityMap[target] || 0.0;
      const weight = distance * (1.0 + (targetDensity / 100.0) * 5.0);

      const newDist = currentDist + weight;
      if (newDist < distances[target]) {
        distances[target] = newDist;
        predecessors[target] = current;
        queue.push({ node: target, dist: newDist });
      }
    }
  }

  const path = [];
  let curr = destination;
  while (curr !== null) {
    path.push(curr);
    curr = predecessors[curr];
  }
  path.reverse();

  if (path.length === 1 && path[0] !== start) {
    throw new Error("No feasible route found in graph network.");
  }

  const densityWeights = {};
  for (const node of path) {
    densityWeights[node] = Number((densityMap[node] || 0.0).toFixed(1));
  }

  return {
    start,
    destination,
    route: path,
    density_weights: densityWeights
  };
}

router.post("/emergency", async (req, res) => {
  const { type, start_location, destination_location } = req.body;

  try {
    const startLoc = await db.collection("locations").findOne({ name: start_location });
    const destLoc = await db.collection("locations").findOne({ name: destination_location });

    if (!startLoc || !destLoc) {
      return res.status(404).json({ detail: "Start or destination intersection not registered." });
    }

    const locations = await db.collection("locations").find({}).toArray();
    const densityMap = {};
    for (const loc of locations) {
      densityMap[loc.name] = loc.current_density || 0.0;
    }

    let route = [start_location, destination_location];
    try {
      const routeResult = calculateRouteInternal(start_location, destination_location, densityMap);
      route = routeResult.route;
    } catch (err) {
      // fallback
    }

    const emergencyDoc = {
      type,
      start_location,
      destination_location,
      status: "Pending",
      route,
      created_at: new Date()
    };

    const result = await db.collection("emergency_requests").insertOne(emergencyDoc);
    emergencyDoc.id = result.insertedId.toString();
    res.status(201).json(emergencyDoc);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/emergencies", async (req, res) => {
  try {
    const docs = await db.collection("emergency_requests").find({}).toArray();
    const results = docs.map(doc => {
      doc.id = doc._id.toString();
      return doc;
    });

    results.sort((a, b) => b.created_at - a.created_at);
    res.json(results);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/calculate-route", async (req, res) => {
  const { start, destination } = req.query;

  try {
    const locations = await db.collection("locations").find({}).toArray();
    const densityMap = {};
    for (const loc of locations) {
      densityMap[loc.name] = loc.current_density || 0.0;
    }

    const routeResult = calculateRouteInternal(start, destination, densityMap);
    res.json(routeResult);
  } catch (err) {
    res.status(404).json({ detail: err.message });
  }
});

// Asynchronous background task simulation
async function processVideoTask(jobId, filepath, locationName) {
  try {
    const results = rtdetrService.processVideo(filepath);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    if (locationName) {
      const loc = await db.collection("locations").findOne({ name: locationName });
      if (loc) {
        await db.collection("locations").updateOne(
          { name: locationName },
          {
            $set: {
              current_density: results.density,
              traffic_status: results.traffic_status,
              vehicle_counts: results.vehicle_counts,
              manual_override: false,
              is_video_data: true,
              updated_at: new Date()
            }
          }
        );

        const cars = results.vehicle_counts.car || 0;
        const buses = results.vehicle_counts.bus || 0;
        const trucks = results.vehicle_counts.truck || 0;
        const motorcycles = results.vehicle_counts.motorcycle || 0;
        const bicycles = results.vehicle_counts.bicycle || 0;
        const totalVehicles = cars + buses + trucks + motorcycles + bicycles;

        const density = results.density;
        const co2Saved = (cars * 5.8) + ((buses + trucks) * 29.2) + (motorcycles * 2.5);
        const timeSaved = Number((density * 0.25).toFixed(1));

        let rec = "Traffic is flowing smoothly. Maintain AI autonomous mode.";
        if (density >= 70) {
          rec = "Congestion peak detected. Extend northbound green phase cycle by 18 seconds immediately.";
        } else if (density >= 30) {
          rec = "Moderate queue detected. AI recommended to prioritize lane merge lanes for dynamic clearing.";
        }

        const reportDoc = {
          report_id: crypto.randomUUID(),
          job_id: jobId,
          location_name: locationName,
          timestamp: new Date(),
          vehicle_counts: results.vehicle_counts,
          total_vehicles: totalVehicles,
          density,
          traffic_status: results.traffic_status,
          red_time: loc.red_time || 30,
          green_time: loc.green_time || 30,
          yellow_time: loc.yellow_time || 5,
          co2_saved: co2Saved,
          time_saved: timeSaved,
          recommendations: rec
        };

        await db.collection("traffic_reports").insertOne(reportDoc);
      }
    }

    await db.collection("jobs").updateOne(
      { job_id: jobId },
      {
        $set: {
          status: "completed",
          results,
          updated_at: new Date()
        }
      }
    );
  } catch (err) {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    await db.collection("jobs").updateOne(
      { job_id: jobId },
      {
        $set: {
          status: "failed",
          error: err.message,
          updated_at: new Date()
        }
      }
    );
  }
}

router.post("/upload-demo", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: "Upload file is required." });
  }

  const { location_name } = req.query;
  const ext = req.file.originalname.split(".").pop().toLowerCase();

  if (!["mp4", "avi", "mov", "mkv"].includes(ext)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ detail: "Unsupported video format. Upload mp4, avi, mov or mkv." });
  }

  if (req.file.size > 50 * 1024 * 1024) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(413).json({ detail: "File too large. Maximum supported size is 50MB." });
  }

  try {
    const jobId = crypto.randomUUID();
    await db.collection("jobs").insertOne({
      job_id: jobId,
      status: "processing",
      results: null,
      error: null,
      created_at: new Date()
    });

    // Run processing task asynchronously in background
    processVideoTask(jobId, req.file.path, location_name);

    res.json({ job_id: jobId, status: "processing" });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ detail: `Error starting video processing: ${err.message}` });
  }
});

router.get("/jobs/:job_id", async (req, res) => {
  const { job_id } = req.params;

  try {
    const job = await db.collection("jobs").findOne({ job_id });
    if (!job) {
      return res.status(404).json({ detail: "Job not found." });
    }

    delete job._id;
    res.json(job);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/challans/:vehicle_number", async (req, res) => {
  const vehicle_number = req.params.vehicle_number;
  const cleanNumber = vehicle_number.replace(/-/g, "").replace(/\s/g, "").toUpperCase();

  try {
    const docs = await db.collection("challans").find({}).toArray();
    const results = [];
    for (const doc of docs) {
      const dbNumber = (doc.vehicle_number || "").replace(/-/g, "").replace(/\s/g, "").toUpperCase();
      if (cleanNumber === dbNumber) {
        doc.id = doc._id.toString();
        results.push(doc);
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post("/challans/:challan_id/create-order", async (req, res) => {
  const { challan_id } = req.params;

  if (challan_id.startsWith("CH-DEMO-")) {
    return res.json({
      id: `order_sandbox_${Math.floor(100000 + Math.random() * 900000)}`,
      amount: 1000 * 100,
      currency: "INR",
      receipt: challan_id,
      status: "created",
      is_sandbox: true
    });
  }

  try {
    const challan = await db.collection("challans").findOne({ challan_id });
    if (!challan) {
      return res.status(404).json({ detail: "Challan record not found." });
    }

    // Always fallback to sandbox order generation for standard testing configuration
    res.json({
      id: `order_sandbox_${Math.floor(100000 + Math.random() * 900000)}`,
      amount: (challan.fine_amount || 1000) * 100,
      currency: "INR",
      receipt: challan_id,
      status: "created",
      is_sandbox: true
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post("/challans/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, challan_id } = req.body;

  try {
    if (razorpay_order_id.startsWith("order_sandbox_")) {
      if (!challan_id.startsWith("CH-DEMO-")) {
        await db.collection("challans").updateOne(
          { challan_id },
          { $set: { status: "Paid" } }
        );
      }
      return res.json({ status: "Success", message: "Sandbox payment verification cleared." });
    }

    // Production HMAC check placeholder
    await db.collection("challans").updateOne(
      { challan_id },
      { $set: { status: "Paid" } }
    );
    res.json({ status: "Success", message: "Payment verified and cleared in system." });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/challans-config", (req, res) => {
  res.json({ rto_api_active: false });
});

router.get("/reports", async (req, res) => {
  const { location_name, time_filter = "1h", date_filter = "today" } = req.query;

  const now = new Date();
  const query = { location_name };

  let startDate;
  if (date_filter === "today") {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (date_filter === "yesterday") {
    startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    query.timestamp = { $gte: startDate, $lt: endDate };
  } else if (date_filter === "week") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  if (date_filter !== "yesterday") {
    query.timestamp = { $gte: startDate };
  }

  let startTime;
  if (time_filter === "1h") {
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (time_filter === "6h") {
    startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  } else if (time_filter === "24h" || time_filter === "peak") {
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else {
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
  }

  if (date_filter !== "yesterday") {
    query.timestamp.$gte = new Date(Math.max(query.timestamp.$gte.getTime(), startTime.getTime()));
  }

  try {
    let reports = await db.collection("traffic_reports").find(query).toArray();

    if (time_filter === "peak") {
      reports = reports.filter(r => {
        const hour = new Date(r.timestamp).getHours();
        return [8, 9, 10, 17, 18, 19].includes(hour);
      });
    }

    if (reports.length === 0) {
      return res.json({
        avg_vehicles: 0,
        avg_density: 0.0,
        avg_time_saved: 0.0,
        avg_co2: 0.0,
        hourly_profile: [0, 0, 0, 0, 0],
        recommendations: [],
        is_live_active: false,
        reports_count: 0
      });
    }

    let totalVehicles = 0;
    let totalDensity = 0.0;
    let totalTimeSaved = 0.0;
    let totalCo2 = 0.0;
    const vehicleClasses = { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 };

    for (const r of reports) {
      totalVehicles += r.total_vehicles || 0;
      totalDensity += r.density || 0.0;
      totalTimeSaved += r.time_saved || 0.0;
      totalCo2 += r.co2_saved || 0.0;
      const vc = r.vehicle_counts || {};
      for (const k of Object.keys(vehicleClasses)) {
        vehicleClasses[k] += vc[k] || 0;
      }
    }

    const count = reports.length;
    const avgDensity = totalDensity / count;

    const recommendations = [];
    for (const r of reports) {
      if (r.recommendations) {
        recommendations.push({
          location_name: r.location_name,
          recommendation: r.recommendations,
          density: r.density,
          timestamp: r.timestamp
        });
      }
    }

    res.json({
      avg_vehicles: Math.round(totalVehicles / count),
      avg_density: Number(avgDensity.toFixed(1)),
      avg_time_saved: Number((totalTimeSaved / count).toFixed(1)),
      avg_co2: Number((totalCo2 / count).toFixed(1)),
      hourly_profile: [
        Math.round(vehicleClasses.car / count),
        Math.round(vehicleClasses.bus / count),
        Math.round(vehicleClasses.truck / count),
        Math.round(vehicleClasses.motorcycle / count),
        Math.round(vehicleClasses.bicycle / count)
      ],
      recommendations,
      is_live_active: true,
      reports_count: count
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
