
from datetime import datetime
import os
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import random
from app.schemas.base import BaseResponse
from app.schemas.auth import Token, UserCreate, UserLogin, VerifyCodeRequest
from app.core.database import get_db
from app.crud.user import get_by_email, create, verify
from app.crud.auth import create_verification_code, delete_code, get_valid_code, get_valid_refresh_token, revoke_refresh_token, store_refresh_token
from app.services.email import send_verification_email, send_verification_email_sync
from app.core.security import create_access_token, create_refresh_token, get_current_user, verify_password, hash_password
from app.schemas.refresh_token import RefreshTokenRequest
from app.models.user import User
from app.core.config import settings

router = APIRouter()

@router.post("/refresh", response_model=Token)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    rt = get_valid_refresh_token(db, req.refresh_token)
    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid or expired refresh token"
        )

    revoke_refresh_token(db, req.refresh_token)
    new_access = create_access_token(rt.user_id)
    new_refresh = create_refresh_token(rt.user_id)
    store_refresh_token(db, rt.user_id, new_refresh)

    return Token(
        access_token=new_access, 
        refresh_token=new_refresh,
        token_type="bearer"
    )

@router.post("/register", response_model=BaseResponse)
async def register(
    user_in: UserCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
):
    # Check existing users
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Email already registered"
        )
    
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Username already taken"
        )
    
    # Generate 6-digit code
    code = "".join(random.choices("0123456789", k=6))
    
    # Create user
    new_user = create(db, user_in)
    
    # Store verification code
    create_verification_code(db, new_user.id, code)
    # Try to send email
    email_sent = False
    try:
        email_sent = send_verification_email_sync(user_in.email, code)
        print(f"📧 Email send attempt: {'✅ SUCCESS' if email_sent else '❌ FAILED'}")
    except Exception as e:
        print(f"❌ Email error: {e}")
        # Still try background task
        background_tasks.add_task(send_verification_email_sync, user_in.email, code)
    
    # Write to log file (platform independent)
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "email_debug.log")
    
    if email_sent:
        return BaseResponse(
            success=True,
            msg="Verification email sent! Please check your inbox.",
            data={"email": user_in.email}
        )
    else:
        return BaseResponse(
            success=True,
            msg="Registration complete! Check your email for verification code.",
            data={"email": user_in.email}
        )

@router.post("/verify-code", response_model=Token)
def verify_code(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    user = get_by_email(db, req.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User not found"
        )

    code_obj = get_valid_code(db, user.id, req.code)
    if not code_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid or expired code"
        )

    verify(db, user.id)
    delete_code(db, code_obj.id)
    
    access_token = create_access_token(user.id)
    refresh_token_jwt = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token_jwt)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_jwt,
        token_type="bearer"
    )

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = get_by_email(db, form_data.username)
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
            detail="Email not verified"
        )

    access_token = create_access_token(user.id)
    refresh_token_jwt = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token_jwt)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_jwt,
        token_type="bearer"
    )

@router.post("/logout", response_model=BaseResponse)
def logout(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoke_refresh_token(db, req.refresh_token)
    return BaseResponse(msg="Logged out")

@router.post("/resend-verification", response_model=BaseResponse)
async def resend_verification(email: str, db: Session = Depends(get_db)):
    """
    Resend verification code to user's email
    """
    user = get_by_email(db, email)
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
    code = "".join(random.choices("0123456789", k=6))
    
    # Delete any existing codes and create new one
    # (You might need to implement delete_user_codes function)
    create_verification_code(db, user.id, code)
    
    # Send verification email
    email_sent = await send_verification_email(email, code)
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )
    
    return BaseResponse(msg="Verification code sent")

