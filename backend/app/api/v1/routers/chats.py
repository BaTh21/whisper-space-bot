import contextlib
import io
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
import wave

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.chat import create_private_message, delete_message_forever, edit_private_message, mark_messages_as_read
from app.crud.friend import is_friend
from app.models.message_seen_status import MessageSeenStatus
from app.models.private_message import MessageType, PrivateMessage
from app.models.user import User
from app.schemas.chat import (MarkMessagesAsReadRequest, MarkMessagesAsReadResponse,
                             MessageCreate, MessageOut, MessageSeenByUser, ReplyPreview)
from app.services.websocket_manager import manager
from app.utils.chat_helpers import _chat_id, extract_public_id_from_url
from app.core.cloudinary import check_cloudinary_health, upload_voice_message
from app.core.config import settings

router = APIRouter()

# Mark messages as read endpoint
@router.post("/messages/read")
async def mark_messages_as_read_batch(
    request: MarkMessagesAsReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark multiple messages as read with proper seen_by tracking
    """
    try:
        # Get messages that belong to this user and are unread
        messages = db.query(PrivateMessage).filter(
            PrivateMessage.id.in_(request.message_ids),
            PrivateMessage.receiver_id == current_user.id,
            PrivateMessage.is_read == False
        ).all()
        
        if not messages:
            return MarkMessagesAsReadResponse(
                status="success",
                marked_count=0,
                message_ids=request.message_ids
            )
        
        marked_count = 0
        for message in messages:
            # Update message read status
            message.is_read = True
            message.read_at = datetime.now(timezone.utc)
            
            # Add seen status entry
            existing_seen = db.query(MessageSeenStatus).filter(
                MessageSeenStatus.message_id == message.id,
                MessageSeenStatus.user_id == current_user.id
            ).first()
            
            if not existing_seen:
                seen_status = MessageSeenStatus(
                    message_id=message.id,
                    user_id=current_user.id,
                    seen_at=datetime.now(timezone.utc)
                )
                db.add(seen_status)
                marked_count += 1
        
        db.commit()
        
        # Get updated messages with seen_by information
        updated_messages = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id.in_([m.id for m in messages])).all()
        
        # Prepare WebSocket notification
        for message in updated_messages:
            chat_id = _chat_id(message.sender_id, message.receiver_id)
            
            # Prepare seen information
            seen_info = []
            for status in message.seen_statuses:
                seen_info.append({
                    "user_id": status.user.id,
                    "username": status.user.username,
                    "avatar_url": status.user.avatar_url,
                    "seen_at": status.seen_at.isoformat() if status.seen_at else None
                })
            
            await manager.broadcast(chat_id, {
                "type": "message_updated",
                "message_id": message.id,
                "is_read": True,
                "read_at": message.read_at.isoformat() if message.read_at else None,
                "seen_by": seen_info
            })
        
        return MarkMessagesAsReadResponse(
            status="success",
            marked_count=marked_count,
            message_ids=request.message_ids
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to mark messages as read: {str(e)}")

# Get private chat messages
@router.get("/private/{friend_id}", response_model=List[MessageOut])
async def get_private_chat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get private chat messages between current user and friend with Telegram-style replies
    """
    try:
        # Verify friendship
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        # FIXED: Query with proper relationship loading for replies
        messages = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),  # Load sender of replied message
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
        ).filter(
            ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend_id)) |
            ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == current_user.id))
        ).order_by(PrivateMessage.created_at.asc()).all()

        result = []
        for msg in messages:
            # Seen by users for main message
            seen_by = [
                MessageSeenByUser(
                    user_id=status.user.id,
                    username=status.user.username,
                    avatar_url=status.user.avatar_url,
                    seen_at=status.seen_at.isoformat() if status.seen_at else None
                )
                for status in getattr(msg, "seen_statuses", [])
            ]

            # FIXED: Reply handling with proper null checks
            reply_to_out = None
            reply_preview = None
            
            if msg.reply_to:  # This should now work with the fixed relationship
                reply = msg.reply_to

                # Build reply_to message (simplified to avoid recursion)
                reply_to_out = MessageOut(
                    id=reply.id,
                    sender_id=reply.sender_id,
                    receiver_id=reply.receiver_id,
                    content=reply.content,
                    message_type=reply.message_type.value,
                    is_read=reply.is_read,
                    read_at=reply.read_at.isoformat() if reply.read_at else None,
                    delivered_at=reply.delivered_at.isoformat() if reply.delivered_at else None,
                    reply_to=None,  # avoid infinite recursion
                    reply_to_id=reply.reply_to_id,  # Add this
                    is_forwarded=reply.is_forwarded,
                    original_sender=reply.original_sender,
                    created_at=reply.created_at.isoformat(),
                    sender_username=getattr(reply.sender, "username", None),
                    receiver_username=getattr(reply.receiver, "username", None),
                    voice_duration=reply.voice_duration,
                    file_size=reply.file_size,
                    seen_by=[]  # Simplified to avoid complex nested queries
                )

                # Build reply preview
                content_preview = reply.content or ""
                if reply.message_type == MessageType.voice:
                    content_preview = "🎤 Voice message"
                elif reply.message_type == MessageType.image:
                    content_preview = "🖼️ Photo"
                elif reply.message_type == MessageType.file:
                    content_preview = "📎 File"
                elif len(content_preview) > 100:
                    content_preview = content_preview[:100] + "..."

                reply_preview = ReplyPreview(
                    id=reply.id,
                    sender_username=getattr(reply.sender, "username", "Unknown"),
                    content=content_preview,
                    message_type=reply.message_type.value,
                    voice_duration=reply.voice_duration,
                    file_size=reply.file_size
                )

            # Build main message output
            msg_out = MessageOut(
                id=msg.id,
                sender_id=msg.sender_id,
                receiver_id=msg.receiver_id,
                content=msg.content,
                message_type=msg.message_type.value,
                is_read=msg.is_read,
                read_at=msg.read_at.isoformat() if msg.read_at else None,
                delivered_at=msg.delivered_at.isoformat() if msg.delivered_at else None,
                reply_to_id=msg.reply_to_id,  # Make sure this is included
                reply_to=reply_to_out,
                reply_preview=reply_preview,
                is_forwarded=msg.is_forwarded,
                original_sender=msg.original_sender,
                created_at=msg.created_at.isoformat(),
                sender_username=getattr(msg.sender, "username", None),
                receiver_username=getattr(msg.receiver, "username", None),
                voice_duration=msg.voice_duration,
                file_size=msg.file_size,
                seen_by=seen_by
            )

            result.append(msg_out)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat messages: {str(e)}")




# Send text message
@router.post("/private/{friend_id}", response_model=MessageOut)
async def send_private_message(
    friend_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a private message to a friend with Telegram-style reply handling
    """
    try:
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        # Create message in database
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

        # Get the full message with all relationships
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
        
        # Prepare seen information
        seen_by = []
        for status in full_msg.seen_statuses:
            seen_by.append({
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            })
        
        # Prepare broadcast data
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
            "receiver_username": full_msg.receiver.username,
            "voice_duration": full_msg.voice_duration,
            "file_size": full_msg.file_size,
            "seen_by": seen_by
        }
        
        # Add Telegram-style reply data if exists
        if full_msg.reply_to:
            # Create compact reply preview (like Telegram)
            reply_content = full_msg.reply_to.content or ""
            if full_msg.reply_to.message_type == MessageType.voice:
                reply_content = "🎤 Voice message"
            elif full_msg.reply_to.message_type == MessageType.image:
                reply_content = "🖼️ Photo" 
            elif full_msg.reply_to.message_type == MessageType.file:
                reply_content = "📎 File"
            elif len(reply_content) > 100:
                reply_content = reply_content[:100] + "..."
            
            # Add compact reply preview to broadcast
            broadcast_data["reply_preview"] = {
                "id": full_msg.reply_to.id,
                "sender_username": full_msg.reply_to.sender.username,
                "content": reply_content,
                "message_type": full_msg.reply_to.message_type.value,
                "voice_duration": full_msg.reply_to.voice_duration,
                "file_size": full_msg.reply_to.file_size
            }
            
            # Also include full reply data for detailed view
            reply_seen_by = []
            if full_msg.reply_to.seen_statuses:
                for status in full_msg.reply_to.seen_statuses:
                    reply_seen_by.append({
                        "user_id": status.user.id,
                        "username": status.user.username,
                        "avatar_url": status.user.avatar_url,
                        "seen_at": status.seen_at.isoformat() if status.seen_at else None
                    })
            
            # Include complete replied message information
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
        
        # Broadcast via WebSocket
        await manager.broadcast(chat_id, broadcast_data)
        
        # Build response with Telegram-style reply preview
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
        
        # Add Telegram-style reply preview to response if exists
        if full_msg.reply_to:
            # Create compact preview for the response
            reply_content = full_msg.reply_to.content or ""
            if full_msg.reply_to.message_type == MessageType.voice:
                reply_content = "🎤 Voice message"
            elif full_msg.reply_to.message_type == MessageType.image:
                reply_content = "🖼️ Photo"
            elif full_msg.reply_to.message_type == MessageType.file:
                reply_content = "📎 File"
            elif len(reply_content) > 100:
                reply_content = reply_content[:100] + "..."
            
            # Add reply_preview to response
            response.reply_preview = ReplyPreview(
                id=full_msg.reply_to.id,
                sender_username=full_msg.reply_to.sender.username,
                content=reply_content,
                message_type=full_msg.reply_to.message_type.value,
                voice_duration=full_msg.reply_to.voice_duration,
                file_size=full_msg.reply_to.file_size
            )
            
            # Also include full reply object for detailed view
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
    """
    Get full context of a replied message (for when user clicks on reply preview)
    """
    try:
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if user has access to this message
        if current_user.id not in [message.sender_id, message.receiver_id]:
            raise HTTPException(status_code=403, detail="No access to this message")
        
        # Build seen_by information
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

# Send voice message
@router.post("/private/{friend_id}/voice", response_model=MessageOut)
async def send_voice_message(
    friend_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 1. Read and validate audio file
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty audio file")

    # 2. Extract duration
    with io.BytesIO(contents) as audio_io:
        with contextlib.closing(wave.open(audio_io, 'rb')) as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            duration = frames / float(rate)

    # 3. Upload to Cloudinary with best settings
    result = cloudinary.uploader.upload(
        io.BytesIO(contents),
        resource_type="video",          # Cloudinary treats audio as video
        folder="whisper_space/voice_messages",
        public_id=f"voice_{current_user.id}_{int(datetime.utcnow().timestamp())}",
        format="webm",                  # or "ogg", "mp3" — webm/opus is smallest
        quality="auto:best",
        fetch_format="auto",
        flags="attachment"
    )

    voice_url = result["secure_url"]  # This will be f_auto,q_auto

    # 4. Create message
    msg_in = MessageCreate(
        content=voice_url,
        message_type="voice",
        voice_duration=round(duration, 2),
        file_size=len(contents)
    )

    message = create_private_message(
        db=db,
        sender_id=current_user.id,
        receiver_id=friend_id,
        message_in=msg_in
    )

    return MessageOut.from_orm(message)
    
@router.get("/cloudinary-health")
async def cloudinary_health_check():
    """Check Cloudinary connectivity and configuration"""
    try:
        is_healthy, message = check_cloudinary_health()
        
        # Test actual upload if configuration is OK
        if is_healthy:
            try:
                # Test with a small file
                test_content = b"test voice message content"
                test_result = upload_voice_message(
                    test_content,
                    public_id=f"health_check_{uuid.uuid4().hex}",
                    folder="health_checks"
                )
                return {
                    "status": "healthy",
                    "message": "Cloudinary is fully operational",
                    "upload_test": "success",
                    "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
                    "base_folder": settings.CLOUDINARY_UPLOAD_FOLDER
                }
            except Exception as upload_error:
                return {
                    "status": "unhealthy", 
                    "message": f"Configuration OK but upload failed: {str(upload_error)}",
                    "upload_test": "failed",
                    "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
                    "base_folder": settings.CLOUDINARY_UPLOAD_FOLDER
                }
        else:
            return {
                "status": "unhealthy",
                "message": message,
                "upload_test": "not_attempted",
                "cloud_name": settings.CLOUDINARY_CLOUD_NAME if hasattr(settings, 'CLOUDINARY_CLOUD_NAME') else "not_set",
                "base_folder": settings.CLOUDINARY_UPLOAD_FOLDER if hasattr(settings, 'CLOUDINARY_UPLOUD_FOLDER') else "not_set"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "upload_test": "error"
        }
    
@router.post("/private/{friend_id}/image")
async def send_image_message(
    friend_id: int,
    image_url: str = Form(...),
    message_type: str = Form(default="image"),
    reply_to_id: int = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send an image message using pre-uploaded image URL
    """
    try:
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        # Create message with image URL as content
        msg = create_private_message(
            db=db,
            sender_id=current_user.id,
            receiver_id=friend_id,
            content=image_url,
            message_type=message_type,
            reply_to_id=reply_to_id,
            is_forwarded=False,
            original_sender=None
        )
        
        # Get the full message with user relationships
        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
        ).filter(PrivateMessage.id == msg.id).first()
        
        if not full_msg:
            raise HTTPException(status_code=500, detail="Failed to retrieve created image message")
        
        chat_id = _chat_id(current_user.id, friend_id)
        
        # Prepare seen information
        seen_by = []
        for status in full_msg.seen_statuses:
            seen_by.append({
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            })
        
        # Prepare broadcast data for image message
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
            "receiver_username": full_msg.receiver.username,
            "seen_by": seen_by
        }
        
        await manager.broadcast(chat_id, broadcast_data)
        
        return MessageOut(
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
            created_at=full_msg.created_at.isoformat(),
            seen_by=[MessageSeenByUser(**item) for item in seen_by]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send image message: {str(e)}")

# Upload image to Cloudinary
@router.post("/private/{friend_id}/upload")
async def upload_image_to_cloudinary(
    friend_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload image to Cloudinary and return URL
    """
    try:
        if not is_friend(db, current_user.id, friend_id):
            raise HTTPException(status_code=403, detail="Not friends")

        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files allowed")

        try:
            # Generate unique filename
            file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            unique_filename = f"chat_{current_user.id}_{friend_id}_{uuid.uuid4().hex}.{file_extension}"
            
            result = cloudinary.uploader.upload(
                file.file,
                folder="chat_images",
                public_id=unique_filename,
                resource_type="image",
                transformation=[
                    {"width": 800, "crop": "limit"},
                    {"quality": "auto"}
                ]
            )
            return {"url": result["secure_url"], "public_id": result["public_id"]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

# Delete image message
@router.delete("/private/image/{message_id}")
async def delete_image_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an image message and remove from Cloudinary
    """
    try:
        # Get the message with relationships
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.seen_statuses)
        ).filter(
            PrivateMessage.id == message_id,
            (PrivateMessage.sender_id == current_user.id) | (PrivateMessage.receiver_id == current_user.id)
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if user has permission to delete (only sender can delete)
        if message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only delete your own messages")
        
        # Check if it's an image message
        if message.message_type.value != 'image':
            raise HTTPException(status_code=400, detail="Not an image message")
        
        # Extract public_id from Cloudinary URL
        image_url = message.content
        public_id = extract_public_id_from_url(image_url)
        
        # Delete from Cloudinary
        if public_id:
            try:
                cloudinary.uploader.destroy(public_id)
            except Exception as cloudinary_error:
                print(f"Cloudinary deletion failed: {str(cloudinary_error)}")
                # Continue with message deletion even if Cloudinary fails
        
        # Store info for WebSocket broadcast before deletion
        chat_id = _chat_id(message.sender_id, message.receiver_id)
        
        # Delete seen statuses first
        if message.seen_statuses:
            for seen_status in message.seen_statuses:
                db.delete(seen_status)
        
        # Delete the message from database
        db.delete(message)
        db.commit()
        
        # Notify via WebSocket
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

# Enhanced delete endpoint for all message types
@router.delete("/private/{message_id}")
async def delete_message_forever_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enhanced delete to handle all message types with seen status
    """
    try:
        # Get the message first with all relationships
        message = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.seen_statuses)
        ).filter(PrivateMessage.id == message_id).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check permissions
        if message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only delete your own messages")
        
        # Store info for broadcast before deletion
        chat_id = _chat_id(message.sender_id, message.receiver_id)
        
        # If it's an image message, delete from Cloudinary first
        if message.message_type.value == 'image':
            image_url = message.content
            public_id = extract_public_id_from_url(image_url)
            
            if public_id:
                try:
                    cloudinary.uploader.destroy(public_id)
                except Exception as e:
                    print(f"Cloudinary deletion failed: {str(e)}")
                    # Continue with message deletion even if Cloudinary fails
        
        # Delete seen statuses first to avoid foreign key constraint
        if message.seen_statuses:
            for seen_status in message.seen_statuses:
                db.delete(seen_status)
            db.flush()  # Commit the deletion of seen statuses first
        
        # Now delete the message
        db.delete(message)
        db.commit()
        
        # Broadcast deletion
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

# Get message info for deletion confirmation
@router.get("/private/{message_id}/info")
async def get_message_info(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get message information for deletion confirmation
    """
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

# Edit message endpoint
@router.patch("/private/{message_id}")
async def edit_message(
    message_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Edit a message
    """
    try:
        # Edit the message
        msg = edit_private_message(db, message_id, current_user.id, data.content.strip())

        # Get complete message data with all relationships for WebSocket
        full_msg = db.query(PrivateMessage).options(
            joinedload(PrivateMessage.sender),
            joinedload(PrivateMessage.receiver),
            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
        ).filter(PrivateMessage.id == msg.id).first()

        if not full_msg:
            raise HTTPException(status_code=404, detail="Message not found after edit")

        chat_id = _chat_id(full_msg.sender_id, full_msg.receiver_id)
        
        # Prepare seen_by data
        seen_by = []
        for status in full_msg.seen_statuses:
            seen_by.append({
                "user_id": status.user.id,
                "username": status.user.username,
                "avatar_url": status.user.avatar_url,
                "seen_at": status.seen_at.isoformat() if status.seen_at else None
            })

        # Complete WebSocket payload
        payload = {
            "type": "message_updated", 
            "id": full_msg.id,
            "message_id": full_msg.id,  # Both id and message_id for compatibility
            "content": full_msg.content,
            "message_type": full_msg.message_type.value,
            "updated_at": full_msg.updated_at.isoformat(),
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

        # Broadcast to all connected clients in the chat
        await manager.broadcast(chat_id, payload)
        print(f"✅ Broadcast message edit: {full_msg.id} to chat {chat_id}")
        
        # HTTP response
        return {
            "id": full_msg.id,
            "content": full_msg.content,
            "updated_at": full_msg.updated_at.isoformat(),
            "message_type": full_msg.message_type.value,
            "edited": True,
            "sender_username": full_msg.sender.username,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error editing message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to edit message: {str(e)}")

# Delete image from Cloudinary only
@router.post("/delete-image")
async def delete_cloudinary_image(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Delete image from Cloudinary only
    """
    try:
        public_id = data.get("public_id")
        if not public_id:
            raise HTTPException(status_code=400, detail="public_id required")

        cloudinary.uploader.destroy(public_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloudinary delete failed: {str(e)}")