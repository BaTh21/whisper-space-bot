# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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

# ============ CRITICAL CORS FIXES ============
# Log the origins for debugging
logger.info(f"CORS Origins configured: {settings.BACKEND_CORS_ORIGINS}")
logger.info(f"Environment: {settings.ENVIRONMENT}")

# For production, you might need to handle OPTIONS requests explicitly
if settings.is_production():
    # Add specific OPTIONS handler for preflight requests
    @app.middleware("http")
    async def add_cors_headers(request, call_next):
        response = await call_next(request)
        
        # Check if origin is in allowed list
        origin = request.headers.get("origin")
        if origin and origin in settings.BACKEND_CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            # Allow specific origins or use the first one
            response.headers["Access-Control-Allow-Origin"] = settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else "*"
        
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        
        return response

# CORS middleware - FIXED: Add OPTIONS to allowed methods
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # EXPLICITLY include OPTIONS
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],  # EXPLICIT headers
    expose_headers=["*"],  # ADD THIS: Expose headers to browser
    max_age=600,  # Cache preflight requests for 10 minutes
)

# ============ IMPORTANT: Add OPTIONS handler ============
@app.options("/{path:path}")
async def options_handler():
    """Handle all OPTIONS requests for CORS preflight"""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": ", ".join(settings.BACKEND_CORS_ORIGINS) if settings.BACKEND_CORS_ORIGINS else "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "600"
        }
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
        "cors_origins": settings.BACKEND_CORS_ORIGINS,
        "docs": "/docs" if settings.is_development() else None
    }

@app.get("/api/v1/health")
def health_check():
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "service": "whisper-space-api",
        "cors_enabled": True
    }

# Add a CORS test endpoint
@app.get("/api/v1/cors-test")
def cors_test():
    """Test CORS configuration"""
    from datetime import datetime
    return {
        "message": "CORS test successful",
        "timestamp": datetime.utcnow().isoformat(),
        "allowed_origins": settings.BACKEND_CORS_ORIGINS,
        "environment": settings.ENVIRONMENT
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