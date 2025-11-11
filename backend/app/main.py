from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # Add this import
from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups, avatar, notes, message
from app.models import base
from app.core.database import engine
import os

# Create database tables
base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Whisper Space",
)

# CORS middleware - fixed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files - uncommented and fixed
# app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers with proper prefixes - FIXED DUPLICATES
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(diaries.router, prefix="/api/v1/diaries", tags=["diaries"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])  # Only once!
app.include_router(friends.router, prefix="/api/v1/friends", tags=["friends"])
app.include_router(websockets.router, prefix="/api/v1/ws", tags=["websockets"])  # Added /ws prefix
app.include_router(notes.router, prefix="/api/v1/notes", tags=["notes"])  # Fixed prefix
app.include_router(avatar.router, prefix="/api/v1/avatars", tags=["avatars"])  # Added proper prefix
app.include_router(message.router, prefix="/api/v1/messages", tags=["messages"])

# Create static directories
os.makedirs("static/avatars", exist_ok=True)

@app.get("/")
def root():
    return {"message": "Whisper Space API"}

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "message": "Whisper Space API is running"}