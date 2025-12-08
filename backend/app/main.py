# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import logging

from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups, avatar, notes, message
from app.models import base
from app.core.database import engine
from app.core.config import settings
from app.api.v1.routers import reactions

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.is_production() else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables - IMPORTANT: Import models BEFORE creating tables
# This ensures all models are registered with SQLAlchemy
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.models.refresh_token import RefreshToken

# Now create tables
try:
    base.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {str(e)}")

app = FastAPI(
    title="Whisper Space API",
    description="Backend API for Whisper Space",
    version="1.0.0",
    docs_url="/docs" if settings.is_development() else None,
    redoc_url="/redoc" if settings.is_development() else None
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
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
app.include_router(reactions.router, prefix="/api/v1", tags=["reactions"])

# Create static directories
os.makedirs("static/avatars", exist_ok=True)

# Serve React build files
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="react-app")

@app.get("/")
def root():
    return {
        "message": "Welcome to Whisper Space API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.is_development() else None
    }

@app.get("/api/v1/health")
def health_check():
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "service": "whisper-space-api"
    }

@app.get("/api/v1/config/email-test")
async def email_test():
    """Test email configuration"""
    from app.services.email import email_service
    from app.core.config import settings
    
    if settings.is_production():
        return {"error": "This endpoint is only available in development"}
    
    result = await email_service.test_connection()
    
    return {
        "email_test": result,
        "environment": settings.ENVIRONMENT,
        "smtp_enabled": settings.SMTP_ENABLED
    }

# Catch-all route for React Router
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve React app for all unmatched routes"""
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return {"message": "Whisper Space API is running"}