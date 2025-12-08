# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    
    # Email Configuration (SMTP)
    SMTP_ENABLED: bool = True
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: str
    SMTP_PASS: str
    SMTP_FROM: str
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    CLOUDINARY_UPLOAD_FOLDER: str = "whisper_space"
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    
    # CORS - Make it accept ALL origins or specify yours
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://whisper-space-two.vercel.app",
        "https://whisper-space-bot-reactjs.onrender.com"
    ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"
    
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"

# Create settings instance
settings = Settings()

# For production, allow all Vercel domains
if settings.is_production():
    settings.BACKEND_CORS_ORIGINS = [
        "https://whisper-space-two.vercel.app",
        "https://*.vercel.app",
        "https://whisper-space-bot-reactjs.onrender.com",
        "http://localhost:5173",
        "http://localhost:5174"
    ]