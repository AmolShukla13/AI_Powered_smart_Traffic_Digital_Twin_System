from fastapi import APIRouter, HTTPException, UploadFile, File, Query, BackgroundTasks
from typing import List, Optional
import os
import shutil
import uuid
from datetime import datetime, timedelta
import random

from ..models import LocationResponse, AccidentPredictionReport
from ..database import db
from ..services.yolo_service import yolo_service

import tempfile
router = APIRouter(prefix="/traffic", tags=["Traffic & AI Analytics"])

UPLOAD_DIR = tempfile.gettempdir()

@router.get("/locations", response_model=List[LocationResponse])
def get_all_locations(search: Optional[str] = None):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    docs = db["locations"].find(query)
    results = []
    for doc in docs:
        doc["id"] = str(doc["_id"])
        admin_user = db["users"].find_one({"role": "admin", "assigned_location": doc["name"]})
        doc["has_admin"] = admin_user is not None
        results.append(doc)
    return results

@router.get("/locations/{location_name}", response_model=LocationResponse)
def get_location_details(location_name: str):
    doc = db["locations"].find_one({"name": location_name})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    doc["id"] = str(doc["_id"])
    admin_user = db["users"].find_one({"role": "admin", "assigned_location": doc["name"]})
    doc["has_admin"] = admin_user is not None
    return doc

@router.get("/predict-accident/{location_name}", response_model=AccidentPredictionReport)
def predict_accident(location_name: str, weather: str = "Clear"):
    loc = db["locations"].find_one({"name": location_name})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
        
    density = loc.get("current_density", 0.0)
    status = loc.get("traffic_status", "Low")
    
    # Calculate simple probability score based on traffic density and weather
    # Base probability
    prob = 0.05
    factors = []
    suggestions = []
    
    if status == "Heavy":
        prob += 0.25
        factors.append("High vehicle density and congestion")
        suggestions.append("Enforce strict speed limit control on adjacent lanes")
    elif status == "Gridlock":
        prob += 0.40
        factors.append("Severe gridlock traffic slowing reaction times")
        suggestions.append("Deploy traffic wardens to manual intersection controls")
        suggestions.append("Reroute oncoming heavy vehicles through secondary streets")
    elif status == "Medium":
        prob += 0.10
        factors.append("Moderate traffic density")
        suggestions.append("Monitor pedestrian crossings for peak times")
        
    if weather.lower() == "rainy":
        prob += 0.20
        factors.append("Wet road conditions and reduced visibility")
        suggestions.append("Display 'Slippery Road' warnings on digital signage")
        suggestions.append("Extend yellow light duration by 2 seconds")
    elif weather.lower() == "foggy":
        prob += 0.35
        factors.append("Poor visibility below 50 meters")
        suggestions.append("Activate high-intensity fog warning beacons")
        suggestions.append("Encourage headlight usage and maintain 3x stopping distance")
    elif weather.lower() == "stormy":
        prob += 0.30
        factors.append("Strong crosswinds and active water logging")
        suggestions.append("Close low-lying underpasses if water logs exceed 10cm")
        
    # Check manual override
    if loc.get("manual_override", False):
        prob -= 0.05 # Manual override usually improves traffic order
        factors.append("Manual police officer supervision active")
        suggestions.append("Follow manual signals from traffic police")

    prob = min(0.95, max(0.02, prob))
    
    if prob < 0.20:
        risk_level = "Low"
        suggestions.append("Normal traffic monitoring rules apply.")
    elif prob < 0.50:
        risk_level = "Medium"
        suggestions.append("Caution advised for light motor vehicles.")
    elif prob < 0.75:
        risk_level = "High"
        suggestions.append("Immediate speed restrictions should be applied.")
    else:
        risk_level = "Critical"
        suggestions.append("Deploy quick-response medical & police vehicles to standby spots.")

    return {
        "location_name": location_name,
        "probability": round(prob, 2),
        "risk_level": risk_level,
        "contributing_factors": factors,
        "safety_suggestions": suggestions,
        "timestamp": datetime.utcnow()
    }

import heapq
from bson import ObjectId
from ..models import EmergencyCreate

def process_video_task(job_id: str, filepath: str, location_name: Optional[str]):
    try:
        # Process the video via YOLOv8 Service
        results = yolo_service.process_video(filepath)
        
        # Clean up file after processing to save disk space
        if os.path.exists(filepath):
            os.remove(filepath)
            
        # Update database if location_name is provided
        if location_name:
            loc = db["locations"].find_one({"name": location_name})
            if loc:
                db["locations"].update_one(
                    {"name": location_name},
                    {
                        "$set": {
                            "current_density": results["density"],
                            "traffic_status": results["traffic_status"],
                            "vehicle_counts": results["vehicle_counts"],
                            "manual_override": False,
                            "is_video_data": True,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Save report data in traffic_reports collection
                cars = results["vehicle_counts"].get("car", 0)
                buses = results["vehicle_counts"].get("bus", 0)
                trucks = results["vehicle_counts"].get("truck", 0)
                motorcycles = results["vehicle_counts"].get("motorcycle", 0)
                bicycles = results["vehicle_counts"].get("bicycle", 0)
                total_vehicles = cars + buses + trucks + motorcycles + bicycles
                
                density = results["density"]
                co2_saved = (cars * 5.8) + ((buses + trucks) * 29.2) + (motorcycles * 2.5)
                time_saved = float(round(density * 0.25, 1))
                
                rec = "Traffic is flowing smoothly. Maintain AI autonomous mode."
                if density >= 70:
                    rec = "Congestion peak detected. Extend northbound green phase cycle by 18 seconds immediately."
                elif density >= 30:
                    rec = "Moderate queue detected. AI recommended to prioritize lane merge lanes for dynamic clearing."
                
                report_doc = {
                    "report_id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "location_name": location_name,
                    "timestamp": datetime.utcnow(),
                    "vehicle_counts": results["vehicle_counts"],
                    "total_vehicles": total_vehicles,
                    "density": density,
                    "traffic_status": results["traffic_status"],
                    "red_time": loc.get("red_time", 30),
                    "green_time": loc.get("green_time", 30),
                    "yellow_time": loc.get("yellow_time", 5),
                    "co2_saved": co2_saved,
                    "time_saved": time_saved,
                    "recommendations": rec
                }
                db["traffic_reports"].insert_one(report_doc)
                
                # Propagate results back in response
                results["updated_location"] = location_name
            
        db["jobs"].update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "results": results,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        db["jobs"].update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(e),
                    "updated_at": datetime.utcnow()
                }
            }
        )

@router.post("/upload-demo")
async def upload_demo_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    location_name: Optional[str] = Query(None)
):
    # Verify file extension
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["mp4", "avi", "mov", "mkv"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format. Upload mp4, avi, mov or mkv."
        )

    # Check file size (max 50MB)
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > (50 * 1024 * 1024):
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum supported size is 50MB."
        )

    # Save to upload folder
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        job_id = str(uuid.uuid4())
        db["jobs"].insert_one({
            "job_id": job_id,
            "status": "processing",
            "results": None,
            "error": None,
            "created_at": datetime.utcnow()
        })
        
        background_tasks.add_task(process_video_task, job_id, filepath, location_name)
        
        return {"job_id": job_id, "status": "processing"}
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Error starting video processing: {str(e)}")

@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    job = db["jobs"].find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    if "_id" in job:
        del job["_id"]
    return job

ADJACENCY_LIST = {
    "Connaught Place Crossing": [
        {"to": "Rajiv Chowk Metro Square", "distance": 1.0},
        {"to": "India Gate Circle", "distance": 2.5}
    ],
    "Rajiv Chowk Metro Square": [
        {"to": "Connaught Place Crossing", "distance": 1.0},
        {"to": "India Gate Circle", "distance": 3.0},
        {"to": "Noida Sector 62 Intersection", "distance": 12.0}
    ],
    "India Gate Circle": [
        {"to": "Connaught Place Crossing", "distance": 2.5},
        {"to": "Rajiv Chowk Metro Square", "distance": 3.0},
        {"to": "Noida Sector 62 Intersection", "distance": 10.0}
    ],
    "Noida Sector 62 Intersection": [
        {"to": "Rajiv Chowk Metro Square", "distance": 12.0},
        {"to": "India Gate Circle", "distance": 10.0},
        {"to": "Sitapur Junction", "distance": 400.0}
    ],
    # Sitapur-Lucknow Highway Corridor (Geographically correct NH-24 pathfinding network)
    "Sitapur Junction": [
        {"to": "Khairabad Crossing", "distance": 8.0},
        {"to": "Noida Sector 62 Intersection", "distance": 400.0}
    ],
    "Khairabad Crossing": [
        {"to": "Sitapur Junction", "distance": 8.0},
        {"to": "Sidhauli Junction", "distance": 35.0}
    ],
    "Sidhauli Junction": [
        {"to": "Khairabad Crossing", "distance": 35.0},
        {"to": "Lucknow Toll Plaza", "distance": 50.0}
    ],
    "Lucknow Toll Plaza": [
        {"to": "Sidhauli Junction", "distance": 50.0}
    ]
}

def calculate_route_internal(start: str, destination: str):
    # Fetch current location densities
    locations = db["locations"].find({})
    density_map = {loc["name"]: loc.get("current_density", 0.0) for loc in locations}
    
    # Fallback weights for any locations not in db
    for k in ADJACENCY_LIST:
        if k not in density_map:
            density_map[k] = 0.0
            
    if start not in ADJACENCY_LIST or destination not in ADJACENCY_LIST:
        raise HTTPException(status_code=404, detail="Selected intersections are outside the connected graph network.")

    # Dijkstra Pathfinding
    distances = {node: float('inf') for node in ADJACENCY_LIST}
    distances[start] = 0.0
    predecessors = {node: None for node in ADJACENCY_LIST}
    
    pq = [(0.0, start)]
    
    while pq:
        current_dist, current_node = heapq.heappop(pq)
        
        if current_node == destination:
            break
            
        if current_dist > distances.get(current_node, float('inf')):
            continue
            
        for neighbor in ADJACENCY_LIST.get(current_node, []):
            target = neighbor["to"]
            dist = neighbor["distance"]
            
            # Density-adjusted weight
            target_density = density_map.get(target, 0.0)
            weight = dist * (1.0 + (target_density / 100.0) * 5.0)
            
            new_dist = current_dist + weight
            if new_dist < distances.get(target, float('inf')):
                distances[target] = new_dist
                predecessors[target] = current_node
                heapq.heappush(pq, (new_dist, target))
                
    path = []
    current = destination
    while current is not None:
        path.append(current)
        current = predecessors.get(current)
    path.reverse()
    
    if len(path) == 1 and path[0] != start:
        raise HTTPException(status_code=404, detail="No feasible route found in graph network.")
        
    return {
        "start": start,
        "destination": destination,
        "route": path,
        "density_weights": {node: round(density_map.get(node, 0.0), 1) for node in path}
    }

@router.post("/emergency", status_code=201)
def create_emergency(request: EmergencyCreate):
    # Verify locations exist
    start_loc = db["locations"].find_one({"name": request.start_location})
    dest_loc = db["locations"].find_one({"name": request.destination_location})
    
    if not start_loc or not dest_loc:
        raise HTTPException(status_code=404, detail="Start or destination intersection not registered.")
        
    # Pre-calculate the route on submission
    try:
        route_result = calculate_route_internal(request.start_location, request.destination_location)
        route = route_result["route"]
    except Exception:
        route = [request.start_location, request.destination_location]

    emergency_doc = {
        "type": request.type,
        "start_location": request.start_location,
        "destination_location": request.destination_location,
        "status": "Pending", # Pending, Routed, Cleared
        "route": route,
        "created_at": datetime.utcnow()
    }
    
    result = db["emergency_requests"].insert_one(emergency_doc)
    emergency_doc["id"] = str(result.inserted_id)
    if "_id" in emergency_doc:
        del emergency_doc["_id"]
    return emergency_doc

@router.get("/emergencies")
def get_all_emergencies():
    docs = db["emergency_requests"].find({})
    results = []
    for doc in docs:
        doc["id"] = str(doc["_id"])
        if "_id" in doc:
            del doc["_id"]
        results.append(doc)
    # Sort by creation time (most recent first)
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return results

@router.get("/calculate-route")
def calculate_route(start: str, destination: str):
    return calculate_route_internal(start, destination)

def fetch_real_world_rto_challans_template(vehicle_number: str):
    """
    Production implementation template for calling National Transport APIs (API Setu / NIC)
    or private aggregators like Surepass.io:
    """
    import requests
    api_key = os.getenv("RTO_API_KEY")
    if not api_key:
        return []

    # Example integration with API Setu / transport gateway
    url = "https://api.apisetu.gov.in/v1/transport/challan"
    headers = {
        "accept": "application/json",
        "X-APISETU-APIKEY": api_key,
        "X-APISETU-CLIENTID": os.getenv("RTO_CLIENT_ID", "demo_client")
    }
    payload = {
        "docType": "CHALN",
        "vehicleNumber": vehicle_number
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers)
        if res.ok:
            data = res.json()
            # Map API Setu fields to our local database model and sync
            results = []
            for item in data.get("challans", []):
                mapped = {
                    "challan_id": item.get("challanNumber"),
                    "vehicle_number": vehicle_number,
                    "location": item.get("violationPlace", "Unknown"),
                    "violation_type": item.get("violationDetails", "Speed violation"),
                    "fine_amount": int(item.get("fineAmount", 1000)),
                    "status": "Paid" if item.get("paymentStatus") == "Paid" else "Unpaid",
                    "timestamp": item.get("challanDate", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
                }
                # Sync database
                db["challans"].update_one(
                    {"challan_id": mapped["challan_id"]},
                    {"$set": mapped},
                    upsert=True
                )
                results.append(mapped)
            return results
    except Exception as e:
        print("API Setu RTO call failed, falling back to local DB:", e)
    return []

@router.get("/challans/{vehicle_number}")
def get_vehicle_challans(vehicle_number: str):
    clean_number = vehicle_number.replace("-", "").replace(" ", "").upper()
    
    # 1. Query external government RTO registry first
    external_challans = fetch_real_world_rto_challans_template(clean_number)
    if external_challans:
        return external_challans
        
    # 2. Fallback to local MongoDB Digital Twin records
    docs = db["challans"].find({})
    results = []
    for doc in docs:
        db_number = doc.get("vehicle_number", "").replace("-", "").replace(" ", "").upper()
        if clean_number == db_number:
            doc["id"] = str(doc["_id"])
            if "_id" in doc:
                del doc["_id"]
            results.append(doc)
    return results

@router.post("/challans/{challan_id}/create-order")
def create_payment_order(challan_id: str):
    # Demo preview bypass: immediately return a sandbox order if the ID is simulated
    if challan_id.startswith("CH-DEMO-"):
        return {
            "id": f"order_sandbox_{random.randint(100000, 999999)}",
            "amount": 1000 * 100,  # 1000 rupees in paise
            "currency": "INR",
            "receipt": challan_id,
            "status": "created",
            "is_sandbox": True
        }

    challan = db["challans"].find_one({"challan_id": challan_id})
    if not challan:
        raise HTTPException(status_code=404, detail="Challan record not found.")

    razorpay_key = os.getenv("RAZORPAY_KEY_ID")
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET")

    # Sandbox fallback if credentials are not configured
    if not razorpay_key or not razorpay_secret:
        return {
            "id": f"order_sandbox_{random.randint(100000, 999999)}",
            "amount": challan["fine_amount"] * 100,  # in paise
            "currency": "INR",
            "receipt": challan_id,
            "status": "created",
            "is_sandbox": True
        }

    # Production Razorpay order API integration
    import requests
    from requests.auth import HTTPBasicAuth
    
    url = "https://api.razorpay.com/v1/orders"
    payload = {
        "amount": int(challan["fine_amount"] * 100),
        "currency": "INR",
        "receipt": challan_id
    }
    
    try:
        res = requests.post(url, json=payload, auth=HTTPBasicAuth(razorpay_key, razorpay_secret))
        if res.ok:
            return res.json()
        else:
            raise HTTPException(status_code=res.status_code, detail="Razorpay order generation failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to payment gateway: {str(e)}")

from pydantic import BaseModel
class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    challan_id: str

@router.post("/challans/verify-payment")
def verify_payment(request: PaymentVerifyRequest):
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET")

    # If sandbox mode or credentials not configured, verify automatically
    if request.razorpay_order_id.startswith("order_sandbox_") or not razorpay_secret:
        if not request.challan_id.startswith("CH-DEMO-"):
            db["challans"].update_one(
                {"challan_id": request.challan_id},
                {"$set": {"status": "Paid"}}
            )
        return {"status": "Success", "message": "Sandbox payment verification cleared."}

    # Production Cryptographic HMAC signature check
    import hmac
    import hashlib

    msg = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
    generated_sig = hmac.new(
        razorpay_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if generated_sig == request.razorpay_signature:
        db["challans"].update_one(
            {"challan_id": request.challan_id},
            {"$set": {"status": "Paid"}}
        )
        return {"status": "Success", "message": "Payment verified and cleared in system."}
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction signature. Verification failed.")

@router.get("/challans-config")
def get_challans_config():
    return {"rto_api_active": bool(os.getenv("RTO_API_KEY"))}

@router.get("/reports")
def get_traffic_reports(
    location_name: str,
    time_filter: Optional[str] = Query("1h"),
    date_filter: Optional[str] = Query("today")
):
    now = datetime.utcnow()
    query = {"location_name": location_name}
    
    # 1. Parse date filter
    if date_filter == "today":
        start_date = now - timedelta(days=1)
    elif date_filter == "yesterday":
        start_date = now - timedelta(days=2)
        end_date = now - timedelta(days=1)
        query["timestamp"] = {"$gte": start_date, "$lt": end_date}
    elif date_filter == "week":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=1)
        
    if date_filter != "yesterday":
        query["timestamp"] = {"$gte": start_date}

    # 2. Parse time filter
    if time_filter == "1h":
        start_time = now - timedelta(hours=1)
    elif time_filter == "6h":
        start_time = now - timedelta(hours=6)
    elif time_filter == "24h":
        start_time = now - timedelta(hours=24)
    elif time_filter == "peak":
        start_time = now - timedelta(hours=24)
    else:
        start_time = now - timedelta(hours=1)

    if date_filter != "yesterday":
        query["timestamp"]["$gte"] = max(query["timestamp"]["$gte"], start_time)

    reports = list(db["traffic_reports"].find(query))
    
    if time_filter == "peak":
        reports = [r for r in reports if r["timestamp"].hour in [8, 9, 10, 17, 18, 19]]

    if not reports:
        return {
            "avg_vehicles": 0,
            "avg_density": 0.0,
            "avg_time_saved": 0.0,
            "avg_co2": 0.0,
            "hourly_profile": [0, 0, 0, 0, 0],
            "recommendations": [],
            "is_live_active": False,
            "reports_count": 0
        }

    total_vehicles = 0
    total_density = 0.0
    total_time_saved = 0.0
    total_co2 = 0.0
    vehicle_classes = {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "bicycle": 0}
    
    for r in reports:
        total_vehicles += r.get("total_vehicles", 0)
        total_density += r.get("density", 0.0)
        total_time_saved += r.get("time_saved", 0.0)
        total_co2 += r.get("co2_saved", 0.0)
        vc = r.get("vehicle_counts", {})
        for k in vehicle_classes:
            vehicle_classes[k] += vc.get(k, 0)
            
    count = len(reports)
    avg_density = total_density / count
    
    recommendations = []
    for r in reports:
        if r.get("recommendations"):
            recommendations.append({
                "location_name": r["location_name"],
                "recommendation": r["recommendations"],
                "density": r["density"],
                "timestamp": r["timestamp"].isoformat()
            })
            
    return {
        "avg_vehicles": int(round(total_vehicles / count)),
        "avg_density": round(avg_density, 1),
        "avg_time_saved": round(total_time_saved / count, 1),
        "avg_co2": round(total_co2 / count, 1),
        "hourly_profile": [
            int(round(vehicle_classes["car"] / count)),
            int(round(vehicle_classes["bus"] / count)),
            int(round(vehicle_classes["truck"] / count)),
            int(round(vehicle_classes["motorcycle"] / count)),
            int(round(vehicle_classes["bicycle"] / count))
        ],
        "recommendations": recommendations,
        "is_live_active": True,
        "reports_count": count
    }
