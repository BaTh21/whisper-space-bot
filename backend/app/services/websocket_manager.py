from __future__ import annotations
from typing import Dict, Set
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, chat_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(chat_id, set()).add(websocket)

    def disconnect(self, chat_id: str, websocket: WebSocket) -> None:
        if chat_id in self.active_connections:
            self.active_connections[chat_id].discard(websocket)
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

    async def broadcast(self, chat_id: str, message: dict) -> None:
        if chat_id not in self.active_connections:
            return
        dead = set()
        for conn in self.active_connections[chat_id]:
            try:
                await conn.send_json(message)
            except Exception:          
                dead.add(conn)
        for conn in dead:
            self.disconnect(chat_id, conn)

manager = WebSocketManager()