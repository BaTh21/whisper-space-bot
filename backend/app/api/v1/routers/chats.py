from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import is_friend
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageOut
from app.crud.chat import create_private_message, delete_message_for_user, edit_private_message, get_private_messages, unsend_private_message
from app.services.websocket_manager import manager
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.routers.websockets import _chat_id

router = APIRouter()


@router.get("/private/{friend_id}", response_model=List[MessageOut])
def get_private_chat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(403, "Not friends")
    messages = get_private_messages(db, current_user.id, friend_id)
    return [MessageOut.from_orm(m) for m in messages]


@router.post("/private/{friend_id}", response_model=MessageOut)
async def send_private_message(
    friend_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_friend(db, current_user.id, friend_id):
        raise HTTPException(403, "Not friends")
    
    msg = create_private_message(db, current_user.id, friend_id, msg_in.content, msg_in.message_type)
    
    chat_id = f"private_{min(current_user.id, friend_id)}_{max(current_user.id, friend_id)}"
    await manager.broadcast(chat_id, {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "content": msg.content,
        "message_type": msg.message_type.value,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    })
    
    return MessageOut(
    id=msg.id,
    sender_id=msg.sender_id,
    receiver_id=msg.receiver_id,
    content=msg.content,
    message_type=msg.message_type.value,
    is_read=msg.is_read,
    created_at=(
        msg.created_at.replace(tzinfo=timezone.utc).isoformat()
        if msg.created_at.tzinfo is None
        else msg.created_at.astimezone(timezone.utc).isoformat()
    ).replace("+00:00", "Z")  # ← Force "Z" suffix
)
    
@router.patch("/private/{message_id}", response_model=MessageOut)
async def edit_message(message_id: int, data: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = edit_private_message(db, message_id, current_user.id, data.content)
    message_out = MessageOut.from_orm(msg)
    chat_id = _chat_id(msg.sender_id, msg.receiver_id)
    await manager.broadcast(chat_id, message_out.dict())
    return message_out

@router.delete("/private/{message_id}/unsend", response_model=MessageOut)
async def unsend_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = unsend_private_message(db, message_id, current_user.id)
    message_out = MessageOut.from_orm(msg)
    chat_id = _chat_id(msg.sender_id, msg.receiver_id)
    await manager.broadcast(chat_id, message_out.dict())
    return message_out

@router.delete("/private/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_message_for_user(db, message_id, current_user.id)
    return None  