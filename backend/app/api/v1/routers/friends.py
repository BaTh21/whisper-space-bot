from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import create, update_status, get_friends, get_pending_requests, is_friend, get_friend_request
from app.models.user import User
from app.models.friend import FriendshipStatus  # Add this import

router = APIRouter()


@router.post("/request/{user_id}")
def send_friend_request(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Check if trying to add self
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
        
        # Check if already friends
        if is_friend(db, current_user.id, user_id):
            raise HTTPException(status_code=400, detail="Already friends")
        
        # Check if friend request already exists in either direction
        existing_request = get_friend_request(db, current_user.id, user_id)
        if existing_request:
            # FIXED: Compare with enum value, not string
            if existing_request.status == FriendshipStatus.pending:
                if existing_request.user_id == current_user.id:
                    raise HTTPException(status_code=409, detail="Friend request already sent")
                else:
                    raise HTTPException(status_code=409, detail="This user already sent you a friend request")
            elif existing_request.status == FriendshipStatus.accepted:
                raise HTTPException(status_code=400, detail="Already friends")
            elif existing_request.status == FriendshipStatus.blocked:
                raise HTTPException(status_code=400, detail="This friendship is blocked")
        
        # Create new friend request
        create(db, current_user.id, user_id, "pending")
        return {"msg": "Friend request sent successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the actual error for debugging
        print(f"Server error in send_friend_request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/accept/{requester_id}")
def accept_request(
    requester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Check if the friend request exists and is pending
        friend_request = get_friend_request(db, requester_id, current_user.id)
        if not friend_request:
            raise HTTPException(status_code=404, detail="Friend request not found")
        
        # FIXED: Compare with enum value
        if friend_request.status != FriendshipStatus.pending:
            raise HTTPException(status_code=400, detail="Friend request already processed")
        
        # FIXED: Use enum value
        update_status(db, requester_id, current_user.id, "accepted")
        return {"msg": "Friend request accepted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error in accept_request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/", response_model=list[dict])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        friends = get_friends(db, current_user.id)
        return [{"id": f.id, "username": f.username, "email": f.email} for f in friends]
    except Exception as e:
        print(f"Server error in list_friends: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/requests")
def pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        requests = get_pending_requests(db, current_user.id)
        return [{
            "id": u.id, 
            "username": u.username, 
            "email": u.email,
            "requester_id": u.id  # Since these are the users who sent requests
        } for u in requests]
    except Exception as e:
        print(f"Server error in pending_requests: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")