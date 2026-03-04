from __future__ import annotations
from typing import Dict, List, Set, Optional
from fastapi import WebSocket
from datetime import datetime, timezone
import asyncio

from typing import Dict, Set, Optional
from datetime import datetime, timezone
import asyncio
from fastapi import WebSocket

import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[WebSocket, dict]] = {}
        self.online_users: Dict[str, Set[int]] = {}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.user_chats: Dict[int, Set[str]] = {}
        self.last_activity: Dict[int, datetime] = {}
        self.active_calls: Dict[str, dict] = {}
        self.group_call_accepts: Dict[str, Set[int]] = {}
        self.group_call_sessions: Dict[str, dict] = {}
        self.call_timers: Dict[str, asyncio.Task] = {}

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: int):
        self.active_connections.setdefault(chat_id, {})[websocket] = {"user_id": user_id, "connected_at": datetime.now(timezone.utc)}
        self.online_users.setdefault(chat_id, set()).add(user_id)
        self.user_connections.setdefault(user_id, set()).add(websocket)
        self.user_chats.setdefault(user_id, set()).add(chat_id)
        self.last_activity[user_id] = datetime.now(timezone.utc)

        await self._update_user_online_status_db(user_id, True)

        await self.broadcast(chat_id, {
            "type": "user_online",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude={websocket})

        await websocket.send_json({
            "type": "online_users",
            "user_ids": list(self.online_users.get(chat_id, set())),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    def disconnect(self, chat_id: str, websocket: WebSocket, user_id: Optional[int] = None):
        if chat_id in self.active_connections and websocket in self.active_connections[chat_id]:
            info = self.active_connections[chat_id].pop(websocket)
            user_id = user_id or info["user_id"]
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

        if user_id is not None:
            if chat_id in self.online_users:
                self.online_users[chat_id].discard(user_id)
                if not self.online_users[chat_id]:
                    del self.online_users[chat_id]
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            if user_id in self.user_chats:
                self.user_chats[user_id].discard(chat_id)
                if not self.user_chats[user_id]:
                    asyncio.create_task(self._handle_user_offline(user_id))

    async def _handle_user_offline(self, user_id: int):
        await asyncio.sleep(3)
        if self.user_chats.get(user_id):
            return
        await self._update_user_online_status_db(user_id, False)
        await self._broadcast_user_offline(user_id)
        self.last_activity.pop(user_id, None)
        self.user_chats.pop(user_id, None)

    async def _broadcast_user_offline(self, user_id: int):
        offline_time = datetime.now(timezone.utc)
        chats_to_notify = {chat_id for chat_id, users in self.online_users.items() if user_id in users}
        for chat_id in chats_to_notify:
            await self.broadcast(chat_id, {
                "type": "user_offline",
                "user_id": user_id,
                "timestamp": offline_time.isoformat(),
                "last_seen": offline_time.isoformat()
            })

    async def broadcast(self, chat_id: str, message: dict, exclude: Set[WebSocket] = None):
        if chat_id not in self.active_connections:
            return
        exclude = exclude or set()
        dead_connections = set()
        for ws in list(self.active_connections[chat_id].keys()):
            if ws in exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.add(ws)
        for ws in dead_connections:
            self.disconnect(chat_id, ws)

    async def send_to_user(self, user_id: int, message: dict):
        if user_id not in self.user_connections:
            return False
        sent = False
        for ws in list(self.user_connections[user_id]):
            try:
                await ws.send_json(message)
                sent = True
            except:
                self.disconnect(None, ws, user_id)
        return sent

    def get_online_users(self, chat_id: str) -> Set[int]:
        return self.online_users.get(chat_id, set())

    def is_user_online(self, user_id: int) -> bool:
        return bool(self.user_chats.get(user_id))

    def get_user_chats(self, user_id: int) -> Set[str]:
        return self.user_chats.get(user_id, set())

    async def update_user_activity(self, user_id: int):
        self.last_activity[user_id] = datetime.now(timezone.utc)
        await self._update_user_online_status_db(user_id, True)

    def get_user_last_activity(self, user_id: int) -> Optional[datetime]:
        return self.last_activity.get(user_id)

    def mark_user_accepted(self, chat_id: str, user_id: int):
        self.group_call_accepts.setdefault(chat_id, set()).add(user_id)

    def remove_user_accepted(self, chat_id: str, user_id: int):
        if chat_id in self.group_call_accepts:
            self.group_call_accepts[chat_id].discard(user_id)
            if not self.group_call_accepts[chat_id]:
                del self.group_call_accepts[chat_id]

    def get_total_accepted(self, chat_id: str) -> int:
        return len(self.group_call_accepts.get(chat_id, set()))

    async def end_group_call(self, chat_id: str, db, reason: str = "ended"):
        session = self.group_call_sessions.get(chat_id)
        if not session:
            return
        end_time = datetime.utcnow()
        message_id = session.get("start_message_id")
        msg_content = None

        if message_id:
            msg = db.query(session.get("message_model")).filter_by(id=message_id).first()
            if msg:
                starter = session.get("starter_name", "Someone")
                call_type = session.get("call_type", "call")
                type_text = "video call" if call_type == "video" else "voice call"
                msg.call_content = f"{starter} {reason} the {type_text}"
                msg.updated_at = end_time
                db.commit()
                msg_content = msg.call_content

        await self.broadcast(chat_id, {
            "type": "call_end",
            "call_message_id": message_id,
            "call_content": msg_content,
            "can_join": False,
            "updated_at": end_time.isoformat()
        })

        self.group_call_accepts.pop(chat_id, None)
        self.group_call_sessions.pop(chat_id, None)
        timer = self.call_timers.pop(chat_id, None)
        if timer:
            timer.cancel()

    async def _update_user_online_status_db(self, user_id: int, is_online: bool):
        pass

manager = WebSocketManager()
