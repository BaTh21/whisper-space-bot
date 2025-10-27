from sqlalchemy.orm import Session
from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from typing import List


def create_private_message(db: Session, sender_id: int, receiver_id: int, content: str, msg_type: str = "text") -> PrivateMessage:
    msg = PrivateMessage(
        sender_id=sender_id, 
        receiver_id=receiver_id, 
        content=content, 
        message_type=MessageType(msg_type)
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_private_messages(db: Session, user_id: int, friend_id: int, limit: int = 50, offset: int = 0) -> List[PrivateMessage]:
    return db.query(PrivateMessage).filter(
        ((PrivateMessage.sender_id == user_id) & (PrivateMessage.receiver_id == friend_id)) |
        ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == user_id))
    ).order_by(PrivateMessage.created_at.desc()).offset(offset).limit(limit).all()


def create_group_message(
    db: Session, 
    sender_id: int, 
    group_id: int, 
    content: str, 
    msg_type: str = "text"
) -> GroupMessage:
    msg = GroupMessage(
        sender_id=sender_id, 
        group_id=group_id, 
        content=content, 
        message_type=MessageType(msg_type)
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_group_messages(
    db: Session, 
    group_id: int, 
    limit: int = 50, 
    offset: int = 0
) -> List[GroupMessage]:
    return db.query(GroupMessage).filter(GroupMessage.group_id == group_id)\
        .order_by(GroupMessage.created_at.desc()).offset(offset).limit(limit).all()