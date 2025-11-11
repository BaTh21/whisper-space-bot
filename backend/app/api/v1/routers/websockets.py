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

router = APIRouter(prefix="/ws", tags=["websockets"])


def _chat_id(user_a: int, user_b: int) -> str:
    a, b = sorted([user_a, user_b])
    return f"private_{a}_{b}"


@router.websocket("/private/{friend_id}")
async def ws_private_chat(
        websocket: WebSocket,
        friend_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        if not is_friend(db, current_user.id, friend_id):
            await websocket.close(code=4003, reason="Not friends")
            return

        chat_id = _chat_id(current_user.id, friend_id)
        await manager.connect(chat_id, websocket)

        try:
            while True:
                data = await websocket.receive_json()
                if data.get("type") == "message" and data.get("content"):
                    msg = create_private_message(db, current_user.id, friend_id, data["content"])
                    await manager.broadcast(chat_id, MessageOut.from_orm(msg).dict())
        except WebSocketDisconnect:
            manager.disconnect(chat_id, websocket)
        except Exception as e:
            print(f"[WS Error] {e}")
            manager.disconnect(chat_id, websocket)
        
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


