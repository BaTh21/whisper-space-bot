from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.user import search, update
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.from_orm(current_user)


@router.put("/me", response_model=UserOut)
def update_me(
    user_in: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    updated = update(db, current_user, user_in)
    return UserOut.from_orm(updated)


@router.get("/search", response_model=List[UserOut])
def search_users(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if len(q.strip()) < 2:
        raise HTTPException(400, "Query too short")
    
    users = search(db, q.strip())  # ← no exclude
    return [UserOut.from_orm(u) for u in users]