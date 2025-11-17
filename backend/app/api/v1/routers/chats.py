import os
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import is_friend
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageOut
from app.crud.chat import create_private_message, delete_message_forever, edit_private_message, mark_messages_as_read
from app.services.websocket_manager import manager
from datetime import datetime, timezone
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.routers.websockets import _chat_id
from app.models.private_message import PrivateMessage
import cloudinary
import cloudinary.uploader
import uuid

router = APIRouter()

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

def _chat_id(a, b):
    return f"private_{min(a, b)}_{max(a, b)}"

def extract_public_id_from_url(url: str) -> str:
    """
    Extract public_id from Cloudinary URL
    Example: https://res.cloudinary.com/demo/image/upload/v1234567/chat_images/abc123.jpg
    -> chat_images/abc123
    """
    try:
        # Split URL and get the path after /upload/
        parts = url.split('/upload/')
        if len(parts) < 2:
            return None
        
        # Get the part after /upload/ and remove version and file extension
        path_parts = parts[1].split('/')
        if not path_parts:
            return None
        
        # The last part is the filename with version
        filename = path_parts[-1]
        
        # Remove version prefix (v1234567_) and file extension
        if '_' in filename:
            filename = filename.split('_', 1)[1]
        
        # Remove file extension
        filename = filename.rsplit('.', 1)[0]
        
        # Reconstruct public_id with folder
        if len(path_parts) > 1:
            folder = '/'.join(path_parts[:-1])
            return f"{folder}/{filename}"
        else:
            return filename
            
    except Exception:
        return None

# Mark messages as read endpoint
@router.post("/messages/read")
async def mark_messages_as_read_endpoint(
    message_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark multiple messages as read
    """
    try:
        count = mark_messages_as_read(db, message_ids, current_user.id)
        
        # Notify sender via WebSocket that messages were read
        for message_id in message_ids:
            message = db.query(PrivateMessage).filter(PrivateMessage.id == message_id).first()
            if message:
                chat_id = _chat_id(message.sender_id, message.receiver_id)
                await manager.broadcast(chat_id, {
                    "type": "read_receipt",
                    "message_id": message_id,
                    "read_at": message.read_at.isoformat() if message.read_at else None
                })
        
        return {"status": "success", "marked_count": count}
    except Exception as e:
        raise HTTPException(500, f"Failed to mark messages as read: {str(e)}")

# Get private chat messages
@router.get("/private/{friend_id}", response_model=List[MessageOut])
async def get_private_chat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Join with User table to get sender and receiver usernames
    messages = db.query(PrivateMessage).join(
        User, PrivateMessage.sender_id == User.id
    ).filter(
        ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend_id)) |
        ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == current_user.id))
    ).order_by(PrivateMessage.created_at.asc()).all()
    
    # Convert to MessageOut with user data
    result = []
    for msg in messages:
        msg_out = MessageOut(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            content=msg.content,
            message_type=msg.message_type.value,
            is_read=msg.is_read,
            read_at=msg.read_at.isoformat() if msg.read_at else None,
            delivered_at=msg.delivered_at.isoformat() if msg.delivered_at else None,
            reply_to_id=msg.reply_to_id,
            is_forwarded=msg.is_forwarded,
            original_sender=msg.original_sender,
            created_at=msg.created_at.isoformat() if msg.created_at else None,
            sender_username=msg.sender.username if msg.sender else "Unknown User",
            receiver_username=msg.receiver.username if msg.receiver else "Unknown User"
        )
        
        # Add reply_to data if exists
        if msg.reply_to:
            msg_out.reply_to = MessageOut(
                id=msg.reply_to.id,
                sender_id=msg.reply_to.sender_id,
                receiver_id=msg.reply_to.receiver_id,
                content=msg.reply_to.content,
                message_type=msg.reply_to.message_type.value,
                is_read=msg.reply_to.is_read,
                read_at=msg.reply_to.read_at.isoformat() if msg.reply_to.read_at else None,
                delivered_at=msg.reply_to.delivered_at.isoformat() if msg.reply_to.delivered_at else None,
                is_forwarded=msg.reply_to.is_forwarded,
                original_sender=msg.reply_to.original_sender,
                created_at=msg.reply_to.created_at.isoformat() if msg.reply_to.created_at else None,
                sender_username=msg.reply_to.sender.username if msg.reply_to.sender else "Unknown User",
                receiver_username=msg.reply_to.receiver.username if msg.reply_to.receiver else "Unknown User"
            )
        
        result.append(msg_out)
    
    return result

# Send text message
@router.post("/private/{friend_id}", response_model=MessageOut)
async def send_private_message(
    friend_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(403, "Not friends")

    msg = create_private_message(
        db,
        current_user.id,
        friend_id,
        msg_in.content,
        msg_in.message_type,
        msg_in.reply_to_id,
        msg_in.is_forwarded,
        msg_in.original_sender
    )
    
    # Get the full message with user relationships
    full_msg = db.query(PrivateMessage).options(
        joinedload(PrivateMessage.sender),
        joinedload(PrivateMessage.receiver)
    ).filter(PrivateMessage.id == msg.id).first()
    
    chat_id = _chat_id(current_user.id, friend_id)
    
    # Prepare broadcast data with username info
    broadcast_data = {
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
        "created_at": full_msg.created_at.isoformat() if full_msg.created_at else None,
        "sender_username": full_msg.sender.username if full_msg.sender else "Unknown User",
        "receiver_username": full_msg.receiver.username if full_msg.receiver else "Unknown User"
    }
    
    # Add reply_to data if exists (with usernames)
    if full_msg.reply_to:
        broadcast_data["reply_to"] = {
            "id": full_msg.reply_to.id,
            "sender_id": full_msg.reply_to.sender_id,
            "content": full_msg.reply_to.content,
            "is_forwarded": full_msg.reply_to.is_forwarded,
            "original_sender": full_msg.reply_to.original_sender,
            "created_at": full_msg.reply_to.created_at.isoformat() if full_msg.reply_to.created_at else None,
            "is_read": full_msg.reply_to.is_read,
            "read_at": full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,
            "delivered_at": full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,
            "sender_username": full_msg.reply_to.sender.username if full_msg.reply_to.sender else "Unknown User"
        }
    
    await manager.broadcast(chat_id, broadcast_data)
    
    # Return the full message with username data
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
        sender_username=full_msg.sender.username if full_msg.sender else "Unknown User",
        receiver_username=full_msg.receiver.username if full_msg.receiver else "Unknown User",
        reply_to=MessageOut(
            id=full_msg.reply_to.id,
            sender_id=full_msg.reply_to.sender_id,
            receiver_id=full_msg.reply_to.receiver_id,
            content=full_msg.reply_to.content,
            message_type=full_msg.reply_to.message_type.value,
            is_read=full_msg.reply_to.is_read,
            read_at=full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,
            delivered_at=full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,
            is_forwarded=full_msg.reply_to.is_forwarded,
            original_sender=full_msg.reply_to.original_sender,
            created_at=full_msg.reply_to.created_at.isoformat() if full_msg.reply_to.created_at else None,
            sender_username=full_msg.reply_to.sender.username if full_msg.reply_to.sender else "Unknown User"
        ) if full_msg.reply_to else None,
        created_at=full_msg.created_at.isoformat() if full_msg.created_at else None
    )

# Send image message
@router.post("/private/{friend_id}/image")
async def send_image_message(
    friend_id: int,
    image_url: str = Form(...),
    message_type: str = Form(default="image"),
    reply_to_id: int = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(403, "Not friends")

    # Create message with image URL as content
    msg = create_private_message(
        db,
        current_user.id,
        friend_id,
        image_url,
        message_type,
        reply_to_id,
        False,
        None
    )
    
    # Get the full message with user relationships
    full_msg = db.query(PrivateMessage).options(
        joinedload(PrivateMessage.sender),
        joinedload(PrivateMessage.receiver)
    ).filter(PrivateMessage.id == msg.id).first()
    
    chat_id = _chat_id(current_user.id, friend_id)
    
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
        "created_at": full_msg.created_at.isoformat() if full_msg.created_at else None,
        "sender_username": full_msg.sender.username if full_msg.sender else "Unknown User",
        "receiver_username": full_msg.receiver.username if full_msg.receiver else "Unknown User"
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
        sender_username=full_msg.sender.username if full_msg.sender else "Unknown User",
        receiver_username=full_msg.receiver.username if full_msg.receiver else "Unknown User",
        created_at=full_msg.created_at.isoformat() if full_msg.created_at else None
    )

# Upload image to Cloudinary
@router.post("/private/{friend_id}/upload")
async def upload_image_to_cloudinary(
    friend_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(403, "Not friends")

    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files allowed")

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
        raise HTTPException(500, f"Upload failed: {str(e)}")

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
        # Get the message
        message = db.query(PrivateMessage).filter(
            PrivateMessage.id == message_id,
            (PrivateMessage.sender_id == current_user.id) | (PrivateMessage.receiver_id == current_user.id)
        ).first()
        
        if not message:
            raise HTTPException(404, "Message not found")
        
        # Check if user has permission to delete (only sender can delete)
        if message.sender_id != current_user.id:
            raise HTTPException(403, "Can only delete your own messages")
        
        # Check if it's an image message
        if message.message_type.value != 'image':
            raise HTTPException(400, "Not an image message")
        
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
        
        # Delete the message from database
        db.delete(message)
        db.commit()
        
        # Notify via WebSocket
        await manager.broadcast(chat_id, {
            "type": "message_deleted",
            "message_id": message_id,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"status": "success", "message": "Image message deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete image message: {str(e)}")

# Enhanced delete endpoint for all message types
@router.delete("/private/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_forever_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enhanced delete to handle image messages
    """
    # Get the message first
    message = db.query(PrivateMessage).filter(PrivateMessage.id == message_id).first()
    
    if not message:
        raise HTTPException(404, "Message not found")
    
    # Check permissions
    if message.sender_id != current_user.id:
        raise HTTPException(403, "Can only delete your own messages")
    
    # If it's an image message, delete from Cloudinary first
    if message.message_type.value == 'image':
        image_url = message.content
        public_id = extract_public_id_from_url(image_url)
        
        if public_id:
            try:
                cloudinary.uploader.destroy(public_id)
            except Exception as e:
                print(f"Cloudinary deletion failed: {str(e)}")
                # Continue with message deletion
    
    # Store info for broadcast
    chat_id = _chat_id(message.sender_id, message.receiver_id)
    
    # Delete from database
    db.delete(message)
    db.commit()
    
    # Broadcast deletion
    await manager.broadcast(chat_id, {
        "type": "message_deleted", 
        "message_id": message_id,
        "deleted_at": datetime.now(timezone.utc).isoformat()
    })
    
    return None

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
    message = db.query(PrivateMessage).filter(
        PrivateMessage.id == message_id,
        (PrivateMessage.sender_id == current_user.id) | (PrivateMessage.receiver_id == current_user.id)
    ).first()
    
    if not message:
        raise HTTPException(404, "Message not found")
    
    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "content": message.content,
        "message_type": message.message_type.value,
        "created_at": message.created_at.isoformat(),
        "is_own_message": message.sender_id == current_user.id
    }

# Edit message endpoint
@router.patch("/private/{message_id}")
async def edit_message(
    message_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = edit_private_message(db, message_id, current_user.id, data.content.strip())

    chat_id = _chat_id(msg.sender_id, msg.receiver_id)
    payload = {
        "type": "edit",
        "id": msg.id,
        "content": msg.content,
        "updated_at": msg.updated_at.isoformat(),
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "sender_username": msg.sender.username if msg.sender else None,
        "receiver_username": msg.receiver.username if msg.receiver else None,
    }

    await manager.broadcast(chat_id, payload)
    return payload

# Delete image from Cloudinary only
@router.post("/delete-image")
async def delete_cloudinary_image(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    public_id = data.get("public_id")
    if not public_id:
        raise HTTPException(400, "public_id required")

    try:
        cloudinary.uploader.destroy(public_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, f"Cloudinary delete failed: {str(e)}")