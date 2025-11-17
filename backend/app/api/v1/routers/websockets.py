from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect,Query
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user, get_current_user_ws
from app.crud.friend import is_friend
from app.crud.chat import create_private_message, is_group_member, create_group_message, mark_message_as_read
from app.models.user import User
from app.schemas.chat import MessageOut, GroupMessageOut
from app.services.websocket_manager import manager
from app.models.group_message import MessageType
from app.schemas.chat import MessageCreate, AuthorResponse
import json
from app.models.group_message_reply import GroupMessageReply

from app.api.v1.routers.websocket_server import handle_websocket_private
router = APIRouter()


def _chat_id(user_a: int, user_b: int) -> str:
    a, b = sorted([user_a, user_b])
    return f"private_{a}_{b}"


@router.websocket("/private/{friend_id}")
async def ws_private_chat(
    websocket: WebSocket,
    friend_id: int,
    db: Session = Depends(get_db)
):
    current_user: User | None = await get_current_user_ws(websocket, db)
    if not current_user:
        return

    if not is_friend(db, current_user.id, friend_id):
        await websocket.close(code=4003, reason="Not friends")
        return

    chat_id = _chat_id(current_user.id, friend_id)
    await manager.connect(chat_id, websocket)

    print(f"[WS] Private Chat Connected: User {current_user.id} ↔ Friend {friend_id}")

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "error": "Invalid JSON"
                }))
                continue

            msg_type = data.get("type")
            content = data.get("content")
            reply_to_id = data.get("reply_to_id")

            # === Handle Incoming Message ===
            if msg_type == "message" and content and content.strip():
                # Create message in DB
                msg = create_private_message(
                    db=db,
                    sender_id=current_user.id,
                    receiver_id=friend_id,
                    content=content.strip(),
                    reply_to_id=reply_to_id
                )

                # Prepare response with proper sender info
                message_data = {
                    "type": "message",
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "sender_username": current_user.username,
                    "receiver_id": msg.receiver_id,
                    "content": msg.content,
                    "message_type": msg.message_type.value,
                    "is_read": getattr(msg, 'is_read', False),
                    "created_at": msg.created_at.isoformat() if hasattr(msg.created_at, 'isoformat') else str(msg.created_at),
                    "reply_to_id": msg.reply_to_id,
                }

                # Broadcast to both users
                await manager.broadcast(chat_id, message_data)
                print(f"[WS] Broadcasted message: {message_data}")

            elif msg_type == "read":
                # Handle read receipts with database update
                message_id = data.get("message_id")
                if message_id:
                    # Mark message as read in database
                    success = mark_message_as_read(db, message_id, current_user.id)
                    
                    if success:
                        # Broadcast read receipt to both users
                        await manager.broadcast(chat_id, {
                            "type": "read_receipt",
                            "message_id": message_id,
                            "read_by": current_user.id,
                            "read_at": datetime.utcnow().isoformat()
                        })
                        print(f"[WS] Message {message_id} marked as read by user {current_user.id}")
                    else:
                        print(f"[WS] Failed to mark message {message_id} as read")

    except WebSocketDisconnect:
        print(f"[WS] Private Chat Disconnected: User {current_user.id}")
        manager.disconnect(chat_id, websocket)
    except Exception as e:
        print(f"[WS] Private Chat Error: {e}")
        import traceback
        traceback.print_exc()  # This will show the full error stack
        manager.disconnect(chat_id, websocket)
        await websocket.close(code=1011, reason="Server error")
        
@router.websocket("/group/{group_id}")
async def ws_group_chat(
    websocket: WebSocket,
    group_id: int,
    db: Session = Depends(get_db)
):
    current_user = await get_current_user_ws(websocket, db)
    if not current_user:
        return

    if not is_group_member(db, group_id, current_user.id):
        await websocket.close(code=4003, reason="Not a member of this group")
        return

    chat_id = f"group_{group_id}"
    await manager.connect(chat_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            message_type = data.get("message_type", "text")
            content = data.get("content")
            reply_to_id = data.get("reply_to")
                    
            if reply_to_id:
                    reply = GroupMessageReply(
                        message_id=reply_to_id,
                        sender_id=current_user.id,
                        content=content,
                        message_type=MessageType(message_type)
                    )
                    db.add(reply)
                    db.commit()
                    db.refresh(reply)

                    # Prepare reply output
                    msg_out = {
                        "id": reply.id,
                        "sender": {"id": current_user.id, "username": current_user.username},
                        "group_id": group_id,
                        "content": reply.content,
                        "message_type": reply.message_type.value,
                        "created_at": reply.created_at.isoformat(),
                        "reply_to_message": {
                            "id": parent_msg.id,
                            "content": parent_msg.content,
                            "message_type": parent_msg.message_type.value,
                            "sender": {
                                "id": parent_msg.sender.id,
                                "username": parent_msg.sender.username,
                                "avatar_url": parent_msg.sender.avatar_url
                            }
                        }
                    }
                    
                    await manager.broadcast(chat_id, msg_out)
                    
            else:
                # Create and save the message
                    msg = create_group_message(
                        db,
                        sender_id=current_user.id,
                        group_id=group_id,
                        content=content,
                        message_type=MessageType(message_type)
                    )

                    msg_out = GroupMessageOut(
                        id=msg.id,
                        sender=AuthorResponse(
                            id=msg.sender.id,
                            username=msg.sender.username
                        ),
                        group_id=msg.group_id,
                        content=msg.content,
                        created_at=msg.created_at,
                        message_type=msg.message_type.value
                    )

                    await manager.broadcast(chat_id, msg_out.dict())

    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
    except Exception as e:
        manager.disconnect(chat_id, websocket)
        print(f"[WS Error] {e}")

@router.websocket("/private/{friend_id}")
async def websocket_private_chat(
    websocket: WebSocket,
    friend_id: int,
    token: str = Query(..., description="JWT token")
):
    """
    WebSocket endpoint for private chat with a friend
    """
    await handle_websocket_private(websocket, friend_id, token)