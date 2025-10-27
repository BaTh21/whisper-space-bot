from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import create, update_status, get_friends, get_pending_requests, is_friend
from app.models.user import User

router = APIRouter()


@router.post("/request/{user_id}")
def send_friend_request(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot add self")
    if is_friend(db, current_user.id, user_id):
        raise HTTPException(400, "Already friends")
    create(db, current_user.id, user_id, "pending")
    return {"msg": "Friend request sent"}


@router.post("/accept/{requester_id}")
def accept_request(
    requester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_status(db, requester_id, current_user.id, "accepted")
    return {"msg": "Friend request accepted"}


@router.get("/", response_model=list[dict])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    friends = get_friends(db, current_user.id)
    return [{"id": f.id, "username": f.username} for f in friends]


@router.get("/requests")
def pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    requests = get_pending_requests(db, current_user.id)
    return [{"id": u.id, "username": u.username} for u in requests]