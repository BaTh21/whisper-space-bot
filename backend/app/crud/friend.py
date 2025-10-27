from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.friend import Friend, FriendshipStatus
from app.models.user import User


def create(db: Session, user_id: int, friend_id: int, status: str = "pending") -> Friend:
    friendship = Friend(user_id=user_id, friend_id=friend_id, status=FriendshipStatus(status))
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    return friendship


def get_pending(db: Session, requester_id: int, receiver_id: int) -> Optional[Friend]:
    return db.query(Friend).filter(
        Friend.user_id == requester_id,
        Friend.friend_id == receiver_id,
        Friend.status == FriendshipStatus.pending
    ).first()


def update_status(db: Session, user_id: int, friend_id: int, status: str):
    friendship = db.query(Friend).filter(
        ((Friend.user_id == user_id) & (Friend.friend_id == friend_id)) |
        ((Friend.user_id == friend_id) & (Friend.friend_id == user_id))
    ).first()
    if friendship:
        friendship.status = FriendshipStatus(status)
        db.commit()
        db.refresh(friendship)
    return friendship


def delete(db: Session, user_id: int, friend_id: int):
    db.query(Friend).filter(
        ((Friend.user_id == user_id) & (Friend.friend_id == friend_id)) |
        ((Friend.user_id == friend_id) & (Friend.friend_id == user_id))
    ).delete()
    db.commit()


def is_friend(db: Session, user_id: int, friend_id: int) -> bool:
    return db.query(Friend).filter(
        ((Friend.user_id == user_id) & (Friend.friend_id == friend_id)) |
        ((Friend.user_id == friend_id) & (Friend.friend_id == user_id)),
        Friend.status == FriendshipStatus.accepted
    ).first() is not None


def get_friends(db: Session, user_id: int) -> List[User]:
    return db.query(User).join(Friend,
        ((Friend.user_id == user_id) & (Friend.friend_id == User.id)) |
        ((Friend.friend_id == user_id) & (Friend.user_id == User.id))
    ).filter(Friend.status == FriendshipStatus.accepted).all()


def get_pending_requests(db: Session, user_id: int) -> List[User]:
    return db.query(User).join(Friend, Friend.user_id == User.id)\
        .filter(Friend.friend_id == user_id, Friend.status == FriendshipStatus.pending).all()