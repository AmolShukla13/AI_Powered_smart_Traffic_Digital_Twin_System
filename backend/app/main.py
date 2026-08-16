from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, admin, traffic

app = FastAPI(
    title="AI-powered Smart Traffic Digital Twin API",
    description="Backend services for managing real-time AI and manual traffic control systems.",
    version="1.0.0"
)

# Enable CORS for specific React frontend origins
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://smart-traffic-frontend-9ukb.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers (dual-mount for legacy fetch calls and centralized /api client support)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(traffic.router)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(traffic.router, prefix="/api")

@app.on_event("startup")
def startup_event():
    from .database import seed_database
    seed_database()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the AI-powered Smart Traffic Digital Twin API Service!",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
