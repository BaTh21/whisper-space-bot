from __future__ import annotations
from typing import Dict, Set, Optional
from fastapi import WebSocket
import asyncio
from datetime import datetime, timezone

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.ws_user_map: Dict[WebSocket, int] = {}

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: int):
        self.active_connections.setdefault(chat_id, set()).add(websocket)
        self.user_connections.setdefault(user_id, set()).add(websocket)
        self.ws_user_map[websocket] = user_id

    def disconnect(self, chat_id: Optional[str], websocket: WebSocket, user_id: Optional[int] = None):
        if chat_id and chat_id in self.active_connections:
            self.active_connections[chat_id].discard(websocket)
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                
        self.ws_user_map.pop(websocket, None)

    async def broadcast(self, chat_id: str, message: dict, exclude: Set[WebSocket] = None):
        if chat_id not in self.active_connections:
            print("No active connections for:", chat_id)
            return
        exclude = exclude or set()
        dead_connections = set()
        for ws in list(self.active_connections[chat_id]):
            if ws in exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                print("WebSocket send error:", e)
                dead_connections.add(ws)
        for ws in dead_connections:
            user_id = self.ws_user_map.get(ws)
            self.disconnect(chat_id, ws, user_id)

    async def send_to_user(self, user_id: int, message: dict):
        if user_id not in self.user_connections:
            return False
        sent = False
        for ws in list(self.user_connections[user_id]):
            try:
                await ws.send_json(message)
                sent = True
            except Exception:
                self.disconnect(None, ws, user_id)
        return sent
    
    def get_online_users_in_chat(self, chat_id: str) -> Set[int]:
        if chat_id not in self.active_connections:
            return set()
        
        return {
            self.ws_user_map.get(ws)
            for ws in self.active_connections[chat_id]
            if ws in self.ws_user_map
        }

manager = WebSocketManager()