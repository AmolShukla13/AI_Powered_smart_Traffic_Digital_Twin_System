import os
import pymongo
from bson import ObjectId
from datetime import datetime, timedelta
import bcrypt

# Setup MongoDB Atlas connection
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip() and not line.strip().startswith("#"):
                parts = line.strip().split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0]] = parts[1].strip()

MONGO_URI = os.getenv("MONGODB_URI", "")
db = None
is_mock = True

class MockCollection:
    def __init__(self, name):
        self.name = name
        self.data = {}

    def find_one(self, query):
        for doc in self.data.values():
            match = True
            for k, v in query.items():
                if k == "_id" and isinstance(v, (str, ObjectId)):
                    if str(doc.get("_id")) != str(v):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc.copy()
        return None

    def find(self, query=None):
        query = query or {}
        results = []
        for doc in self.data.values():
            match = True
            for k, v in query.items():
                if k == "_id" and isinstance(v, (str, ObjectId)):
                    if str(doc.get("_id")) != str(v):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(doc.copy())
        return results

    def insert_one(self, document):
        doc = document.copy()
        if "_id" not in doc:
            doc["_id"] = str(ObjectId())
        else:
            doc["_id"] = str(doc["_id"])
        self.data[doc["_id"]] = doc
        return type('InsertOneResult', (object,), {'inserted_id': doc["_id"]})()

    def update_one(self, query, update_data):
        doc = self.find_one(query)
        if not doc:
            return type('UpdateResult', (object,), {'matched_count': 0, 'modified_count': 0})()
        
        doc_id = doc["_id"]
        actual_doc = self.data[doc_id]
        
        if "$set" in update_data:
            for k, v in update_data["$set"].items():
                actual_doc[k] = v
        
        return type('UpdateResult', (object,), {'matched_count': 1, 'modified_count': 1})()

    def delete_one(self, query):
        doc = self.find_one(query)
        if not doc:
            return type('DeleteResult', (object,), {'deleted_count': 0})()
        
        del self.data[doc["_id"]]
        return type('DeleteResult', (object,), {'deleted_count': 1})()

    def count_documents(self, query):
        return len(self.find(query))

class MockDatabase:
    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]

# Check connection
if MONGO_URI:
    try:
        # standard client connection
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command('ping')
        db = client["smart_traffic_twin"]
        is_mock = False
        print("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        print(f"MongoDB connection failed: {e}. Falling back to mock local DB.")
        db = MockDatabase()
        is_mock = True
else:
    print("MONGODB_URI not set. Falling back to mock local DB.")
    db = MockDatabase()
    is_mock = True

# Helper to hash password
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Helper to verify password
def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

# Seed initial default locations and users if empty
def _seed_database_internal():
    default_locations = [
        {
            "name": "Connaught Place Crossing",
            "latitude": 28.6304,
            "longitude": 77.2177,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Rajiv Chowk Metro Square",
            "latitude": 28.6328,
            "longitude": 77.2197,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "India Gate Circle",
            "latitude": 28.6129,
            "longitude": 77.2295,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 45,
            "green_time": 45,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Noida Sector 62 Intersection",
            "latitude": 28.6273,
            "longitude": 77.3725,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        }
    ]

    for loc in default_locations:
        has_real_reports = db["traffic_reports"].find_one({"location_name": loc["name"]}) is not None
        existing = db["locations"].find_one({"name": loc["name"]})
        if not existing:
            loc["is_video_data"] = has_real_reports
            db["locations"].insert_one(loc)
        else:
            db["locations"].update_one(
                {"name": loc["name"]},
                {
                    "$set": {
                        "is_video_data": has_real_reports,
                        "current_density": existing.get("current_density", 0.0) if has_real_reports else 0.0,
                        "traffic_status": existing.get("traffic_status", "Low") if has_real_reports else "Low",
                        "vehicle_counts": existing.get("vehicle_counts", {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0}) if has_real_reports else {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0}
                    }
                }
            )
    print("Database default locations synchronized successfully.")

    # Seed an admin and user if not exists
    if db["users"].count_documents({}) == 0:
        admin_user = {
            "username": "admin",
            "password": hash_password("admin123"),
            "email": "admin@traffic.gov.in",
            "role": "admin",
            "assigned_location": "Connaught Place Crossing"
        }
        normal_user = {
            "username": "user",
            "password": hash_password("user123"),
            "email": "user@gmail.com",
            "role": "user",
            "assigned_location": None
        }
        db["users"].insert_one(admin_user)
        db["users"].insert_one(normal_user)
        print("Seeded default users (admin/admin123, user/user123).")

    # Seed default E-Challans if not exists
    if db["challans"].count_documents({}) == 0:
        default_challans = [
            {
                "challan_id": "CH-98124",
                "vehicle_number": "UP32-AB-8888",
                "location": "Sitapur Junction",
                "violation_type": "Overspeeding (74 km/h in 60 km/h zone)",
                "fine_amount": 1000,
                "status": "Unpaid",
                "timestamp": (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
            },
            {
                "challan_id": "CH-12495",
                "vehicle_number": "DL3C-XY-5555",
                "location": "Connaught Place Crossing",
                "violation_type": "Red Light Violation (AI Camera Skip)",
                "fine_amount": 2000,
                "status": "Paid",
                "timestamp": (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")
            },
            {
                "challan_id": "CH-87123",
                "vehicle_number": "UP32-AB-8888",
                "location": "Khairabad Crossing",
                "violation_type": "No Helmet (Two-Wheeler AI Cam)",
                "fine_amount": 500,
                "status": "Unpaid",
                "timestamp": (datetime.utcnow() - timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S")
            }
        ]
        db["challans"].insert_many(default_challans)
        print("Seeded default E-Challans.")

    # Rename any existing "Sitapur" location or assignment to "Sitapur Junction" for consistency
    db["locations"].update_many(
        {"name": "Sitapur"},
        {"$set": {"name": "Sitapur Junction"}}
    )
    db["users"].update_many(
        {"assigned_location": "Sitapur"},
        {"$set": {"assigned_location": "Sitapur Junction"}}
    )

    # Seed Sitapur-Lucknow Highway corridor locations
    highway_locations = [
        {
            "name": "Sitapur Junction",
            "latitude": 27.5785,
            "longitude": 80.6586,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Khairabad Crossing",
            "latitude": 27.5284,
            "longitude": 80.7259,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Sidhauli Junction",
            "latitude": 27.2789,
            "longitude": 80.8872,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Lucknow Toll Plaza",
            "latitude": 26.8467,
            "longitude": 80.9462,
            "traffic_status": "Low",
            "manual_override": False,
            "red_time": 30,
            "green_time": 30,
            "yellow_time": 5,
            "current_density": 0.0,
            "vehicle_counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0},
            "is_video_data": False,
            "updated_at": datetime.utcnow()
        }
    ]
    
    for loc in highway_locations:
        db["locations"].update_one(
            {"name": loc["name"]},
            {"$setOnInsert": loc},
            upsert=True
        )

    # Force coordinate update and reset metrics for demo locations like Sitapur Junction
    db["locations"].update_many(
        {"name": {"$regex": "Sitapur Junction", "$options": "i"}},
        {"$set": {
            "latitude": 27.5785, 
            "longitude": 80.6586,
            "current_density": 0.0,
            "traffic_status": "Low",
            "is_video_data": False,
            "vehicle_counts": {
                "car": 0,
                "bus": 0,
                "truck": 0,
                "motorcycle": 0,
                "bicycle": 0
            }
        }}
    )

def seed_database():
    try:
        _seed_database_internal()
    except Exception as e:
        print("Database seeding encountered a warning/error (bypassed):", e)
