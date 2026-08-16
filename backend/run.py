import uvicorn
import os
import sys

# Add the current directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting AI-powered Smart Traffic Digital Twin Backend Server...")
    print("API documentation will be available at http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
