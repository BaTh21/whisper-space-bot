import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.chat import create_private_message, edit_private_message, serialize_message_type, build_reply_preview, build_message_out
from app.crud.friend import is_blocked, is_blocked_by, is_friend
from app.models.message_seen_status import MessageSeenStatus
from app.models.private_message import MessageType, PrivateMessage
from app.models.user import User
from app.schemas.chat import (MarkMessagesAsReadRequest, MarkMessagesAsReadResponse, ChatListItem,
                             MessageCreate, MessageOut, MessageSeenByUser, ReplyPreview)
from app.services.websocket_manager import manager
from app.utils.chat_helpers import _chat_id, extract_public_id_from_url
from app.core.cloudinary import check_cloudinary_health, upload_voice_message
from app.core.config import settings
from app.crud.friend import get_friends
from sqlalchemy import or_, and_
from app.crud.group import get_user_groups
from app.models.group_message import GroupMessage
from datetime import timezone

router = APIRouter()

def to_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/", response_model=list[ChatListItem])
def list_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
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

    return chats[offset: offset + limit]

@router.get("/private/{friend_id}", response_model=List[MessageOut])
async def get_private_chat(
    friend_id: int,
    limit: int = 30,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if is_blocked(db, current_user.id, friend_id) or is_blocked_by(db, current_user.id, friend_id):
        return []

    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Not friends")

    messages = (
        db.query(PrivateMessage)
        .options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
        )
        .filter(
            ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend_id)) |
            ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == current_user.id))
        )
        .order_by(PrivateMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result: list[MessageOut] = []

    for msg in messages:
        seen_by = [
            MessageSeenByUser(
                user_id=s.user.id,
                username=s.user.username,
                avatar_url=s.user.avatar_url,
                seen_at=s.seen_at.isoformat() if s.seen_at else None
            )
            for s in msg.seen_statuses
        ]

        reply_to_out = None
        reply_preview = None

        if msg.reply_to:
            reply = msg.reply_to

            reply_to_out = MessageOut(
                id=reply.id,
                sender_id=reply.sender_id,
                receiver_id=reply.receiver_id,
                content=reply.content,
                message_type=serialize_message_type(reply.message_type),
                is_read=reply.is_read,
                read_at=reply.read_at.isoformat() if reply.read_at else None,
                delivered_at=reply.delivered_at.isoformat() if reply.delivered_at else None,
                reply_to=None,
                reply_to_id=reply.reply_to_id,
                is_forwarded=reply.is_forwarded,
                forwarded_from_id=reply.forwarded_from_id,
                original_sender=reply.original_sender,
                original_sender_avatar=reply.original_sender_avatar,
                created_at=reply.created_at.isoformat(),
                sender_username=getattr(reply.sender, "username", None),
                sender_avatar_url=getattr(reply.sender, "avatar_url", None),
                receiver_username=getattr(reply.receiver, "username", None),
                voice_duration=reply.voice_duration,
                file_size=reply.file_size,
                seen_by=[]
            )

            reply_preview = build_reply_preview(reply)

        result.append(
            build_message_out(
                msg=msg,
                reply_to=reply_to_out,
                reply_preview=reply_preview,
                seen_by=seen_by
            )
        )

    return result

@router.post("/private/{friend_id}", response_model=MessageOut)
async def send_private_message(
    friend_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        
        if is_blocked(db, current_user.id, friend_id):
            raise HTTPException(
                status_code=403, 
                detail="Cannot send message to blocked user"
            )
        
        if is_blocked_by(db, current_user.id, friend_id):
            raise HTTPException(
                status_code=403, 
                detail="This user has blocked you"
            )
            
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        msg = create_private_message(
            db=db,
            sender_id=current_user.id,
            receiver_id=friend_id,
            content=msg_in.content,
            message_type=msg_in.message_type,
            reply_to_id=msg_in.reply_to_id,
            is_forwarded=msg_in.is_forwarded,
            original_sender=msg_in.original_sender,
            voice_duration=msg_in.voice_duration,
            file_size=msg_in.file_size
        )

        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id == msg.id).first()

        if not full_msg:
            raise HTTPException(status_code=500, detail="Failed to retrieve created message")
        
        chat_id = _chat_id(current_user.id, friend_id)
        
        seen_by = []
        for status in full_msg.seen_statuses:
            seen_by.append({
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            })
        
        broadcast_data = {
            "type": "message",
            "id": full_msg.id,
            "sender_id": full_msg.sender_id,
            "receiver_id": full_msg.receiver_id,
            "content": full_msg.content,
            "message_type": full_msg.message_type.value,
            "is_read": full_msg.is_read,
            "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,
            "delivered_at": full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,
            "reply_to_id": full_msg.reply_to_id,
            "is_forwarded": full_msg.is_forwarded,
            "original_sender": full_msg.original_sender,
            "created_at": full_msg.created_at.isoformat(),
            "sender_username": full_msg.sender.username,
            "sender_avatar_url": full_msg.sender.avatar_url,
            "receiver_username": full_msg.receiver.username,
            "voice_duration": full_msg.voice_duration,
            "file_size": full_msg.file_size,
            "seen_by": seen_by
        }
        
        if full_msg.reply_to:
            reply_content = full_msg.reply_to.content or ""
            if full_msg.reply_to.message_type == MessageType.voice:
                reply_content = "🎤 Voice message"
            elif full_msg.reply_to.message_type == MessageType.image:
                reply_content = "🖼️ Photo" 
            elif full_msg.reply_to.message_type == MessageType.file:
                reply_content = "📎 File"
            elif len(reply_content) > 100:
                reply_content = reply_content[:100] + "..."
            
            broadcast_data["reply_preview"] = {
                "id": full_msg.reply_to.id,
                "sender_username": full_msg.reply_to.sender.username,
                "content": reply_content,
                "message_type": full_msg.reply_to.message_type.value,
                "voice_duration": full_msg.reply_to.voice_duration,
                "file_size": full_msg.reply_to.file_size
            }
            
            reply_seen_by = []
            if full_msg.reply_to.seen_statuses:
                for status in full_msg.reply_to.seen_statuses:
                    reply_seen_by.append({
                        "user_id": status.user.id,
                        "username": status.user.username,
                        "avatar_url": status.user.avatar_url,
                        "seen_at": status.seen_at.isoformat() if status.seen_at else None
                    })
            
            broadcast_data["reply_to"] = {
                "id": full_msg.reply_to.id,
                "sender_id": full_msg.reply_to.sender_id,
                "receiver_id": full_msg.reply_to.receiver_id,
                "content": full_msg.reply_to.content,
                "message_type": full_msg.reply_to.message_type.value,
                "is_read": full_msg.reply_to.is_read,
                "read_at": full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,
                "delivered_at": full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,
                "reply_to_id": full_msg.reply_to.reply_to_id,
                "is_forwarded": full_msg.reply_to.is_forwarded,
                "original_sender": full_msg.reply_to.original_sender,
                "created_at": full_msg.reply_to.created_at.isoformat(),
                "sender_username": full_msg.reply_to.sender.username,
                "receiver_username": full_msg.reply_to.receiver.username if full_msg.reply_to.receiver else None,
                "voice_duration": full_msg.reply_to.voice_duration,
                "file_size": full_msg.reply_to.file_size,
                "seen_by": reply_seen_by
            }
        
        await manager.broadcast(chat_id, broadcast_data)
        
        response = MessageOut(
            id=full_msg.id,
            sender_id=full_msg.sender_id,
            receiver_id=full_msg.receiver_id,
            content=full_msg.content,
            message_type=full_msg.message_type.value,
            is_read=full_msg.is_read,
            read_at=full_msg.read_at.isoformat() if full_msg.read_at else None,
            delivered_at=full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,
            reply_to_id=full_msg.reply_to_id,
            is_forwarded=full_msg.is_forwarded,
            original_sender=full_msg.original_sender,
            sender_username=full_msg.sender.username,
            receiver_username=full_msg.receiver.username,
            voice_duration=full_msg.voice_duration,
            file_size=full_msg.file_size,
            seen_by=[MessageSeenByUser(**item) for item in seen_by],
            created_at=full_msg.created_at.isoformat()
        )
        
        if full_msg.reply_to:
            reply_content = full_msg.reply_to.content or ""
            if full_msg.reply_to.message_type == MessageType.voice:
                reply_content = "🎤 Voice message"
            elif full_msg.reply_to.message_type == MessageType.image:
                reply_content = "🖼️ Photo"
            elif full_msg.reply_to.message_type == MessageType.file:
                reply_content = "📎 File"
            elif len(reply_content) > 100:
                reply_content = reply_content[:100] + "..."
            
            response.reply_preview = ReplyPreview(
                id=full_msg.reply_to.id,
                sender_username=full_msg.reply_to.sender.username,
                content=reply_content,
                message_type=full_msg.reply_to.message_type.value,
                voice_duration=full_msg.reply_to.voice_duration,
                file_size=full_msg.reply_to.file_size
            )
            
            reply_seen_by = []
            if full_msg.reply_to.seen_statuses:
                for status in full_msg.reply_to.seen_statuses:
                    reply_seen_by.append(MessageSeenByUser(
                        user_id=status.user.id,
                        username=status.user.username,
                        avatar_url=status.user.avatar_url,
                        seen_at=status.seen_at.isoformat() if status.seen_at else None
                    ))
            
            response.reply_to = MessageOut(
                id=full_msg.reply_to.id,
                sender_id=full_msg.reply_to.sender_id,
                receiver_id=full_msg.reply_to.receiver_id,
                content=full_msg.reply_to.content,
                message_type=full_msg.reply_to.message_type.value,
                is_read=full_msg.reply_to.is_read,
                read_at=full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,
                delivered_at=full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,
                reply_to_id=full_msg.reply_to.reply_to_id,
                is_forwarded=full_msg.reply_to.is_forwarded,
                original_sender=full_msg.reply_to.original_sender,
                created_at=full_msg.reply_to.created_at.isoformat(),
                sender_username=full_msg.reply_to.sender.username,
                receiver_username=full_msg.reply_to.receiver.username if full_msg.reply_to.receiver else None,
                voice_duration=full_msg.reply_to.voice_duration,
                file_size=full_msg.reply_to.file_size,
                seen_by=reply_seen_by
            )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")
    
@router.get("/private/message/{message_id}/reply-context")
async def get_reply_context(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if current_user.id not in [message.sender_id, message.receiver_id]:
            raise HTTPException(status_code=403, detail="No access to this message")
        
        seen_by = []
        for status in message.seen_statuses:
            seen_by.append(MessageSeenByUser(
                user_id=status.user.id,
                username=status.user.username,
                avatar_url=status.user.avatar_url,
                seen_at=status.seen_at.isoformat() if status.seen_at else None
            ))
        
        return MessageOut(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            content=message.content,
            message_type=message.message_type.value,
            is_read=message.is_read,
            read_at=message.read_at.isoformat() if message.read_at else None,
            delivered_at=message.delivered_at.isoformat() if message.delivered_at else None,
            reply_to_id=message.reply_to_id,
            is_forwarded=message.is_forwarded,
            original_sender=message.original_sender,
            created_at=message.created_at.isoformat(),
            sender_username=message.sender.username,
            receiver_username=message.receiver.username,
            voice_duration=message.voice_duration,
            file_size=message.file_size,
            seen_by=seen_by
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get reply context: {str(e)}")    

@router.post("/private/{friend_id}/voice", response_model=MessageOut)
async def send_voice_message(
    friend_id: int,
    voice_file: UploadFile = File(...),
    duration: float = Form(...),
    reply_to_id: Optional[int] = Form(None),
    temp_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:

        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        contents = await voice_file.read()
        file_size = len(contents)

        if file_size == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")
        if file_size > 15 * 1024 * 1024:  # 15MB max
            raise HTTPException(status_code=400, detail="Voice message too large (max 15MB)")

        if duration <= 0 or duration > 600:  # max 10 minutes
            raise HTTPException(status_code=400, detail="Invalid voice duration")

        try:
            upload_result = upload_voice_message(
                file_content=contents,
                public_id=f"voice_{current_user.id}_{uuid.uuid4().hex[:8]}",  # shorter ID
                folder="voice_messages"
            )
            voice_url = upload_result["secure_url"]
            
        except Exception as upload_error:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to upload voice message: {str(upload_error)}"
            )

        try:
            msg = create_private_message(
                db=db,
                sender_id=current_user.id,
                receiver_id=friend_id,
                content=voice_url,
                message_type="voice",
                reply_to_id=reply_to_id,
                voice_duration=round(duration, 2),
                file_size=file_size
            )
        except Exception as db_error:
            raise HTTPException(status_code=500, detail="Failed to save message to database")

        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
        ).filter(PrivateMessage.id == msg.id).first()

        if not full_msg:
            raise HTTPException(status_code=500, detail="Failed to load sent message")

        chat_id = _chat_id(current_user.id, friend_id)

        seen_by = [
            {
                "user_id": s.user.id,
                "username": s.user.username,
                "avatar_url": s.user.avatar_url,
                "seen_at": s.seen_at.isoformat() if s.seen_at else None
            }
            for s in full_msg.seen_statuses
        ]

        broadcast_data = {
            "type": "message",
            "id": full_msg.id,
            "temp_id": temp_id,
            "sender_id": full_msg.sender_id,
            "receiver_id": full_msg.receiver_id,
            "content": voice_url,
            "message_type": "voice",
            "voice_duration": round(duration, 2),
            "file_size": file_size,
            "reply_to_id": full_msg.reply_to_id,
            "reply_preview": None,
            "is_read": False,
            "created_at": full_msg.created_at.isoformat(),
            "sender_username": full_msg.sender.username,
            "avatar_url": full_msg.sender.avatar_url or "",
            "seen_by": seen_by,
        }

        if full_msg.reply_to:
            reply = full_msg.reply_to
            reply_text = "Voice message"
            if reply.message_type == MessageType.text:
                reply_text = reply.content or "Message"
                if len(reply_text) > 80:
                    reply_text = reply_text[:80] + "..."
            elif reply.message_type == MessageType.image:
                reply_text = "Photo"
            elif reply.message_type == MessageType.file:
                reply_text = "File"

            broadcast_data["reply_preview"] = {
                "id": reply.id,
                "sender_username": reply.sender.username,
                "content": reply_text,
                "message_type": reply.message_type.value,
                "voice_duration": reply.voice_duration,
                "file_size": reply.file_size
            }

        broadcast_data["chat_id"] = _chat_id(current_user.id, friend_id)
        await manager.send_to_user(friend_id, broadcast_data)

        response = MessageOut(
            id=full_msg.id,
            temp_id=temp_id,
            sender_id=full_msg.sender_id,
            receiver_id=full_msg.receiver_id,
            content=voice_url,
            message_type="voice",
            voice_duration=round(duration, 2),
            file_size=file_size,
            is_read=False,
            created_at=full_msg.created_at.isoformat(),
            sender_username=full_msg.sender.username,
            receiver_username=full_msg.receiver.username,
            seen_by=[MessageSeenByUser(**s) for s in seen_by],
        )

        if full_msg.reply_to:
            reply = full_msg.reply_to
            reply_text = "Voice message"
            if reply.message_type == MessageType.text:
                reply_text = (reply.content or "")[:100] + ("..." if len(reply.content or "") > 100 else "")
            elif reply.message_type == MessageType.image:
                reply_text = "Photo"
            elif reply.message_type == MessageType.file:
                reply_text = "File"

            response.reply_preview = ReplyPreview(
                id=reply.id,
                sender_username=reply.sender.username,
                content=reply_text,
                message_type=reply.message_type.value,
                voice_duration=reply.voice_duration,
                file_size=reply.file_size
            )

        return response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Voice message failed: {str(e)}")
    
@router.post("/private/{friend_id}/upload")
async def send_media_message(
    friend_id: int,
    file: UploadFile = File(...),
    message_type: str = Form(default=None),
    reply_to_id: int = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if message_type not in ["image", "video", "file"]:
        raise HTTPException(status_code=400, detail="Invalid media type")
    
    if message_type == "image" and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File is not an image")
    if message_type == "video" and not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File is not a video")
    
    try:
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        if not file.content_type:
            raise HTTPException(status_code=400, detail="Invalid file")

        content_type = file.content_type

        if content_type.startswith("image/"):
            detected_type = MessageType.image
            folder = "chat_images"
            resource_type = "image"
        elif content_type.startswith("video/"):
            detected_type = MessageType.video
            folder = "chat_videos"
            resource_type = "video"
        else:
            detected_type = MessageType.file
            folder = "chat_files"
            resource_type = "raw"

        if message_type:
            detected_type = MessageType(message_type)
            if message_type == "image":
                resource_type = "image"
                folder = "chat_images"
            elif message_type == "video":
                resource_type = "video"
                folder = "chat_videos"
            else:
                resource_type = "raw"
                folder = "chat_files"

        file_extension = file.filename.split('.')[-1] if '.' in file.filename else "bin"
        unique_filename = f"chat_{current_user.id}_{friend_id}_{uuid.uuid4().hex}.{file_extension}"

        upload_result = cloudinary.uploader.upload(
            file.file,
            folder=folder,
            public_id=unique_filename,
            resource_type=resource_type
        )

        file_url = upload_result["secure_url"]

        msg = create_private_message(
            db=db,
            sender_id=current_user.id,
            receiver_id=friend_id,
            content=file_url,
            message_type=detected_type,
            reply_to_id=reply_to_id,
            file_size=upload_result.get("bytes", 0),
            is_forwarded=False,
            original_sender=None
        )

        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id == msg.id).first()

        chat_id = _chat_id(current_user.id, friend_id)

        seen_by = [
            {
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            }
            for status in full_msg.seen_statuses
        ]

        reply_preview = None
        if full_msg.reply_to_id:
            reply_msg = db.query(PrivateMessage).filter(
                PrivateMessage.id == full_msg.reply_to_id
            ).first()

            if reply_msg:
                reply_preview = {
                    "id": reply_msg.id,
                    "content": reply_msg.content,
                    "message_type": reply_msg.message_type.value,
                    "sender_username": reply_msg.sender.username
                }

        broadcast_data = {
            "type": "message",
            "id": full_msg.id,
            "content": full_msg.content,
            "message_type": full_msg.message_type.value,
            "sender_id": full_msg.sender_id,
            "receiver_id": full_msg.receiver_id,
            "sender_username": full_msg.sender.username,
            "sender_avatar_url": full_msg.sender.avatar_url,
            "receiver_username": full_msg.receiver.username,
            "created_at": full_msg.created_at.isoformat(),
            "is_read": full_msg.is_read,
            "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,
            "delivered_at": full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,
            "voice_duration": full_msg.voice_duration,
            "file_size": full_msg.file_size,
            "reply_to_id": full_msg.reply_to_id,
            "reply_preview": reply_preview,
            "is_forwarded": full_msg.is_forwarded,
            "original_sender": full_msg.original_sender,
            "seen_by": seen_by
        }

        await manager.broadcast(chat_id, broadcast_data)

        return broadcast_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/private/image/{message_id}")
async def delete_image_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.seen_statuses)
        ).filter(
            PrivateMessage.id == message_id,
            (PrivateMessage.sender_id == current_user.id) | (PrivateMessage.receiver_id == current_user.id)
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        if message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only delete your own messages")
        
        if message.message_type.value != 'image':
            raise HTTPException(status_code=400, detail="Not an image message")
        
        image_url = message.content
        public_id = extract_public_id_from_url(image_url)
        
        if public_id:
            cloudinary.uploader.destroy(public_id)
        
        chat_id = _chat_id(message.sender_id, message.receiver_id)
        
        if message.seen_statuses:
            for seen_status in message.seen_statuses:
                db.delete(seen_status)
        
        db.delete(message)
        db.commit()
        
        await manager.broadcast(chat_id, {
            "type": "message_deleted",
            "message_id": message_id,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"status": "success", "message": "Image message deleted", "message_id": message_id}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete image message: {str(e)}")

@router.delete("/private/{message_id}")
async def delete_message_forever_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.seen_statuses)
        ).filter(PrivateMessage.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        if message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only delete your own messages")
        
        chat_id = _chat_id(message.sender_id, message.receiver_id)
        
        if message.message_type.value == 'image':
            image_url = message.content
            public_id = extract_public_id_from_url(image_url)
            
            if public_id:
                cloudinary.uploader.destroy(public_id)
                
        if message.seen_statuses:
            for seen_status in message.seen_statuses:
                db.delete(seen_status)
            db.flush()
        
        db.delete(message)
        db.commit()

        await manager.broadcast(chat_id, {
            "type": "message_deleted", 
            "message_id": message_id,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "success", 
            "message": "Message deleted successfully",
            "message_id": message_id,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Delete error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete message: {str(e)}")

@router.get("/private/{friend_id}", response_model=List[MessageOut])
async def get_private_chat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if is_blocked(db, current_user.id, friend_id) or is_blocked_by(db, current_user.id, friend_id):
        return []

    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Not friends")

    messages = (
        db.query(PrivateMessage)
        .options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
        )
        .filter(
            ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend_id)) |
            ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == current_user.id))
        )
        .order_by(PrivateMessage.created_at.asc())
        .all()
    )

    result = []

    for msg in messages:
        seen_by = [
            MessageSeenByUser(
                user_id=s.user.id,
                username=s.user.username,
                avatar_url=s.user.avatar_url,
                seen_at=s.seen_at.isoformat() if s.seen_at else None
            )
            for s in msg.seen_statuses
        ]

        reply_to_out = None
        reply_preview = None

        if msg.reply_to:
            reply_to_out = MessageOut(
                id=msg.reply_to.id,
                sender_id=msg.reply_to.sender_id,
                receiver_id=msg.reply_to.receiver_id,
                content=msg.reply_to.content,
                message_type=serialize_message_type(msg.reply_to.message_type),
                is_read=msg.reply_to.is_read,
                read_at=msg.reply_to.read_at.isoformat() if msg.reply_to.read_at else None,
                delivered_at=msg.reply_to.delivered_at.isoformat() if msg.reply_to.delivered_at else None,
                reply_to=None,
                reply_to_id=msg.reply_to.reply_to_id,
                is_forwarded=msg.reply_to.is_forwarded,
                original_sender=msg.reply_to.original_sender,
                created_at=msg.reply_to.created_at.isoformat(),
                sender_username=msg.reply_to.sender.username,
                receiver_username=msg.reply_to.receiver.username,
                voice_duration=msg.reply_to.voice_duration,
                file_size=msg.reply_to.file_size,
                seen_by=[]
            )

            reply_preview = build_reply_preview(msg.reply_to)

        result.append(
            build_message_out(
                msg=msg,
                reply_to=reply_to_out,
                reply_preview=reply_preview,
                seen_by=seen_by
            )
        )

    return result

    try:
        message = db.query(PrivateMessage).filter(
            PrivateMessage.id == message_id,
            (PrivateMessage.sender_id == current_user.id) | (PrivateMessage.receiver_id == current_user.id)
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        return {
            "id": message.id,
            "sender_id": message.sender_id,
            "content": message.content,
            "message_type": message.message_type.value,
            "created_at": message.created_at.isoformat(),
            "is_own_message": message.sender_id == current_user.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get message info: {str(e)}")

@router.patch("/private/{message_id}")
async def edit_message(
    message_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        msg = edit_private_message(db, message_id, current_user.id, data.content.strip())

        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
        ).filter(PrivateMessage.id == msg.id).first()

        if not full_msg:
            raise HTTPException(status_code=404, detail="Message not found after edit")

        chat_id = _chat_id(full_msg.sender_id, full_msg.receiver_id)
        
        seen_by = []
        for status in full_msg.seen_statuses:
            seen_by.append({
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            })

        payload = {
            "type": "message_updated", 
            "id": full_msg.id,
            "message_id": full_msg.id,
            "content": full_msg.content,
            "message_type": full_msg.message_type.value,
            "edited_at": full_msg.edited_at.isoformat(),
            "created_at": full_msg.created_at.isoformat(),
            "sender_id": full_msg.sender_id,
            "receiver_id": full_msg.receiver_id,
            "sender_username": full_msg.sender.username,
            "receiver_username": full_msg.receiver.username if full_msg.receiver else None,
            "avatar_url": full_msg.sender.avatar_url,
            "is_read": full_msg.is_read,
            "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,
            "seen_by": seen_by,
            "voice_duration": full_msg.voice_duration,
            "file_size": full_msg.file_size,
            "is_forwarded": full_msg.is_forwarded,
            "original_sender": full_msg.original_sender,
        }

        await manager.broadcast(chat_id, payload)
        return {
            "id": full_msg.id,
            "content": full_msg.content,
            "edited_at": full_msg.edited_at.isoformat(),
            "message_type": full_msg.message_type.value,
            "edited": True,
            "sender_username": full_msg.sender.username,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to edit message: {str(e)}")
    

@router.post("/private/{friend_id}/read")
def mark_private_messages_read(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all messages from friend_id as read for the current user."""
    # Update all unread messages where current_user is the receiver
    db.query(PrivateMessage).filter(
        PrivateMessage.sender_id == friend_id,
        PrivateMessage.receiver_id == current_user.id,
        PrivateMessage.is_read == False
    ).update({PrivateMessage.is_read: True, PrivateMessage.read_at: datetime.now(timezone.utc)})
    
    db.commit()
    return {"status": "success", "message": "Messages marked as read"}
