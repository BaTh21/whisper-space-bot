import traceback
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.user import UserOut, UserUpdate, AvatarUploadResponse
from app.crud.user import remove_avatar, search, update, get_friend_suggestions, update_avatar
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.core.cloudinary import delete_from_cloudinary, extract_public_id_from_url, upload_to_cloudinary

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


@router.get("/search", response_model=List[dict])
def search_users(
    q: str = Query(..., min_length=2, description="Search query for users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if len(q) < 2:
            return []
            
        users = db.query(User).filter(
            (User.username.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%"))
        ).limit(10).all()
        
        results = []
        for user in users:
            user_data = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "avatar_url": user.avatar_url
            }
            results.append(user_data)
        
        return results
        
    except Exception as e:
        print(f"❌ Error searching users: {str(e)}")
        import traceback
        traceback.print_exc()
        return []
    
@router.get("/suggestions", response_model=list[UserOut])
def friend_suggestions(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_friend_suggestions(db, current_user.id, limit)

@router.post("/save-player-id/{player_id}")
def save_player_id(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.onesignal_player_id == player_id:
        return {"msg": "Player ID already saved"}

    current_user.onesignal_player_id = player_id
    db.commit()

    return {"msg": "Player ID saved"}

@router.delete("/remove-player-id")
def remove_player_id(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.onesignal_player_id:
        return {"msg": "No player ID to remove"}

    current_user.onesignal_player_id = None
    db.commit()

    return {"msg": "Notifications disabled"}


