# app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os
import logging
from starlette.middleware.base import BaseHTTPMiddleware

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

# Create database tables
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.models.refresh_token import RefreshToken

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

# ============ CRITICAL CORS FIX ============
# Option 1: Use this for production (more secure)
origins = [
    "https://whisper-space-two.vercel.app",
    "https://whisper-space-bot-reactjs.onrender.com",
    "http://localhost:5173",
    "http://localhost:5174",
]

# Option 2: Or use from settings if configured
if hasattr(settings, 'BACKEND_CORS_ORIGINS') and settings.BACKEND_CORS_ORIGINS:
    origins = settings.BACKEND_CORS_ORIGINS

logger.info(f"CORS Origins: {origins}")

# ============ ADD CUSTOM CORS MIDDLEWARE ============
class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle OPTIONS preflight
        if request.method == "OPTIONS":
            response = JSONResponse(content={})
        else:
            response = await call_next(request)
        
        # Add CORS headers to ALL responses
        origin = request.headers.get("origin")
        
        # Check if origin is in allowed list
        allowed_origin = None
        if origin and origin in origins:
            allowed_origin = origin
        elif origins:
            allowed_origin = origins[0]
        else:
            allowed_origin = "*"
        
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        
        return response

# Add both middlewares for maximum compatibility
app.add_middleware(CustomCORSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
)

# ============ EXPLICIT OPTIONS HANDLER ============
@app.options("/{path:path}")
async def options_handler(request: Request):
    """Handle OPTIONS requests for CORS preflight"""
    origin = request.headers.get("origin", "")
    
    # Check if origin is allowed
    if origin in origins:
        allowed_origin = origin
    else:
        allowed_origin = origins[0] if origins else "*"
    
    return JSONResponse(
        content={"message": "CORS preflight successful"},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",  # 24 hours
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
        "cors_origins": origins,
        "docs": "/docs" if settings.is_development() else None
    }

@app.get("/api/v1/health")
def health_check():
    from datetime import datetime
    import json
    return JSONResponse(
        content={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": settings.ENVIRONMENT,
            "service": "whisper-space-api"
        },
        headers={
            "Access-Control-Allow-Origin": "https://whisper-space-two.vercel.app",
            "Access-Control-Allow-Credentials": "true"
        }
    )

@app.get("/api/v1/cors-test")
async def cors_test(request: Request):
    """Test CORS headers"""
    from datetime import datetime
    origin = request.headers.get("origin", "")
    
    return {
        "message": "CORS test endpoint",
        "timestamp": datetime.utcnow().isoformat(),
        "your_origin": origin,
        "allowed_origins": origins,
        "headers_received": dict(request.headers)
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