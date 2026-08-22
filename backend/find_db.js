import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
  if (!uri) {
    console.error("MONGODB_URI is not set!");
    return;
  }
  console.log("Connecting to:", uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully! Listing databases...");
    
    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    console.log("--- FOUND DATABASES ---");
    for (const dbInfo of dbsList.databases) {
      const dbName = dbInfo.name;
      // Skip system databases if needed, but let's check all
      if (["admin", "local", "config"].includes(dbName)) continue;
      
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      const colNames = collections.map(c => c.name);
      
      console.log(`Database: "${dbName}" | Collections: [${colNames.join(", ")}]`);
      
      if (colNames.includes("users")) {
        const user = await db.collection("users").findOne({ username: "Amol" });
        if (user) {
          console.log(`>>> FOUND USER "Amol" in Database: "${dbName}"!`);
          console.log(`    User Details:`, { ...user, password: "[HIDDEN]" });
        }
      }
    }
    console.log("------------------------");
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    await client.close();
  }
}
run();
