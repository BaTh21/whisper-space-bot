from __future__ import annotations
from typing import Dict, List, Set, Optional
from fastapi import WebSocket
from datetime import datetime, timezone
import asyncio

class WebSocketGateway:
    def __init__(self):
        self.rooms: Dict[str, Dict[WebSocket, int]] = {}

    async def connect(self, room: str, ws: WebSocket, user_id: int):
        self.rooms.setdefault(room, {})[ws] = user_id

    def disconnect(self, room: str, ws: WebSocket):
        self.rooms.get(room, {}).pop(ws, None)

    async def broadcast(self, room: str, payload: dict, exclude=set()):
        for ws in list(self.rooms.get(room, {}).keys()):
            if ws in exclude:
                continue
            try:
                await ws.send_json(payload)
            except:
                self.disconnect(room, ws)

    async def send_to_user(self, room: str, user_id: int, payload: dict):
        for ws, uid in self.rooms.get(room, {}).items():
            if uid == user_id:
                await ws.send_json(payload)