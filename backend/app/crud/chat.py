from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from app.models.group_member import GroupMember
from typing import List
from datetime import datetime, timezone
from fastapi import HTTPException,status
from app.models.user_message_status import UserMessageStatus

from fastapi import HTTPException
from app.schemas.chat import MessageCreate

from app.models.user_message_status import UserMessageStatus

def is_group_member(db: Session, group_id: int, user_id: int) -> bool:
    return db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first() is not None

def create_private_message(
    db: Session,
    sender_id: int,
    receiver_id: int,
    content: str,
    msg_type: str = "text",
    reply_to_id: int | None = None,
    is_forwarded: bool = False,
    original_sender: str | None = None
) -> PrivateMessage:

    msg = PrivateMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        message_type=MessageType(msg_type),
        reply_to_id=reply_to_id,
        is_forwarded=is_forwarded,
        original_sender=original_sender,
        created_at=datetime.now(timezone.utc),
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
) -> GroupMessage:
    
    msg = GroupMessage(
        sender_id=sender_id, 
        group_id=group_id, 
        content=content, 
        created_at=datetime.utcnow()
    )
    try:
        db.add(msg)
        db.commit()
        db.refresh(msg)
        print(f"[DB] Message saved: {msg.id}")
        
    except Exception as e:
        db.rollback()
        print(f"[DB Error] Failed to save message: {e}")
    
    return msg

def get_group_messages(
    db: Session, 
    group_id: int, 
    limit: int = 50, 
    offset: int = 0
) -> List[GroupMessage]:
    return db.query(GroupMessage).filter(GroupMessage.group_id == group_id)\
        .order_by(GroupMessage.created_at.desc()).offset(offset).limit(limit).all()
        
def edit_private_message(db: Session, message_id: int, user_id: int, new_content: str) -> PrivateMessage:
    msg = db.query(PrivateMessage).filter(
        PrivateMessage.id == message_id,
        PrivateMessage.sender_id == user_id,
    ).first()
    if not msg:
        raise HTTPException(404, "Message not found")
    msg.content = new_content
    msg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    return msg

def delete_message_for_user(db: Session, message_id: int, user_id: int):
    status = UserMessageStatus(user_id=user_id, message_id=message_id, is_deleted=True)
    db.merge(status)
    db.commit()
    
def delete_message_forever(db: Session, message_id: int, user_id: int):
    msg = (
        db.query(PrivateMessage)
        .filter(
            PrivateMessage.id == message_id,
            PrivateMessage.sender_id == user_id,
        )
        .first()
    )

    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you are not the sender",
        )

    receiver_id = msg.receiver_id

    db.query(UserMessageStatus).filter(
        UserMessageStatus.message_id == message_id
    ).delete(synchronize_session=False)

    db.delete(msg)

    db.commit()

    return {"message_id": message_id, "receiver_id": receiver_id}