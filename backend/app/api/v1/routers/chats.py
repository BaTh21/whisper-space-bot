from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import is_friend
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageOut
from app.crud.chat import create_private_message, delete_message_forever, edit_private_message, mark_messages_as_read  # ADD mark_messages_as_read
from app.services.websocket_manager import manager
from datetime import timezone
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.routers.websockets import _chat_id
from app.models.private_message import PrivateMessage

router = APIRouter()

# ADD THIS ENDPOINT - Mark messages as read
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
            read_at=msg.read_at.isoformat() if msg.read_at else None,  # ADD THIS
            delivered_at=msg.delivered_at.isoformat() if msg.delivered_at else None,  # ADD THIS
            reply_to_id=msg.reply_to_id,
            is_forwarded=msg.is_forwarded,
            original_sender=msg.original_sender,
            created_at=msg.created_at.isoformat() if msg.created_at else None,
            # ADD USERNAME DATA
            sender_username=msg.sender.username if msg.sender else "Unknown User",  # Fix here
            receiver_username=msg.receiver.username if msg.receiver else "Unknown User"  # Fix here
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
                read_at=msg.reply_to.read_at.isoformat() if msg.reply_to.read_at else None,  # ADD THIS
                delivered_at=msg.reply_to.delivered_at.isoformat() if msg.reply_to.delivered_at else None,  # ADD THIS
                is_forwarded=msg.reply_to.is_forwarded,
                original_sender=msg.reply_to.original_sender,
                created_at=msg.reply_to.created_at.isoformat() if msg.reply_to.created_at else None,
                # ADD USERNAME DATA FOR REPLY
                sender_username=msg.reply_to.sender.username if msg.reply_to.sender else "Unknown User",  # Fix here
                receiver_username=msg.reply_to.receiver.username if msg.reply_to.receiver else "Unknown User"  # Fix here
            )
        
        result.append(msg_out)
    
    return result

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
    
    chat_id = f"private_{min(current_user.id, friend_id)}_{max(current_user.id, friend_id)}"
    
    # Prepare broadcast data with username info
    broadcast_data = {
        "id": full_msg.id,
        "sender_id": full_msg.sender_id,
        "receiver_id": full_msg.receiver_id,
        "content": full_msg.content,
        "message_type": full_msg.message_type.value,
        "is_read": full_msg.is_read,
        "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,  # ADD THIS
        "delivered_at": full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,  # ADD THIS
        "reply_to_id": full_msg.reply_to_id,
        "is_forwarded": full_msg.is_forwarded,
        "original_sender": full_msg.original_sender,
        "created_at": full_msg.created_at.isoformat() if full_msg.created_at else None,
        # ADD USERNAMES TO BROADCAST
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
            "read_at": full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,  # ADD THIS
            "delivered_at": full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,  # ADD THIS
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
        read_at=full_msg.read_at.isoformat() if full_msg.read_at else None,  # ADD THIS
        delivered_at=full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,  # ADD THIS
        reply_to_id=full_msg.reply_to_id,
        is_forwarded=full_msg.is_forwarded,
        original_sender=full_msg.original_sender,
        sender_username=full_msg.sender.username if full_msg.sender else "Unknown User",  # Add this
        receiver_username=full_msg.receiver.username if full_msg.receiver else "Unknown User",  # Add this
        reply_to=MessageOut(
            id=full_msg.reply_to.id,
            sender_id=full_msg.reply_to.sender_id,
            receiver_id=full_msg.reply_to.receiver_id,
            content=full_msg.reply_to.content,
            message_type=full_msg.reply_to.message_type.value,
            is_read=full_msg.reply_to.is_read,
            read_at=full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,  # ADD THIS
            delivered_at=full_msg.reply_to.delivered_at.isoformat() if full_msg.reply_to.delivered_at else None,  # ADD THIS
            is_forwarded=full_msg.reply_to.is_forwarded,
            original_sender=full_msg.reply_to.original_sender,
            created_at=full_msg.reply_to.created_at.isoformat() if full_msg.reply_to.created_at else None,
            sender_username=full_msg.reply_to.sender.username if full_msg.reply_to.sender else "Unknown User"  # Add this
        ) if full_msg.reply_to else None,
        created_at=full_msg.created_at.isoformat() if full_msg.created_at else None
    )

@router.patch("/private/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: int, 
    data: MessageCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    msg = edit_private_message(db, message_id, current_user.id, data.content)
    
    # Convert the message to MessageOut manually instead of using from_orm
    message_out = MessageOut(
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
        sender_username=msg.sender.username if msg.sender else "Unknown User",
        receiver_username=msg.receiver.username if msg.receiver else "Unknown User",
        created_at=msg.created_at.isoformat() if msg.created_at else None,
        updated_at=msg.updated_at.isoformat() if msg.updated_at else None
    )
    
    chat_id = _chat_id(msg.sender_id, msg.receiver_id)
    await manager.broadcast(chat_id, message_out.dict())
    return message_out

@router.delete("/private/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message_forever_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = delete_message_forever(db, message_id, current_user.id)

    chat_id = f"private_{min(current_user.id, result['receiver_id'])}_{max(current_user.id, result['receiver_id'])}"
    manager.broadcast(
        chat_id,
        {"action": "delete", "message_id": message_id},
    )
    return None