import express from "express";
import { ObjectId } from "mongodb";
import { db } from "../db.js";
import { authenticateToken } from "./auth.js";
import { rtdetrService } from "../services/rtdetrService.js";

const router = express.Router();

// Middleware to check admin role
function checkAdminRole(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ detail: "Access denied. Admin role required." });
    }
    next();
  });
}

router.post("/locations", checkAdminRole, async (req, res) => {
  const { name, latitude, longitude, traffic_status = "Low", manual_override = false, red_time = 30, green_time = 30, yellow_time = 5 } = req.body;

  try {
    const existing = await db.collection("locations").findOne({ name });
    if (existing) {
      return res.status(400).json({ detail: "Location name already exists." });
    }

    const newLoc = {
      name,
      latitude,
      longitude,
      traffic_status,
      manual_override,
      red_time,
      green_time,
      yellow_time,
      current_density: 0.0,
      vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
      updated_at: new Date()
    };

    const result = await db.collection("locations").insertOne(newLoc);
    newLoc.id = result.insertedId.toString();
    res.json(newLoc);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.put("/locations/:location_name/override", checkAdminRole, async (req, res) => {
  const { location_name } = req.params;
  const { manual_override, current_density, traffic_status, vehicle_counts, red_time, green_time, yellow_time, is_video_data, predicted_weather } = req.body;

  try {
    const loc = await db.collection("locations").findOne({ name: location_name });
    if (!loc) {
      return res.status(404).json({ detail: "Location not found." });
    }

    if (req.user.assigned_location && req.user.assigned_location !== location_name) {
      return res.status(403).json({ detail: `You are only authorized to manage traffic at '${req.user.assigned_location}'.` });
    }

    const updateFields = {
      updated_at: new Date()
    };

    if (manual_override !== undefined) {
      updateFields.manual_override = manual_override;
    }

    if (current_density !== undefined) {
      updateFields.current_density = current_density;
      updateFields.traffic_status = rtdetrService.getTrafficStatusFromDensity(current_density);
      updateFields.is_video_data = true;
    } else if (traffic_status !== undefined) {
      updateFields.traffic_status = traffic_status;
      const densityMap = { Low: 15.0, Medium: 45.0, Heavy: 75.0, Gridlock: 95.0 };
      updateFields.current_density = densityMap[traffic_status] || 0.0;
    }

    if (vehicle_counts !== undefined) {
      updateFields.vehicle_counts = {
        car: vehicle_counts.car || 0,
        bus: vehicle_counts.bus || 0,
        truck: vehicle_counts.truck || 0,
        motorcycle: vehicle_counts.motorcycle || 0,
        bicycle: vehicle_counts.bicycle || 0
      };
    }

    if (red_time !== undefined) updateFields.red_time = red_time;
    if (green_time !== undefined) updateFields.green_time = green_time;
    if (yellow_time !== undefined) updateFields.yellow_time = yellow_time;
    if (is_video_data !== undefined) updateFields.is_video_data = is_video_data;
    if (predicted_weather !== undefined) updateFields.predicted_weather = predicted_weather;

    await db.collection("locations").updateOne({ name: location_name }, { $set: updateFields });

    const updatedLoc = await db.collection("locations").findOne({ name: location_name });
    updatedLoc.id = updatedLoc._id.toString();
    res.json(updatedLoc);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/admins/status", checkAdminRole, async (req, res) => {
  try {
    const locationsCount = await db.collection("locations").countDocuments({});
    const usersCount = await db.collection("users").countDocuments({});
    const adminsCount = await db.collection("users").countDocuments({ role: new RegExp("^admin$", "i") });

    res.json({
      admin_username: req.user.sub,
      assigned_location: req.user.assigned_location,
      total_locations: locationsCount,
      total_users: usersCount,
      total_admins: adminsCount
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.put("/emergencies/:emergency_id/route", checkAdminRole, async (req, res) => {
  const { emergency_id } = req.params;
  const { route } = req.body;

  try {
    let queryId;
    try {
      queryId = new ObjectId(emergency_id);
    } catch (e) {
      queryId = emergency_id;
    }

    const emergency = await db.collection("emergency_requests").findOne({ _id: queryId });
    if (!emergency) {
      return res.status(404).json({ detail: "Emergency request not found" });
    }

    await db.collection("emergency_requests").updateOne(
      { _id: queryId },
      {
        $set: {
          status: "Routed",
          route,
          updated_at: new Date()
        }
      }
    );

    res.json({ status: "success", message: "Emergency request routed successfully" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.put("/emergencies/:emergency_id/clear", checkAdminRole, async (req, res) => {
  const { emergency_id } = req.params;

  try {
    let queryId;
    try {
      queryId = new ObjectId(emergency_id);
    } catch (e) {
      queryId = emergency_id;
    }

    const emergency = await db.collection("emergency_requests").findOne({ _id: queryId });
    if (!emergency) {
      return res.status(404).json({ detail: "Emergency request not found" });
    }

    await db.collection("emergency_requests").updateOne(
      { _id: queryId },
      {
        $set: {
          status: "Cleared",
          updated_at: new Date()
        }
      }
    );

    res.json({ status: "success", message: "Emergency request cleared successfully" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/directory", async (req, res) => {
  try {
    const users = await db.collection("users").find({ role: new RegExp("^admin$", "i") }).toArray();
    const directory = users.map(u => ({
      username: u.username,
      email: u.email || "n/a",
      assigned_location: u.assigned_location || "Global Admin"
    }));
    res.json(directory);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
