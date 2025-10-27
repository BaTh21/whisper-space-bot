from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.friend import is_friend
from app.crud.chat import create_private_message
from app.models.user import User
from app.schemas.chat import MessageOut
from app.services.websocket_manager import manager

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