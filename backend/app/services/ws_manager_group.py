from __future__ import annotations
from typing import Dict, Set
from fastapi import WebSocket
import asyncio

class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket, dict]] = {}
        self.online_users: Dict[str, Set[int]] = {}

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: int) -> None:
        self.active_connections.setdefault(chat_id, {})[websocket] = {"user_id": user_id}
        self.online_users.setdefault(chat_id, set()).add(user_id)
        
        await self.broadcast(chat_id, {
            "action": "user_online",
            "user_id": user_id
        }, exclude={websocket})
        
        await websocket.send_json({
            "action": "online_users",
            "user_ids": list(self.online_users[chat_id])
        })

    def disconnect(self, chat_id: str, websocket: WebSocket, user_id: int) -> None:
        if chat_id in self.active_connections and websocket in self.active_connections[chat_id]:
            info = self.active_connections[chat_id].pop(websocket)
            user_id = user_id or info["user_id"]
            
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]
                
        if chat_id in self.online_users:
                self.online_users[chat_id].discard(user_id)
                if not self.online_users[chat_id]:
                    del self.online_users[chat_id]
                    
        try:
            asyncio.create_task(self.broadcast(chat_id, {
                "action": "user_offline",
                "user_id": user_id,
                "remove_stream": True
            }))
        except Exception as e:
            print(f"[Disconnect Broadcast Error] {e}")

    async def broadcast(self, chat_id: str, message: dict, exclude: Set[WebSocket] = None) -> None:
        if chat_id not in self.active_connections:
            return
        exclude = exclude or set()
        dead = set()
        for ws in list(self.active_connections[chat_id].keys()):
            if ws in exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)

        for ws in dead:
            user_id = self.active_connections[chat_id][ws]["user_id"] if ws in self.active_connections[chat_id] else None
            self.disconnect(chat_id, ws, user_id)
            
    async def send_to_user(self, chat_id: str, user_id: int, message: dict, exclude: Set[WebSocket] = None) -> None:
        if chat_id not in self.active_connections:
            return

        exclude = exclude or set()

        for ws, info in self.active_connections[chat_id].items():
            if ws in exclude:
                continue
            if info["user_id"] == user_id:
                try:
                    await ws.send_json(message)
                except:
                    self.disconnect(chat_id, ws, user_id)
            
    def get_online_users(self, chat_id: str) -> Set[int]:
        return self.online_users.get(chat_id, set())

manager = WebSocketManager()