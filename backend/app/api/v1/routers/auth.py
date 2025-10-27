from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import random
from app.schemas.base import BaseResponse
from app.schemas.auth import Token, UserCreate, UserLogin, VerifyCodeRequest
from app.core.database import get_db
from app.crud.user import get_by_email, create, verify
from app.crud.auth import create_verification_code, delete_code, get_valid_code, get_valid_refresh_token, revoke_refresh_token, store_refresh_token
from app.services.email import send_verification_email
from app.core.security import create_access_token, create_refresh_token, get_current_user, verify_password
from app.schemas.refresh_token import RefreshTokenRequest
from app.models.user import User

router = APIRouter()


@router.post("/refresh", response_model=Token)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    rt = get_valid_refresh_token(db, req.refresh_token)
    if not rt:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    revoke_refresh_token(db, req.refresh_token)
    new_access = create_access_token(rt.user_id)
    new_refresh = create_refresh_token(rt.user_id)
    store_refresh_token(db, rt.user_id, new_refresh)

    return Token(access_token=new_access, refresh_token=new_refresh)


@router.post("/register", response_model=BaseResponse)
async def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if get_by_email(db, user_in.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    user = create(db, user_in)
    code = "".join(random.choices("0123456789", k=6))
    create_verification_code(db, user.id, code)
    await send_verification_email(user_in.email, code)
    return BaseResponse(msg="Verification code sent")


@router.post("/verify-code", response_model=BaseResponse)
def verify_code(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    user = get_by_email(db, req.email)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User not found")

    code_obj = get_valid_code(db, user.id, req.code)
    if not code_obj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")

    verify(db, user.id)
    delete_code(db, code_obj.id)
    return BaseResponse(msg="Email verified")


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = get_by_email(db, form_data.username)  # ← username = email
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email not verified")

    access_token = create_access_token(user.id)
    refresh_token_jwt = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token_jwt)

    return Token(access_token=access_token, refresh_token=refresh_token_jwt)

@router.post("/logout", response_model=BaseResponse)
def logout(
    req: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoke_refresh_token(db, req.refresh_token)
    return BaseResponse(msg="Logged out")