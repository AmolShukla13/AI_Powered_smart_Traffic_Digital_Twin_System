from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime

from ..models import LocationCreate, LocationResponse, TrafficOverride
from ..database import db
from .auth import get_current_user
from ..services.yolo_service import get_traffic_status_from_density

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

def check_admin_role(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin role required."
        )
    return current_user

@router.post("/locations", response_model=LocationResponse)
def create_location(location: LocationCreate, current_user = Depends(check_admin_role)):
    # Check if location already exists
    existing = db["locations"].find_one({"name": location.name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location name already exists."
        )
    
    new_loc = {
        "name": location.name,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "traffic_status": location.traffic_status,
        "manual_override": location.manual_override,
        "red_time": location.red_time,
        "green_time": location.green_time,
        "yellow_time": location.yellow_time,
        "current_density": 0.0,
        "vehicle_counts": {
            "car": 0,
            "bus": 0,
            "truck": 0,
            "motorcycle": 0,
            "bicycle": 0
        },
        "updated_at": datetime.utcnow()
    }
    
    res = db["locations"].insert_one(new_loc)
    new_loc["id"] = str(res.inserted_id)
    return new_loc

@router.put("/locations/{location_name}/override", response_model=LocationResponse)
def override_traffic_settings(location_name: str, override: TrafficOverride, current_user = Depends(check_admin_role)):
    loc = db["locations"].find_one({"name": location_name})
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found."
        )
    
    # Check if admin is assigned to this specific location
    # If the admin's assigned_location is set and doesn't match this location, they cannot override it.
    if current_user.get("assigned_location") and current_user["assigned_location"] != location_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are only authorized to manage traffic at '{current_user['assigned_location']}'."
        )

    update_fields = {
        "updated_at": datetime.utcnow()
    }
    
    if override.manual_override is not None:
        update_fields["manual_override"] = override.manual_override
    
    if override.current_density is not None:
        update_fields["current_density"] = override.current_density
        # Set status based on actual density using the standardized helper function
        update_fields["traffic_status"] = get_traffic_status_from_density(override.current_density)
        update_fields["is_video_data"] = True
    elif override.traffic_status is not None:
        update_fields["traffic_status"] = override.traffic_status
        density_map = {"Low": 15.0, "Medium": 45.0, "Heavy": 75.0, "Gridlock": 95.0}
        update_fields["current_density"] = density_map.get(override.traffic_status, 0.0)
        
    if override.vehicle_counts is not None:
        update_fields["vehicle_counts"] = {
            "car": override.vehicle_counts.car,
            "bus": override.vehicle_counts.bus,
            "truck": override.vehicle_counts.truck,
            "motorcycle": override.vehicle_counts.motorcycle,
            "bicycle": override.vehicle_counts.bicycle
        }

    if override.red_time is not None:
        update_fields["red_time"] = override.red_time
    if override.green_time is not None:
        update_fields["green_time"] = override.green_time
    if override.yellow_time is not None:
        update_fields["yellow_time"] = override.yellow_time
    if override.is_video_data is not None:
        update_fields["is_video_data"] = override.is_video_data
    if override.predicted_weather is not None:
        update_fields["predicted_weather"] = override.predicted_weather

    db["locations"].update_one({"name": location_name}, {"$set": update_fields})
    
    updated_loc = db["locations"].find_one({"name": location_name})
    updated_loc["id"] = str(updated_loc["_id"])
    return updated_loc

@router.get("/admins/status")
def get_admin_status(current_user = Depends(check_admin_role)):
    """
    Get a summary of admin details and assignments.
    """
    locations_count = db["locations"].count_documents({})
    users_count = db["users"].count_documents({})
    admins_count = db["users"].count_documents({"role": {"$regex": "^admin$", "$options": "i"}})
    
    return {
        "admin_username": current_user["username"],
        "assigned_location": current_user.get("assigned_location"),
        "total_locations": locations_count,
        "total_users": users_count,
        "total_admins": admins_count
    }

from bson import ObjectId

@router.put("/emergencies/{emergency_id}/route")
def route_emergency(emergency_id: str, route: List[str], current_user = Depends(check_admin_role)):
    try:
        oid = ObjectId(emergency_id)
    except Exception:
        # Fallback to string search if in mock mode and ID is a simple string
        oid = emergency_id
        
    res = db["emergency_requests"].find_one({"_id": oid})
    if not res:
        raise HTTPException(status_code=404, detail="Emergency request not found")
        
    db["emergency_requests"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "Routed",
                "route": route,
                "updated_at": datetime.utcnow()
            }
        }
    )
    return {"status": "success", "message": f"Emergency request routed successfully"}

@router.put("/emergencies/{emergency_id}/clear")
def clear_emergency(emergency_id: str, current_user = Depends(check_admin_role)):
    try:
        oid = ObjectId(emergency_id)
    except Exception:
        oid = emergency_id
        
    res = db["emergency_requests"].find_one({"_id": oid})
    if not res:
        raise HTTPException(status_code=404, detail="Emergency request not found")
        
    db["emergency_requests"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "Cleared",
                "updated_at": datetime.utcnow()
            }
        }
    )
    return {"status": "success", "message": "Emergency request cleared successfully"}

@router.get("/directory")
def get_officer_directory():
    """
    Get a list of all registered administrative police officers.
    """
    users = db["users"].find({"role": {"$regex": "^admin$", "$options": "i"}})
    directory = []
    for u in users:
        directory.append({
            "username": u["username"],
            "email": u.get("email", "n/a"),
            "assigned_location": u.get("assigned_location") or "Global Admin"
        })
    return directory
