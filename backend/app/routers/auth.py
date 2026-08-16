from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta
import jwt
from typing import Optional

from ..models import UserSignup, UserLogin, TokenResponse
from ..database import db, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = "SMART_TRAFFIC_DIGITAL_TWIN_SECRET_KEY_9988"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600 # 10 hours for testing convenience

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        assigned_location: Optional[str] = payload.get("assigned_location")
        if username is None:
            raise credentials_exception
        return {"username": username, "role": role, "assigned_location": assigned_location}
    except jwt.PyJWTError:
        raise credentials_exception

@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserSignup):
    # Check if username exists
    existing_user = db["users"].find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    existing_email = db["users"].find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    hashed_pwd = hash_password(user_data.password)
    
    assigned_loc = user_data.assigned_location
    if assigned_loc and assigned_loc.strip().lower() == "sitapur":
        assigned_loc = "Sitapur Junction"

    new_user = {
        "username": user_data.username,
        "password": hashed_pwd,
        "email": user_data.email,
        "phone": user_data.phone,
        "role": user_data.role,
        "assigned_location": assigned_loc
    }
    
    db["users"].insert_one(new_user)

    # Automatically create the custom location in the DB for the Admin
    if user_data.role == "admin" and assigned_loc:
        loc_name = assigned_loc.strip()
        existing_loc = db["locations"].find_one({"name": loc_name})
        if not existing_loc:
            import random
            lat = round(28.6 + random.uniform(-0.08, 0.08), 4)
            lng = round(77.2 + random.uniform(-0.08, 0.08), 4)
            
            # Use real geographical coordinates for common registered demo cities
            loc_name_lower = loc_name.lower()
            if "sitapur" in loc_name_lower:
                lat = 27.5785
                lng = 80.6586
            elif "ghaziyabad" in loc_name_lower or "ghaziabad" in loc_name_lower:
                lat = 28.6692
                lng = 77.4538
            elif "noida" in loc_name_lower:
                lat = 28.5708
                lng = 77.3258
            
            new_loc = {
                "name": loc_name,
                "latitude": lat,
                "longitude": lng,
                "traffic_status": "Low",
                "manual_override": False,
                "red_time": 30,
                "green_time": 30,
                "yellow_time": 5,
                "current_density": 0.0,
                "vehicle_counts": {
                    "car": 0,
                    "bus": 0,
                    "truck": 0,
                    "motorcycle": 0,
                    "bicycle": 0
                },
                "is_video_data": False,
                "updated_at": datetime.utcnow()
            }
            db["locations"].insert_one(new_loc)
            print(f"Auto-created location '{loc_name}' during Admin sign-up.")
    
    # Generate token
    token_data = {
        "sub": user_data.username,
        "role": user_data.role,
        "assigned_location": user_data.assigned_location
    }
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user_data.role,
        "username": user_data.username,
        "assigned_location": user_data.assigned_location
    }

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin):
    user = db["users"].find_one({"username": login_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not verify_password(login_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Generate token
    token_data = {
        "sub": user["username"],
        "role": user["role"],
        "assigned_location": user.get("assigned_location")
    }
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
        "assigned_location": user.get("assigned_location")
    }

@router.get("/profile")
def get_profile(current_user = Depends(get_current_user)):
    username = current_user["username"]
    user = db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user["username"],
        "email": user.get("email", ""),
        "role": user["role"],
        "assigned_location": user.get("assigned_location", ""),
        "full_name": user.get("full_name", user["username"]),
        "phone": user.get("phone", "+91 98765 43210"),
        "rank": user.get("rank", "Orchestration Officer"),
        "badge_number": user.get("badge_number", "POL-84920"),
        "profile_pic": user.get("profile_pic", "")
    }

@router.put("/update-profile")
def update_profile(request: dict, current_user = Depends(get_current_user)):
    username = current_user["username"]
    
    email = request.get("email")
    full_name = request.get("full_name")
    phone = request.get("phone")
    rank = request.get("rank")
    badge_number = request.get("badge_number")
    profile_pic = request.get("profile_pic")
    
    update_data = {}
    if email is not None: update_data["email"] = email
    if full_name is not None: update_data["full_name"] = full_name
    if phone is not None: update_data["phone"] = phone
    if rank is not None: update_data["rank"] = rank
    if badge_number is not None: update_data["badge_number"] = badge_number
    if profile_pic is not None: update_data["profile_pic"] = profile_pic
    
    if update_data:
        db["users"].update_one({"username": username}, {"$set": update_data})
        
    return {"status": "success", "message": "Profile updated successfully"}

@router.get("/verify-badge/{username}")
def verify_badge(username: str):
    user = db["users"].find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="Officer profile not found")
    return {
        "full_name": user.get("full_name", user["username"]),
        "rank": user.get("rank", "Traffic Control Officer"),
        "badge_number": user.get("badge_number", "POL-84920"),
        "assigned_location": user.get("assigned_location", "Sitapur Junction"),
        "profile_pic": user.get("profile_pic", ""),
        "status": "Verified Active"
    }

@router.post("/forgot-password")
def forgot_password(request: dict):
    username = request.get("username")
    email = request.get("email")
    badge_number = request.get("badge_number")
    new_password = request.get("new_password")
    
    if not all([username, email, badge_number, new_password]):
        raise HTTPException(status_code=400, detail="All fields (Username, Email, Badge ID, New Password) are required")
        
    user = db["users"].find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="Officer identity not found in database records")
        
    db_email = user.get("email", "").strip().lower()
    db_badge = user.get("badge_number", "").strip().upper()
    
    provided_email = email.strip().lower()
    provided_badge = badge_number.strip().upper()
    
    if db_email != provided_email:
        raise HTTPException(status_code=400, detail="Identity verification failed: Email mismatch")
        
    expected_badge = db_badge if db_badge else "POL-84920"
    if expected_badge != provided_badge:
        raise HTTPException(status_code=400, detail="Identity verification failed: Badge Number mismatch")
        
    hashed_pwd = hash_password(new_password)
    db["users"].update_one({"_id": user["_id"]}, {"$set": {"password": hashed_pwd}})
    
    return {"status": "success", "message": "Password reset successfully. Please log in."}
