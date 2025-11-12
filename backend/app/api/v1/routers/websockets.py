from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user, get_current_user_ws
from app.crud.friend import is_friend
from app.crud.chat import create_private_message, is_group_member, create_group_message
from app.models.user import User
from app.schemas.chat import MessageOut, GroupMessageOut
from app.services.websocket_manager import manager
from app.models.group_message import MessageType
from app.schemas.chat import MessageCreate, AuthorResponse
import json
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
    # === WebSocket Auth: Manual token from query params ===
    current_user: User | None = await get_current_user_ws(websocket, db)
    if not current_user:
        return  # Already closed with code 4401/4403/4404

    # === Friendship Check ===
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

            # === Handle Incoming Message ===
            if msg_type == "message" and content and content.strip():
                # Create message in DB
                msg = create_private_message(
                    db=db,
                    sender_id=current_user.id,
                    receiver_id=friend_id,
                    content=content.strip()
                )

                # Prepare response
                message_out = MessageOut.from_orm(msg)

                # Broadcast to both users
                await manager.broadcast(chat_id, message_out.dict())

            elif msg_type == "read":
                # Optional: Mark as read
                pass

    except WebSocketDisconnect:
        print(f"[WS] Private Chat Disconnected: User {current_user.id}")
        manager.disconnect(chat_id, websocket)
    except Exception as e:
        print(f"[WS] Private Chat Error: {e}")
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

            if msg_type == "message" and content:
                if message_type in ["image", "file"]:
                    filename = data.get("filename", "upload")
                    # Extract base64 content
                    if content.startswith("data:"):
                        header, base64_data = content.split(",", 1)
                        file_bytes = base64.b64decode(base64_data)
                    else:
                        file_bytes = base64.b64decode(content)

                    configure_cloudinary()
                    upload_result = upload_to_cloudinary(
                        file_bytes,
                        folder=f"group_{group_id}"
                    )

                    content = upload_result.get("secure_url")

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


