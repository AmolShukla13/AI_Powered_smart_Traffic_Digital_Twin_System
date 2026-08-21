import express from "express";
import jwt from "jsonwebtoken";
import { db, hashPassword, verifyPassword } from "../db.js";

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET_KEY || "SMART_TRAFFIC_DIGITAL_TWIN_SECRET_KEY_9988";
const EXPIRES_IN = "10h";

// Middleware to authenticate JWT tokens
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ detail: "Could not validate credentials" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(401).json({ detail: "Could not validate credentials" });
    }
    req.user = user;
    next();
  });
}

// Router prefix will be /auth
router.post("/signup", async (req, res) => {
  const { username, password, email, phone, role = "user", assigned_location } = req.body;

  if (!username || username.length < 3) {
    return res.status(400).json({ detail: "Username must be at least 3 characters long" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ detail: "Password must be at least 6 characters long" });
  }
  if (!email) {
    return res.status(400).json({ detail: "Email is required" });
  }

  try {
    const existingUser = await db.collection("users").findOne({ username });
    if (existingUser) {
      return res.status(400).json({ detail: "Username already registered" });
    }

    const existingEmail = await db.collection("users").findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ detail: "Email already registered" });
    }

    const hashedPwd = await hashPassword(password);
    let assignedLoc = assigned_location;
    if (assignedLoc && assignedLoc.trim().toLowerCase() === "sitapur") {
      assignedLoc = "Sitapur Junction";
    }

    const newUser = {
      username,
      password: hashedPwd,
      email,
      phone,
      role,
      assigned_location: assignedLoc
    };

    await db.collection("users").insertOne(newUser);

    // Auto-create location if admin registers with location
    if (role === "admin" && assignedLoc) {
      const locName = assignedLoc.trim();
      const existingLoc = await db.collection("locations").findOne({ name: locName });
      if (!existingLoc) {
        let lat = Number((28.6 + (Math.random() * 0.16 - 0.08)).toFixed(4));
        let lng = Number((77.2 + (Math.random() * 0.16 - 0.08)).toFixed(4));

        const locNameLower = locName.toLowerCase();
        if (locNameLower.includes("sitapur")) {
          lat = 27.5785;
          lng = 80.6586;
        } else if (locNameLower.includes("ghaziyabad") || locNameLower.includes("ghaziabad")) {
          lat = 28.6692;
          lng = 77.4538;
        } else if (locNameLower.includes("noida")) {
          lat = 28.5708;
          lng = 77.3258;
        }

        const newLoc = {
          name: locName,
          latitude: lat,
          longitude: lng,
          traffic_status: "Low",
          manual_override: false,
          red_time: 30,
          green_time: 30,
          yellow_time: 5,
          current_density: 0.0,
          vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
          is_video_data: false,
          updated_at: new Date()
        };

        await db.collection("locations").insertOne(newLoc);
        console.log(`Auto-created location '${locName}' during Admin sign-up.`);
      }
    }

    const tokenData = {
      sub: username,
      role,
      assigned_location: assignedLoc
    };
    const token = jwt.sign(tokenData, SECRET_KEY, { expiresIn: EXPIRES_IN });

    res.json({
      access_token: token,
      token_type: "bearer",
      role,
      username,
      assigned_location: assignedLoc
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.collection("users").findOne({ username });
    if (!user) {
      return res.status(401).json({ detail: "Incorrect username or password" });
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ detail: "Incorrect username or password" });
    }

    const tokenData = {
      sub: user.username,
      role: user.role,
      assigned_location: user.assigned_location
    };
    const token = jwt.sign(tokenData, SECRET_KEY, { expiresIn: EXPIRES_IN });

    res.json({
      access_token: token,
      token_type: "bearer",
      role: user.role,
      username: user.username,
      assigned_location: user.assigned_location
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/profile", authenticateToken, async (req, res) => {
  const username = req.user.sub;

  try {
    const user = await db.collection("users").findOne({ username });
    if (!user) {
      return res.status(404).json({ detail: "User not found" });
    }

    res.json({
      username: user.username,
      email: user.email || "",
      role: user.role,
      assigned_location: user.assigned_location || "",
      full_name: user.full_name || user.username,
      phone: user.phone || "+91 98765 43210",
      rank: user.rank || "Orchestration Officer",
      badge_number: user.badge_number || "POL-84920",
      profile_pic: user.profile_pic || ""
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.put("/update-profile", authenticateToken, async (req, res) => {
  const username = req.user.sub;
  const { email, full_name, phone, rank, badge_number, profile_pic } = req.body;

  const updateData = {};
  if (email !== undefined) updateData.email = email;
  if (full_name !== undefined) updateData.full_name = full_name;
  if (phone !== undefined) updateData.phone = phone;
  if (rank !== undefined) updateData.rank = rank;
  if (badge_number !== undefined) updateData.badge_number = badge_number;
  if (profile_pic !== undefined) updateData.profile_pic = profile_pic;

  try {
    if (Object.keys(updateData).length > 0) {
      await db.collection("users").updateOne({ username }, { $set: updateData });
    }
    res.json({ status: "success", message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get("/verify-badge/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const user = await db.collection("users").findOne({ username: new RegExp(`^${username}$`, "i") });
    if (!user) {
      return res.status(404).json({ detail: "Officer profile not found" });
    }

    res.json({
      full_name: user.full_name || user.username,
      rank: user.rank || "Traffic Control Officer",
      badge_number: user.badge_number || "POL-84920",
      assigned_location: user.assigned_location || "Sitapur Junction",
      profile_pic: user.profile_pic || "",
      status: "Verified Active"
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { username, email, badge_number, new_password } = req.body;

  if (!username || !email || !badge_number || !new_password) {
    return res.status(400).json({ detail: "All fields (Username, Email, Badge ID, New Password) are required" });
  }

  try {
    const user = await db.collection("users").findOne({ username: new RegExp(`^${username}$`, "i") });
    if (!user) {
      return res.status(404).json({ detail: "Officer identity not found in database records" });
    }

    const dbEmail = (user.email || "").trim().toLowerCase();
    const dbBadge = (user.badge_number || "").trim().toUpperCase();

    const providedEmail = email.trim().toLowerCase();
    const providedBadge = badge_number.trim().toUpperCase();

    if (dbEmail !== providedEmail) {
      return res.status(400).json({ detail: "Identity verification failed: Email mismatch" });
    }

    const expectedBadge = dbBadge || "POL-84920";
    if (expectedBadge !== providedBadge) {
      return res.status(400).json({ detail: "Identity verification failed: Badge Number mismatch" });
    }

    const hashedPwd = await hashPassword(new_password);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { password: hashedPwd } });

    res.json({ status: "success", message: "Password reset successfully. Please log in." });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
