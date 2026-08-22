import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const mongoUri = process.env.MONGODB_URI || "";
let client = null;
export let db = null;

if (mongoUri) {
  try {
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    db = client.db();
  } catch (err) {
    db = createMockDb();
  }
} else {
  db = createMockDb();
}

// Helper to hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Helper to verify password
export async function verifyPassword(password, hashed) {
  try {
    return await bcrypt.compare(password, hashed);
  } catch (err) {
    return false;
  }
}

// Seeding function
export async function seedDatabase() {
  try {
    if (client) {
      const pingPromise = client.db("admin").command({ ping: 1 });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timed out")), 2000));
      await Promise.race([pingPromise, timeoutPromise]);
      console.log("Successfully connected to MongoDB Atlas!");
    } else {
      throw new Error("MongoDB client is not initialized.");
    }
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}. Falling back to memory DB simulation.`);
    db = createMockDb();
  }

  try {
    // 1. Rename any existing "Sitapur" location or user assignment
    await db.collection("locations").updateMany(
      { name: "Sitapur" },
      { $set: { name: "Sitapur Junction" } }
    );
    await db.collection("users").updateMany(
      { assigned_location: "Sitapur" },
      { $set: { assigned_location: "Sitapur Junction" } }
    );

    // 2. Seeding default locations
    const defaultLocations = [
      {
        name: "Connaught Place Crossing",
        latitude: 28.6304,
        longitude: 77.2177,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Rajiv Chowk Metro Square",
        latitude: 28.6328,
        longitude: 77.2197,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "India Gate Circle",
        latitude: 28.6129,
        longitude: 77.2295,
        traffic_status: "Low",
        manual_override: false,
        red_time: 45,
        green_time: 45,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Noida Sector 62 Intersection",
        latitude: 28.6273,
        longitude: 77.3725,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Sitapur Junction",
        latitude: 27.5785,
        longitude: 80.6586,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Khairabad Crossing",
        latitude: 27.5284,
        longitude: 80.7259,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Sidhauli Junction",
        latitude: 27.2789,
        longitude: 80.8872,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      },
      {
        name: "Lucknow Toll Plaza",
        latitude: 26.8467,
        longitude: 80.9462,
        traffic_status: "Low",
        manual_override: false,
        red_time: 30,
        green_time: 30,
        yellow_time: 5,
        current_density: 0.0,
        vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 },
        is_video_data: false,
        updated_at: new Date()
      }
    ];

    for (const loc of defaultLocations) {
      const hasRealReports = await db.collection("traffic_reports").findOne({ location_name: loc.name }) !== null;
      const existing = await db.collection("locations").findOne({ name: loc.name });
      
      if (!existing) {
        loc.is_video_data = hasRealReports;
        await db.collection("locations").insertOne(loc);
      } else {
        await db.collection("locations").updateOne(
          { name: loc.name },
          {
            $set: {
              is_video_data: hasRealReports,
              current_density: 0.0,
              traffic_status: "Low",
              vehicle_counts: { car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0 }
            }
          }
        );
      }
    }
    console.log("Database default locations synchronized successfully.");

    // 3. Always seed core users to prevent data loss on server restarts/mock database fallbacks
    try {
      const amolPwd = await hashPassword("123456");
      await db.collection("users").updateOne(
        { username: "Amol" },
        {
          $setOnInsert: {
            email: "amol@gmail.com",
            role: "admin",
            assigned_location: "Sitapur Junction"
          },
          $set: {
            password: amolPwd
          }
        },
        { upsert: true }
      );

      const adminPwd = await hashPassword("admin123");
      await db.collection("users").updateOne(
        { username: "admin" },
        {
          $setOnInsert: {
            email: "admin@traffic.gov.in",
            role: "admin",
            assigned_location: "Sitapur Junction"
          },
          $set: {
            password: adminPwd
          }
        },
        { upsert: true }
      );
      console.log("Successfully synchronized core database users ('Amol' and 'admin').");
    } catch (userSeedErr) {
      console.error("Failed to seed core users:", userSeedErr);
    }

    // 4. Seed default E-Challans (Disabled for a clean slate)
    console.log("Database challan seeding skipped for clean slate.");
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

// In-Memory Database fallback helper
function createMockDb() {
  const collections = {};
  const getCollection = (name) => {
    if (!collections[name]) {
      collections[name] = {
        data: [],
        findOne: async (query) => {
          return collections[name].data.find(doc => matchQuery(doc, query)) || null;
        },
        find: (query) => ({
          toArray: async () => {
            const q = query || {};
            return collections[name].data.filter(doc => matchQuery(doc, q));
          }
        }),
        insertOne: async (doc) => {
          const newDoc = { _id: Math.random().toString(36).substring(7), ...doc };
          collections[name].data.push(newDoc);
          return { insertedId: newDoc._id };
        },
        insertMany: async (docs) => {
          const inserted = docs.map(doc => ({ _id: Math.random().toString(36).substring(7), ...doc }));
          collections[name].data.push(...inserted);
          return { insertedIds: inserted.map(d => d._id) };
        },
        updateOne: async (query, update) => {
          const doc = collections[name].data.find(d => matchQuery(d, query));
          if (doc && update.$set) {
            Object.assign(doc, update.$set);
          }
          return { modifiedCount: doc ? 1 : 0 };
        },
        updateMany: async (query, update) => {
          let count = 0;
          collections[name].data.forEach(doc => {
            if (matchQuery(doc, query)) {
              if (update.$set) Object.assign(doc, update.$set);
              count++;
            }
          });
          return { modifiedCount: count };
        },
        countDocuments: async (query) => {
          const q = query || {};
          return collections[name].data.filter(doc => matchQuery(doc, q)).length;
        }
      };
    }
    return collections[name];
  };

  const matchQuery = (doc, query) => {
    for (const [key, value] of Object.entries(query)) {
      if (value && typeof value === 'object' && value.$regex) {
        const regex = new RegExp(value.$regex, value.$options || '');
        if (!regex.test(doc[key] || '')) return false;
      } else if (doc[key] !== value) {
        return false;
      }
    }
    return true;
  };

  return {
    collection: getCollection
  };
}
