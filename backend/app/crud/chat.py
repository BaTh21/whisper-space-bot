from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from app.models.group_message_reply import GroupMessageReply
from app.models.group_member import GroupMember
from app.models.group_message_reaction import GroupMessageReaction
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException,status
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from app.schemas.chat import MessageCreate
from app.crud.friend import get_friends
import asyncio

from app.models.user import User
from sqlalchemy import or_, and_
from app.crud.group import get_user_groups
from app.schemas.chat import (MessageOut,ReplyPreview)
from app.services.websocket_manager import manager

def to_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def create_private_message(
    db: Session,
    sender_id: int,
    receiver_id: int,
    content: str,
    message_type: str = "text",
    reply_to_id: Optional[int] = None,
    is_forwarded: bool = False,
    original_sender: Optional[str] = None,
    original_sender_avatar: Optional[str] = None,
    voice_duration: Optional[float] = None,
    file_size: Optional[int] = None,
    forwarded_from_id=None
) -> PrivateMessage:
    try:
        
        try:
            msg_type_enum = MessageType(message_type)
        except ValueError:
            msg_type_enum = MessageType.text

        msg = PrivateMessage(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            message_type=msg_type_enum,
            reply_to_id=reply_to_id,
            is_forwarded=is_forwarded,
            original_sender=original_sender,
            original_sender_avatar=original_sender_avatar,
            voice_duration=voice_duration if msg_type_enum == MessageType.voice else None,
            file_size=file_size if msg_type_enum in [MessageType.voice, MessageType.file] else None,
            created_at=datetime.now(timezone.utc),
            delivered_at=datetime.now(timezone.utc),
            is_read=False,
            forwarded_from_id=forwarded_from_id
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        
        msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender)
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
        
def build_chat_list(db: Session, current_user: User):
    chats = []

    friends = get_friends(db, current_user.id)

    for friend in friends:
        last_msg = (
            db.query(PrivateMessage)
            .filter(
                or_(
                    and_(
                        PrivateMessage.sender_id == current_user.id,
                        PrivateMessage.receiver_id == friend.id
                    ),
                    and_(
                        PrivateMessage.sender_id == friend.id,
                        PrivateMessage.receiver_id == current_user.id
                    )
                )
            )
            .order_by(PrivateMessage.created_at.desc())
            .first()
        )

        updated_at = to_utc(
            last_msg.created_at if last_msg else friend.created_at
        )

        chats.append({
            "id": friend.id,
            "type": "private",
            "name": friend.username,
            "avatar": friend.avatar_url,
            "last_message": last_msg.content if last_msg else None,
            "updated_at": updated_at
        })

    groups = get_user_groups(db, current_user.id)

    for group in groups:
        last_msg = (
            db.query(GroupMessage)
            .filter(GroupMessage.group_id == group.id)
            .order_by(GroupMessage.created_at.desc())
            .first()
        )

        updated_at = to_utc(
            last_msg.created_at if last_msg else group.created_at
        )
        
        creator_info = {
            "id": group.creator.id,
            "username": group.creator.username,
            "avatar_url": group.creator.avatar_url
        } if group.creator else None

        chats.append({
            "id": group.id,
            "type": "group",
            "name": group.name,
            "avatar": group.images[0].url if group.images else None,
            "last_message": last_msg.content if last_msg else None,
            "updated_at": updated_at,
            "creator": creator_info
        })

    chats.sort(
        key=lambda x: x["updated_at"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True
    )

    return chats

def get_private_messages(db: Session, user_id: int, friend_id: int, limit: int = 50, offset: int = 0) -> List[PrivateMessage]:
    return db.query(PrivateMessage).options(
        joinedload(PrivateMessage.sender),
        joinedload(PrivateMessage.receiver),
    ).filter(
        ((PrivateMessage.sender_id == user_id) & (PrivateMessage.receiver_id == friend_id)) |
        ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == user_id))
    ).order_by(PrivateMessage.created_at.desc()).offset(offset).limit(limit).all()

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

def get_group_messages(db: Session, group_id: int, user_id: int, limit=50, offset=0):
    messages = (
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

    message_ids = [m.id for m in messages]

    user_reactions = db.query(GroupMessageReaction).filter(
        GroupMessageReaction.message_id.in_(message_ids),
        GroupMessageReaction.user_id == user_id
    ).all()

    reaction_map = {r.message_id: r.reaction for r in user_reactions}

    for msg in messages:
        msg.my_reaction = reaction_map.get(msg.id)
        msg.reaction_summary = msg.reaction_summary or {}

    return messages
        
def edit_private_message(db: Session, message_id: int, user_id: int, new_content: str) -> PrivateMessage:
    try:
        if not new_content or not new_content.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content cannot be empty.")

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

        msg.content = new_content.strip()
        msg.edited_at = datetime.now(timezone.utc)
        
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
    
def delete_message_forever(db: Session, message_id: int, user_id: int) -> dict:
    msg = db.query(PrivateMessage).options(
        joinedload(PrivateMessage.seen_statuses)
    ).filter(
        PrivateMessage.id == message_id,
        PrivateMessage.sender_id == user_id
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

def serialize_message_type(message_type: MessageType | None) -> str:
    return message_type.value if message_type else MessageType.text.value


def build_reply_preview(reply: PrivateMessage) -> ReplyPreview:
    if reply.message_type == MessageType.voice:
        content = "Voice message"

    elif reply.message_type == MessageType.image:
        content = "Photo"

    elif reply.message_type == MessageType.video:
        content = "Video"

    elif reply.message_type == MessageType.file:
        content = "File"

    elif reply.message_type == MessageType.text:
        content = reply.content or "Message"
        if len(content) > 100:
            content = content[:100] + "..."

    else:
        content = "Attachment"

    return ReplyPreview(
        id=reply.id,
        sender_id=reply.sender_id,
        sender_username=reply.sender.username if reply.sender else "Unknown",
        content=content,
        message_type=serialize_message_type(reply.message_type),
        voice_duration=reply.voice_duration,
        file_size=reply.file_size
    )

def build_message_out(
    msg: PrivateMessage,
    reply_to: MessageOut | None,
) -> MessageOut:
    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        content=msg.content or "",
        message_type=serialize_message_type(msg.message_type),

        is_read=msg.is_read,
        read_at=msg.read_at.isoformat() if msg.read_at else None,
        delivered_at=msg.delivered_at.isoformat() if msg.delivered_at else None,

        reply_to_id=msg.reply_to_id,
        reply_to=reply_to,

        is_forwarded=msg.is_forwarded,
        forwarded_from_id=msg.forwarded_from_id,
        original_sender=msg.original_sender,
        original_sender_avatar=msg.original_sender_avatar,

        created_at=msg.created_at.isoformat(),
        edited_at=msg.edited_at.isoformat() if msg.edited_at else None,

        sender_username=getattr(msg.sender, "username", None),
        receiver_username=getattr(msg.receiver, "username", None),

        voice_duration=msg.voice_duration,
        file_size=msg.file_size,
    )

async def auto_end_call(chat_id: str, db):
    
    await asyncio.sleep(30)

    total = manager.get_total_accepted(chat_id)

    if total < 1:
        await manager.end_group_call(chat_id, db)

    manager.call_timers.pop(chat_id, None)
    
async def send_heartbeat(current_user: int):
            try:
                while True:
                    await asyncio.sleep(25)
                    try:
                        await manager.send_json({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        await manager.update_user_activity(current_user.id)
                    except Exception:
                        break
            except asyncio.CancelledError:
                raise
            except Exception as e:
                print(f"Heartbeat error: {e}")
                
async def mark_message_as_read(db: Session, user_id: int, chat_id: int):
    unread_messages = db.query(PrivateMessage).filter(
        PrivateMessage.receiver_id == user_id,
        PrivateMessage.sender_id == chat_id,
        PrivateMessage.is_read == False
    ).all()
    
    now = datetime.utcnow()
    message_ids = []

    for m in unread_messages:
        m.is_read = True
        m.read_at = now
        message_ids.append(m.id)
        
    db.commit()

    await manager.send_to_user(
        chat_id,
        {
            "type": "messages_read",
            "message_ids": message_ids,
            "reader_id": user_id
        }
    )

