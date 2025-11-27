from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from app.models.group_message_reply import GroupMessageReply
from app.models.group_member import GroupMember
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException,status
from app.models.user_message_status import UserMessageStatus
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from app.schemas.chat import MessageCreate

from app.models.user_message_status import UserMessageStatus
from app.models.message_seen_status import MessageSeenStatus
from app.utils.chat_helpers import validate_reply_message


def create_private_message(
    db: Session,
    sender_id: int,
    receiver_id: int,
    content: str,
    message_type: str = "text",
    reply_to_id: Optional[int] = None,
    is_forwarded: bool = False,
    original_sender: Optional[str] = None,
    voice_duration: Optional[float] = None,
    file_size: Optional[int] = None
) -> PrivateMessage:
    """
    Create a private message with proper type handling and reply validation
    """
    try:
        # Validate reply message if provided
        replied_message = None
        if reply_to_id:
            replied_message = validate_reply_message(db, reply_to_id, sender_id, receiver_id)
        
        # Validate message type
        try:
            msg_type_enum = MessageType(message_type)
        except ValueError:
            msg_type_enum = MessageType.text

        # FIXED: Handle voice message specific fields
        msg = PrivateMessage(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            message_type=msg_type_enum,
            reply_to_id=reply_to_id,
            is_forwarded=is_forwarded,
            original_sender=original_sender,
            voice_duration=voice_duration if message_type == "voice" else None,
            file_size=file_size if message_type in ["voice", "file"] else None,
            created_at=datetime.now(timezone.utc),
            delivered_at=datetime.now(timezone.utc),
            is_read=False
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        
        # FIXED: Eager load relationships including reply_to sender
        msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender)  # Load sender of replied message
        ).filter(PrivateMessage.id == msg.id).first()
        
        return msg
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create message: {str(e)}"
        )


def get_private_messages(db: Session, user_id: int, friend_id: int, limit: int = 50, offset: int = 0) -> List[PrivateMessage]:
    """Get private messages between two users"""
    return db.query(PrivateMessage).options(
        joinedload(PrivateMessage.sender),
        joinedload(PrivateMessage.receiver),
        joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
    ).filter(
        ((PrivateMessage.sender_id == user_id) & (PrivateMessage.receiver_id == friend_id)) |
        ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == user_id))
    ).order_by(PrivateMessage.created_at.desc()).offset(offset).limit(limit).all()

# ADD THIS FUNCTION - Mark messages as read
def mark_messages_as_read(db: Session, message_ids: List[int], user_id: int) -> int:
    """
    Mark multiple messages as read by the receiver with validation
    """
    try:
        if not message_ids:
            return 0
            
        # Get messages that belong to this user and are unread
        messages = db.query(PrivateMessage).filter(
            PrivateMessage.id.in_(message_ids),
            PrivateMessage.receiver_id == user_id,  # Only receiver can mark as read
            PrivateMessage.is_read == False
        ).all()
        
        if not messages:
            return 0
        
        marked_count = 0
        current_time = datetime.now(timezone.utc)
        
        for message in messages:
            # Update message read status
            message.is_read = True
            message.read_at = current_time
            
            # Add seen status entry if not exists
            existing_seen = db.query(MessageSeenStatus).filter(
                MessageSeenStatus.message_id == message.id,
                MessageSeenStatus.user_id == user_id
            ).first()
            
            if not existing_seen:
                seen_status = MessageSeenStatus(
                    message_id=message.id,
                    user_id=user_id,
                    seen_at=current_time
                )
                db.add(seen_status)
                marked_count += 1
        
        db.commit()
        return marked_count
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark messages as read: {str(e)}"
        )

# ADD NEW FUNCTION to get seen status
def get_message_seen_status(db: Session, message_id: int):
    """
    Get who has seen a message and when
    """
    seen_statuses = db.query(MessageSeenStatus).filter(
        MessageSeenStatus.message_id == message_id
    ).options(joinedload(MessageSeenStatus.user)).all()
    
    return seen_statuses


def create_group_message(
    db: Session, 
    sender_id: int, 
    group_id: int, 
    content: str, 
    message_type: MessageType = MessageType.text
) -> GroupMessage:
    
    msg = GroupMessage(
        sender_id=sender_id, 
        group_id=group_id, 
        content=content, 
        message_type= message_type,
        created_at=datetime.utcnow()
    )
    try:
        db.add(msg)
        db.commit()
        db.refresh(msg)
        
    except Exception as e:
        db.rollback()
    
    return msg

def get_group_messages(db: Session, group_id: int, limit=50, offset=0):
    return (
        db.query(GroupMessage)
        .filter(GroupMessage.group_id == group_id)
        .options(
            joinedload(GroupMessage.sender),
            joinedload(GroupMessage.replies).joinedload(GroupMessageReply.sender),
            joinedload(GroupMessage.parent_message).joinedload(GroupMessage.sender)
        )
        .order_by(GroupMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
        
def edit_private_message(db: Session, message_id: int, user_id: int, new_content: str) -> PrivateMessage:
    """Edit a private message"""
    try:
        if not new_content or not new_content.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content cannot be empty.")

        # Use options to load relationships for WebSocket broadcast
        msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
        ).filter(
            PrivateMessage.id == message_id,
            PrivateMessage.sender_id == user_id
        ).first()

        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found or you don't have permission to edit it."
            )

        # Store old content for potential rollback
        old_content = msg.content
        
        # Update message
        msg.content = new_content.strip()
        msg.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(msg)
        
        return msg
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except SQLAlchemyError as e:
        # Rollback on database errors
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while editing message: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while editing message: {str(e)}"
        )


def delete_message_for_user(db: Session, message_id: int, user_id: int):
    status = UserMessageStatus(user_id=user_id, message_id=message_id, is_deleted=True)
    db.merge(status)
    db.commit()
    
def delete_message_forever(db: Session, message_id: int, user_id: int) -> dict:
    """Permanently delete a message (sender only)"""
    msg = db.query(PrivateMessage).options(
        joinedload(PrivateMessage.seen_statuses)
    ).filter(
        PrivateMessage.id == message_id,
        PrivateMessage.sender_id == user_id,  # Only sender can delete permanently
    ).first()

    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you are not the sender",
        )

    receiver_id = msg.receiver_id

    # Delete seen statuses first
    if msg.seen_statuses:
        for seen_status in msg.seen_statuses:
            db.delete(seen_status)

    # Then delete the message
    db.delete(msg)
    db.commit()

    return {"message_id": message_id, "receiver_id": receiver_id}

def mark_message_as_read(db: Session, message_id: int, user_id: int) -> bool:
    """Mark a private message as read by the receiver and create seen status"""
    try:
        message = db.query(PrivateMessage).filter(
            PrivateMessage.id == message_id,
            PrivateMessage.receiver_id == user_id  # Only receiver can mark as read
        ).first()
        
        if message and not message.is_read:
            current_time = datetime.now(timezone.utc)
            message.is_read = True
            message.read_at = current_time
            
            # Create seen status entry if not exists
            existing_seen = db.query(MessageSeenStatus).filter(
                MessageSeenStatus.message_id == message_id,
                MessageSeenStatus.user_id == user_id
            ).first()
            
            if not existing_seen:
                seen_status = MessageSeenStatus(
                    message_id=message_id,
                    user_id=user_id,
                    seen_at=current_time
                )
                db.add(seen_status)
            
            db.commit()
            print(f"[DB] Message {message_id} marked as read by user {user_id}")
            return True
        return False
    except Exception as e:
        print(f"[DB] Error marking message as read: {e}")
        db.rollback()
        return False



# Add these functions to your crud/chat.py

