from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import is_friend
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageOut
from app.crud.chat import create_private_message, delete_message_forever, edit_private_message, get_private_messages
from app.services.websocket_manager import manager
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.routers.websockets import _chat_id
from app.models.private_message import PrivateMessage

router = APIRouter()


@router.get("/private/{friend_id}", response_model=List[MessageOut])
async def get_private_chat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    messages = db.query(PrivateMessage).filter(
        ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend_id)) |
        ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.receiver_id == current_user.id))
    ).order_by(PrivateMessage.created_at.asc()).all()
    
    # Convert to MessageOut with reply data
    result = []
    for msg in messages:
        msg_out = MessageOut(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            content=msg.content,
            message_type=msg.message_type.value,
            is_read=msg.is_read,
            reply_to_id=msg.reply_to_id,
            created_at=msg.created_at.isoformat() if msg.created_at else None
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
                created_at=msg.reply_to.created_at.isoformat() if msg.reply_to.created_at else None
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
    )
    
    # Get the full message with reply data
    full_msg = db.query(PrivateMessage).filter(PrivateMessage.id == msg.id).first()
    
    chat_id = f"private_{min(current_user.id, friend_id)}_{max(current_user.id, friend_id)}"
    
    # Prepare broadcast data with reply info
    broadcast_data = {
        "id": full_msg.id,
        "sender_id": full_msg.sender_id,
        "receiver_id": full_msg.receiver_id,
        "content": full_msg.content,
        "message_type": full_msg.message_type.value,
        "is_read": full_msg.is_read,
        "reply_to_id": full_msg.reply_to_id,
        "created_at": full_msg.created_at.isoformat() if full_msg.created_at else None
    }
    
    # Add reply_to data if exists
    if full_msg.reply_to:
        broadcast_data["reply_to"] = {
            "id": full_msg.reply_to.id,
            "sender_id": full_msg.reply_to.sender_id,
            "content": full_msg.reply_to.content,
            "created_at": full_msg.reply_to.created_at.isoformat() if full_msg.reply_to.created_at else None
        }
    
    await manager.broadcast(chat_id, broadcast_data)
    
    # Return the full message with reply data
    return MessageOut(
        id=full_msg.id,
        sender_id=full_msg.sender_id,
        receiver_id=full_msg.receiver_id,
        content=full_msg.content,
        message_type=full_msg.message_type.value,
        is_read=full_msg.is_read,
        reply_to_id=full_msg.reply_to_id,
        reply_to=MessageOut(
            id=full_msg.reply_to.id,
            sender_id=full_msg.reply_to.sender_id,
            receiver_id=full_msg.reply_to.receiver_id,
            content=full_msg.reply_to.content,
            message_type=full_msg.reply_to.message_type.value,
            is_read=full_msg.reply_to.is_read,
            created_at=full_msg.reply_to.created_at.isoformat() if full_msg.reply_to.created_at else None
        ) if full_msg.reply_to else None,
        created_at=full_msg.created_at.isoformat() if full_msg.created_at else None
    )
    
@router.patch("/private/{message_id}", response_model=MessageOut)
async def edit_message(message_id: int, data: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = edit_private_message(db, message_id, current_user.id, data.content)
    message_out = MessageOut.from_orm(msg)
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