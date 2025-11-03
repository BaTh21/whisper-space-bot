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


@router.get("/search")
def search_users(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        from sqlalchemy import or_
        
        users = db.query(User).filter(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%")
            ),
            User.id != current_user.id
        ).limit(20).all()
        
        return [{
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url,  # Make sure this is included
            "is_verified": getattr(user, 'is_verified', False)
        } for user in users]
        
    except Exception as e:
        print(f"Server error in search_users: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")