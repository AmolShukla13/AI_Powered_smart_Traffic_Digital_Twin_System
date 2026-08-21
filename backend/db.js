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
let db = null;

if (mongoUri) {
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db("smart_traffic_twin");
    console.log("Successfully connected to MongoDB Atlas!");
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}. Falling back to memory DB simulation.`);
    db = createMockDb();
  }
} else {
  console.log("MONGODB_URI not set. Falling back to memory DB simulation.");
  db = createMockDb();
}

export { db };

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

    // 3. Seed default users
    const usersCount = await db.collection("users").countDocuments({});
    if (usersCount === 0) {
      const adminPwd = await hashPassword("admin123");
      const userPwd = await hashPassword("user123");
      await db.collection("users").insertMany([
        {
          username: "admin",
          password: adminPwd,
          email: "admin@traffic.gov.in",
          role: "admin",
          assigned_location: "Sitapur Junction"
        },
        {
          username: "user",
          password: userPwd,
          email: "user@gmail.com",
          role: "user",
          assigned_location: null
        }
      ]);
      console.log("Seeded default users (admin/admin123, user/user123).");
    }

    // 4. Seed default E-Challans
    const challansCount = await db.collection("challans").countDocuments({});
    if (challansCount === 0) {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fourteenHoursAgo = new Date();
      fourteenHoursAgo.setHours(fourteenHoursAgo.getHours() - 14);

      await db.collection("challans").insertMany([
        {
          challan_id: "CH-98124",
          vehicle_number: "UP32-AB-8888",
          location: "Sitapur Junction",
          violation_type: "Overspeeding (74 km/h in 60 km/h zone)",
          fine_amount: 1000,
          status: "Unpaid",
          timestamp: twoDaysAgo.toISOString().replace("T", " ").substring(0, 19)
        },
        {
          challan_id: "CH-12495",
          vehicle_number: "DL3C-XY-5555",
          location: "Connaught Place Crossing",
          violation_type: "Red Light Violation (AI Camera Skip)",
          fine_amount: 2000,
          status: "Paid",
          timestamp: fiveDaysAgo.toISOString().replace("T", " ").substring(0, 19)
        },
        {
          challan_id: "CH-87123",
          vehicle_number: "UP32-AB-8888",
          location: "Khairabad Crossing",
          violation_type: "No Helmet (Two-Wheeler AI Cam)",
          fine_amount: 500,
          status: "Unpaid",
          timestamp: fourteenHoursAgo.toISOString().replace("T", " ").substring(0, 19)
        }
      ]);
      console.log("Seeded default E-Challans.");
    }
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
