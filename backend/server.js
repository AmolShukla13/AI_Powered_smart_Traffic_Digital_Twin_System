import express from "express";
import cors from "cors";
import { seedDatabase, isMockDatabase } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import trafficRouter from "./routes/traffic.js";

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for all frontend origins
app.use(cors({
  origin: "*",
  credentials: false
}));

// Express built-in body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Centralized logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root welcome route
app.get("/", (req, res) => {
  res.json({
    status: "online",
    database: isMockDatabase ? "In-Memory Simulation (Mock DB - Data WILL BE LOST on restarts/deployments)" : "MongoDB Atlas (Cloud DB - Data is saved permanently)",
    message: "Welcome to the AI-powered Smart Traffic Digital Twin API Service!",
    version: "1.0.0"
  });
});

// Dual mount routes to maintain 100% compatibility with legacy and api-prefixed client calls
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/traffic", trafficRouter);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/traffic", trafficRouter);

// Initialize DB and start listening
try {
  await seedDatabase();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server is running on http://0.0.0.0:${PORT}`);
  });
} catch (err) {
  console.error("Express server startup failed:", err);
}
