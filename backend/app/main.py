from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups, avatar, notes, message
from app.models import base
from app.core.database import engine
import os

from app.core.cloudinary import configure_cloudinary

# Create database tables
base.Base.metadata.create_all(bind=engine)

# Configure Cloudinary
configure_cloudinary()  # ADDED

app = FastAPI(
    title="Whisper Space",
)

# CORS middleware - UPDATED with your React domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "https://whisper-space-bot-reactjs.onrender.com"
        "https://whisper-space-bot.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Include API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(diaries.router, prefix="/api/v1/diaries", tags=["diaries"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["friends"])
app.include_router(websockets.router, prefix="/api/v1/ws", tags=["websockets"])
app.include_router(notes.router, prefix="/api/v1/notes", tags=["notes"])
app.include_router(avatar.router, prefix="/api/v1/avatars", tags=["avatars"])
app.include_router(message.router, prefix="/api/v1/messages", tags=["messages"])

# Create static directories
os.makedirs("static/avatars", exist_ok=True)

# Serve React build files (if you're serving both from same domain)
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="react-app")

# Catch-all route for React Router
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve React app for all unmatched routes"""
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return {"message": "React app not built"}

@app.get("/")
def root():
    return {"message": "Whisper Space API"}

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "message": "Whisper Space API is running"}