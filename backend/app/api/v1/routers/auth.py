# app/api/v1/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
import logging
from datetime import datetime, timedelta

from app.schemas.base import BaseResponse
from app.schemas.auth import Token, UserCreate, UserLogin, VerifyCodeRequest
from app.core.database import get_db
from app.core.security import (
    create_access_token, create_refresh_token, 
    get_current_user, verify_password, hash_password,
    generate_verification_code
)
from app.services.email import email_service
from app.schemas.refresh_token import RefreshTokenRequest

# Import models
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.models.refresh_token import RefreshToken

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/refresh", response_model=Token)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    from app.core.security import verify_token
    
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
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )

@router.post("/register", response_model=dict)
async def register(
    user_in: UserCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user"""
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
    
    # Create new user
    hashed_password = hash_password(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hashed_password,
        is_verified=False
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
    background_tasks.add_task(
        email_service.send_verification_email,
        user_in.email,
        code
    )
    
    # Prepare response
    response_data = {
        "msg": "Verification code sent to your email",
        "user_id": new_user.id,
        "email": new_user.email,
        "username": new_user.username
    }
    
    # In development, include the code for testing
    from app.core.config import settings
    if settings.is_development():
        response_data["verification_code"] = code
        response_data["debug_note"] = "Email simulation in development mode"
    
    logger.info(f"User registered: {new_user.email}, code: {code}")
    
    return response_data

@router.post("/verify-code", response_model=Token)
async def verify_code(
    req: VerifyCodeRequest, 
    db: Session = Depends(get_db)
):
    """Verify email with code"""
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
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user"""
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
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/logout", response_model=BaseResponse)
def logout(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logout user by revoking refresh token"""
    refresh_token_obj = db.query(RefreshToken).filter(
        RefreshToken.token == req.refresh_token,
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False
    ).first()
    
    if refresh_token_obj:
        refresh_token_obj.revoked = True
        db.commit()
    
    logger.info(f"User logged out: {current_user.email}")
    
    return BaseResponse(msg="Logged out successfully")

@router.post("/resend-verification", response_model=BaseResponse)
async def resend_verification(
    email: str, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification code"""
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
    background_tasks.add_task(
        email_service.send_verification_email,
        email,
        code
    )
    
    response_data = {"msg": "Verification code resent"}
    
    # In development, include the code
    from app.core.config import settings
    if settings.is_development():
        response_data["verification_code"] = code
    
    logger.info(f"Verification code resent to: {email}, code: {code}")
    
    return BaseResponse(**response_data)

@router.get("/test-email", response_model=dict)
async def test_email():
    """Test email service (development only)"""
    from app.core.config import settings
    
    if settings.is_production():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available in development mode"
        )
    
    test_email = "test@example.com"
    test_code = generate_verification_code()
    
    try:
        success = await email_service.send_verification_email(test_email, test_code)
        
        return {
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
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "test_code": test_code,
            "environment": settings.ENVIRONMENT
        }