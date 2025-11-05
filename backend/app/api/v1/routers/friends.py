from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import create, update_status, get_friends, get_pending_requests, is_friend, get_friend_request, delete, get_blocked_users_list
from app.models.user import User
from app.models.friend import Friend, FriendshipStatus

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
        raise
    except Exception as e:
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
        
        if friend_request.status != FriendshipStatus.pending:
            raise HTTPException(status_code=400, detail="Friend request already processed")
        
        update_status(db, requester_id, current_user.id, "accepted")
        return {"msg": "Friend request accepted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error in accept_request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/unfriend/{friend_id}")
def unfriend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Check if friendship exists
        friendship = get_friend_request(db, current_user.id, friend_id)
        if not friendship:
            raise HTTPException(status_code=404, detail="Friendship not found")
        
        if friendship.status != FriendshipStatus.accepted:
            raise HTTPException(status_code=400, detail="You are not friends with this user")
        
        # Delete the friendship
        delete(db, current_user.id, friend_id)
        return {"msg": "Unfriended successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error in unfriend: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/block/{user_id}")
def block_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot block yourself")
        
        # Check if relationship already exists
        existing = get_friend_request(db, current_user.id, user_id)
        
        if existing:
            # Update existing relationship to blocked
            existing.status = FriendshipStatus.blocked
            db.commit()
        else:
            # Create new blocked relationship
            create(db, current_user.id, user_id, FriendshipStatus.blocked)
        
        return {"msg": "User blocked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error in block_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/unblock/{user_id}")
def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Check if blocked relationship exists
        blocked_relationship = get_friend_request(db, current_user.id, user_id)
        if not blocked_relationship:
            raise HTTPException(status_code=404, detail="User is not blocked")
        
        if blocked_relationship.status != FriendshipStatus.blocked:
            raise HTTPException(status_code=400, detail="User is not blocked")
        
        # Delete the blocked relationship
        delete(db, current_user.id, user_id)
        return {"msg": "User unblocked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error in unblock_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=list[dict])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        friends = get_friends(db, current_user.id)
        return [{
            "id": f.id, 
            "username": f.username, 
            "email": f.email,
            "avatar_url": f.avatar_url,  # ADD THIS LINE
            "is_verified": f.is_verified  # Optional: add if you have this field
        } for f in friends]
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
            "avatar_url": u.avatar_url,  # ADD THIS LINE
            "requester_id": u.id,
            "is_verified": u.is_verified  # Optional: add if you have this field
        } for u in requests]
    except Exception as e:
        print(f"Server error in pending_requests: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/blocked")
def get_blocked_users_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Direct query without using CRUD function
        blocked_users = db.query(User).join(
            Friend, User.id == Friend.friend_id
        ).filter(
            Friend.user_id == current_user.id,
            Friend.status == FriendshipStatus.blocked
        ).all()
        
        return [{
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url  # ADD THIS LINE
        } for user in blocked_users]
        
    except Exception as e:
        print(f"Server error in get_blocked_users_route: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")