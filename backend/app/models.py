from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from datetime import datetime

class UserSignup(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: str
    phone: Optional[str] = None
    role: str = "user"  # "admin" or "user"
    assigned_location: Optional[str] = None  # Admins can be assigned to a location name

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    assigned_location: Optional[str] = None

class VehicleCounts(BaseModel):
    car: int = 0
    bus: int = 0
    truck: int = 0
    motorcycle: int = 0
    bicycle: int = 0

class LocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    traffic_status: str = "Low"  # Low, Medium, Heavy, Gridlock
    manual_override: bool = False
    red_time: int = 30
    green_time: int = 30
    yellow_time: int = 5

class LocationResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    traffic_status: str
    manual_override: bool
    red_time: int
    green_time: int
    yellow_time: int
    current_density: float  # Percentage or density score (0 to 100)
    vehicle_counts: VehicleCounts
    updated_at: datetime
    is_video_data: Optional[bool] = False
    predicted_weather: Optional[str] = "Clear"
    has_admin: Optional[bool] = False

class TrafficOverride(BaseModel):
    manual_override: Optional[bool] = None
    traffic_status: Optional[str] = None
    red_time: Optional[int] = None
    green_time: Optional[int] = None
    yellow_time: Optional[int] = None
    current_density: Optional[float] = None
    vehicle_counts: Optional[VehicleCounts] = None
    is_video_data: Optional[bool] = None
    predicted_weather: Optional[str] = None

class AccidentPredictionReport(BaseModel):
    location_name: str
    probability: float  # 0.0 to 1.0
    risk_level: str  # Low, Medium, High, Critical
    contributing_factors: List[str]
    safety_suggestions: List[str]
    timestamp: datetime

class EmergencyCreate(BaseModel):
    type: str  # Ambulance, Fire, Police
    start_location: str
    destination_location: str

class EmergencyResponse(BaseModel):
    id: str
    type: str
    start_location: str
    destination_location: str
    status: str  # Pending, Routed, Cleared
    route: Optional[List[str]] = None
    created_at: datetime

