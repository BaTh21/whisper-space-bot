# app/api/v1/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from app.schemas.base import BaseResponse
from app.schemas.auth import Token, UserCreate, UserLogin, VerifyCodeRequest
from app.core.database import get_db
from app.core.security import (
    create_access_token, create_refresh_token, 
    get_current_user, verify_password, hash_password,
    generate_verification_code, verify_token
)
from app.services.email import email_service
from app.schemas.refresh_token import RefreshTokenRequest
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.models.refresh_token import RefreshToken

router = APIRouter()
logger = logging.getLogger(__name__)

def add_cors_headers(response: JSONResponse) -> JSONResponse:
    """Add CORS headers to response"""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With"
    return response

@router.post("/refresh", response_model=Token)
def refresh_token(
    req: RefreshTokenRequest, 
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    try:
        payload = verify_token(req.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid or expired refresh token"
            )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token type"
            )
        
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token payload"
            )
        
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid user ID"
            )
        
        # Find the refresh token in database
        refresh_token_obj = db.query(RefreshToken).filter(
            RefreshToken.token == req.refresh_token,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.utcnow()
        ).first()
        
        if not refresh_token_obj:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid or expired refresh token"
            )
        
        # Revoke old refresh token
        refresh_token_obj.revoked = True
        db.commit()
        
        # Create new tokens
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="User not found"
            )
        
        new_access_token = create_access_token(user.id)
        new_refresh_token = create_refresh_token(user.id)
        
        # Store new refresh token
        new_refresh_token_obj = RefreshToken(
            user_id=user.id,
            token=new_refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        db.add(new_refresh_token_obj)
        db.commit()
        
        response_data = Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
        return add_cors_headers(JSONResponse(content=response_data.dict()))
        
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    try:
        # Check if user already exists
        user_by_email = db.query(User).filter(User.email == user_in.email).first()
        if user_by_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="Email already registered"
            )
        
        user_by_username = db.query(User).filter(User.username == user_in.username).first()
        if user_by_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="Username already registered"
            )
        
        # Validate password strength
        if len(user_in.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long"
            )
        
        # Validate username
        if len(user_in.username) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters long"
            )
        
        # Create new user
        hashed_password = hash_password(user_in.password)
        new_user = User(
            username=user_in.username,
            email=user_in.email,
            password_hash=hashed_password,
            is_verified=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Generate verification code
        code = generate_verification_code()
        
        # Store verification code
        verification_code = VerificationCode(
            user_id=new_user.id,
            code=code,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        
        db.add(verification_code)
        db.commit()
        
        # Send verification email in background
        try:
            background_tasks.add_task(
                email_service.send_verification_email,
                user_in.email,
                code
            )
            email_sent = True
            email_status = "Verification email sent"
        except Exception as e:
            logger.error(f"Failed to schedule email: {str(e)}")
            email_sent = False
            email_status = "Email scheduling failed - check server logs"
        
        # Prepare response
        from app.core.config import settings
        
        response_data = {
            "success": True,
            "message": "Registration successful. Please check your email for verification code.",
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "username": new_user.username,
                "is_verified": new_user.is_verified,
                "created_at": new_user.created_at.isoformat() if new_user.created_at else None
            },
            "email_status": email_status,
            "verification_required": True
        }
        
        # In development, include the code for testing
        if settings.is_development():
            response_data["verification_code"] = code
            response_data["debug_note"] = "Email simulation in development mode"
            response_data["email_sent"] = email_sent
        
        logger.info(f"User registered successfully: {new_user.email}, User ID: {new_user.id}")
        
        # Return JSONResponse with CORS headers
        return JSONResponse(
            content=response_data,
            status_code=status.HTTP_201_CREATED,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Expose-Headers": "Content-Length, X-JSON"
            }
        )
        
    except HTTPException as e:
        # Re-raise HTTP exceptions with CORS headers
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.post("/verify-code", response_model=Token)
async def verify_code(
    req: VerifyCodeRequest, 
    db: Session = Depends(get_db)
):
    """Verify email with code"""
    try:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="User not found"
            )
        
        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Email already verified"
            )
        
        # Find valid verification code
        current_time = datetime.utcnow()
        code_obj = db.query(VerificationCode).filter(
            VerificationCode.user_id == user.id,
            VerificationCode.code == req.code,
            VerificationCode.is_used == False,
            VerificationCode.expires_at > current_time
        ).first()
        
        if not code_obj:
            # Check if code exists but expired
            expired_code = db.query(VerificationCode).filter(
                VerificationCode.user_id == user.id,
                VerificationCode.code == req.code,
                VerificationCode.expires_at <= current_time
            ).first()
            
            if expired_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Verification code has expired"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Invalid verification code"
                )
        
        # Mark code as used
        code_obj.is_used = True
        
        # Verify user
        user.is_verified = True
        user.updated_at = datetime.utcnow()
        
        # Create tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        # Store refresh token
        refresh_token_obj = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        
        db.add(refresh_token_obj)
        db.commit()
        
        logger.info(f"Email verified for user: {user.email}")
        
        response_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
        return add_cors_headers(JSONResponse(content=response_data.dict()))
        
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user"""
    try:
        # Try to find user by email or username
        user = db.query(User).filter(
            (User.email == form_data.username) | (User.username == form_data.username)
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify your email first."
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated"
            )
        
        # Create tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        # Store refresh token
        refresh_token_obj = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        
        db.add(refresh_token_obj)
        db.commit()
        
        # Update last activity
        user.last_activity = datetime.utcnow()
        db.commit()
        
        logger.info(f"User logged in: {user.email}")
        
        response_data = Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
        return add_cors_headers(JSONResponse(content=response_data.dict()))
        
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.post("/logout", response_model=BaseResponse)
def logout(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logout user by revoking refresh token"""
    try:
        refresh_token_obj = db.query(RefreshToken).filter(
            RefreshToken.token == req.refresh_token,
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked == False
        ).first()
        
        if refresh_token_obj:
            refresh_token_obj.revoked = True
            db.commit()
        
        logger.info(f"User logged out: {current_user.email}")
        
        response_data = BaseResponse(msg="Logged out successfully")
        return add_cors_headers(JSONResponse(content=response_data.dict()))
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.post("/resend-verification", response_model=BaseResponse)
async def resend_verification(
    email: str, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification code"""
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found"
            )
        
        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )
        
        # Generate new verification code
        code = generate_verification_code()
        
        # Invalidate old codes
        db.query(VerificationCode).filter(
            VerificationCode.user_id == user.id,
            VerificationCode.is_used == False
        ).update({"is_used": True})
        db.commit()
        
        # Create new verification code
        verification_code = VerificationCode(
            user_id=user.id,
            code=code,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        
        db.add(verification_code)
        db.commit()
        
        # Send verification email in background
        try:
            background_tasks.add_task(
                email_service.send_verification_email,
                email,
                code
            )
            email_sent = True
        except Exception as e:
            logger.error(f"Failed to schedule email: {str(e)}")
            email_sent = False
        
        response_data = {"msg": "Verification code resent"}
        
        # In development, include the code
        from app.core.config import settings
        if settings.is_development():
            response_data["verification_code"] = code
            response_data["email_sent"] = email_sent
        
        logger.info(f"Verification code resent to: {email}")
        
        return add_cors_headers(JSONResponse(content=response_data))
        
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@router.get("/test-email", response_model=dict)
async def test_email():
    """Test email service (development only)"""
    from app.core.config import settings
    
    if settings.is_production():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available in development mode",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    
    test_email = "test@example.com"
    test_code = generate_verification_code()
    
    try:
        success = await email_service.send_verification_email(test_email, test_code)
        
        response_data = {
            "success": success,
            "test_email": test_email,
            "test_code": test_code,
            "environment": settings.ENVIRONMENT,
            "smtp_enabled": settings.SMTP_ENABLED,
            "email_config": {
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "user": settings.SMTP_USER,
                "from": settings.SMTP_FROM,
                "has_password": bool(settings.SMTP_PASS)
            }
        }
        
        return add_cors_headers(JSONResponse(content=response_data))
    except Exception as e:
        response_data = {
            "success": False,
            "error": str(e),
            "test_code": test_code,
            "environment": settings.ENVIRONMENT
        }
        return add_cors_headers(JSONResponse(content=response_data))

@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    try:
        response_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "is_verified": current_user.is_verified,
            "is_active": current_user.is_active,
            "avatar_url": current_user.avatar_url,
            "bio": current_user.bio,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_seen": current_user.last_seen.isoformat() if current_user.last_seen else None
        }
        
        return add_cors_headers(JSONResponse(content=response_data))
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            }
        )

# OPTIONS handler for CORS preflight
@router.options("/{path:path}")
async def options_handler():
    """Handle OPTIONS requests for CORS preflight"""
    return JSONResponse(
        content={"message": "CORS preflight successful"},
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400"
        }
    )