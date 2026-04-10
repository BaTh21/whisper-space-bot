from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups, avatar, notes, message, activity
import app.models
from app.models.base import Base
from app.core.database import engine
import os
from app.services.websocket_manager import manager

from app.models.user import User
from app.models.message_reaction import MessageReaction
from app.models.private_message import PrivateMessage
from app.models.diary import Diary
from app.models.diary_like import DiaryLike
from app.models.diary_favorite import DiaryFavorite
from app.models.activity import Activity

from app.core.cloudinary import configure_cloudinary
from app.api.v1.routers import system_log

# Create database tables
Base.metadata.create_all(bind=engine)

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
        "https://whisper-space-bot-reactjs.onrender.com",
        "https://whisper-space-two.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
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
app.include_router(activity.router, prefix="/api/v1/activities", tags=["activities"])
app.include_router(system_log.router, prefix="/api/v1", tags=["devices"])

os.makedirs("static/avatars", exist_ok=True)

if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="react-app")