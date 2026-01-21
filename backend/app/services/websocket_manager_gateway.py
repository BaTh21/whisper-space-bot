from __future__ import annotations
from typing import Dict, Set, Optional, List
from datetime import datetime, timezone
import asyncio
from fastapi import WebSocket
from app.services.ws_manager_group import manager as group_manager
from app.services.websocket_manager import manager as private_manager

class WebSocketGateway:
    def __init__(self):
        # Active calls by chat_id (private or group)
        self.active_calls: Dict[str, dict] = {}
        self.call_accepts: Dict[str, Set[int]] = {}   # Users who joined / accepted
        self.call_timers: Dict[str, asyncio.Task] = {}

    def is_group_chat(self, chat_id: str) -> bool:
        return chat_id.startswith("group_")

    def get_call(self, chat_id: str) -> Optional[dict]:
        return self.active_calls.get(chat_id)

    async def start_call(
        self,
        chat_id: str,
        caller_id: int,
        call_type: str,
        db,
        extra_data: Optional[dict] = None
    ):
        if chat_id in self.active_calls:
            raise Exception("Call already in progress")

        # Initialize accepted users set
        self.call_accepts[chat_id] = {caller_id}

        # Auto cancel if nobody answers in 30s
        timeout_task = asyncio.create_task(self._auto_cancel(chat_id))
        self.call_timers[chat_id] = timeout_task

        # Save call info
        self.active_calls[chat_id] = {
            "caller": caller_id,
            "call_type": call_type,
            "status": "ringing",
            "is_group": self.is_group_chat(chat_id),
            **(extra_data or {})
        }

        # Broadcast call request
        message = {
            "type": "call_request",
            "from_user": caller_id,
            "call_type": call_type,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast_to_chat(chat_id, message)

    # ---------------- Auto Cancel ----------------
    async def _auto_cancel(self, chat_id: str):
        await asyncio.sleep(30)
        call = self.active_calls.get(chat_id)
        if call and call["status"] == "ringing":
            await self.end_call(chat_id, reason="timeout")

    # ---------------- End Call ----------------
    async def end_call(self, chat_id: str, reason: str = "ended", ended_by: Optional[int] = None):
        call = self.active_calls.pop(chat_id, None)
        participants = self.call_accepts.pop(chat_id, set())

        # Cancel timer
        timer = self.call_timers.pop(chat_id, None)
        if timer:
            timer.cancel()

        # Broadcast to all participants
        message = {
            "type": "call_ended",
            "reason": reason,
            "ended_by": ended_by,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self._broadcast_to_call_participants(chat_id, participants, message)

    # ---------------- Join / Leave ----------------
    def join_call(self, chat_id: str, user_id: int):
        if chat_id not in self.call_accepts:
            self.call_accepts[chat_id] = set()
        self.call_accepts[chat_id].add(user_id)

    def leave_call(self, chat_id: str, user_id: int):
        if chat_id in self.call_accepts:
            self.call_accepts[chat_id].discard(user_id)

    # ---------------- Broadcast ----------------
    async def broadcast_to_chat(self, chat_id: str, message: dict):
        is_group = self.is_group_chat(chat_id)
        if is_group:
            await group_manager.broadcast(chat_id, message)
        else:
            # Extract private users from chat_id format: "private_{user1}_{user2}"
            parts = chat_id.split("_")
            if len(parts) == 3:
                uid1, uid2 = int(parts[1]), int(parts[2])
                for uid in (uid1, uid2):
                    await private_manager.send_to_user(uid, message)

    async def _broadcast_to_call_participants(self, chat_id: str, participants: Set[int], message: dict):
        for uid in participants:
            if uid in private_manager.user_connections:
                await private_manager.send_to_user(uid, message)
            else:
                # send to user in any group they're online in
                for g_chat in group_manager.active_connections:
                    if uid in group_manager.get_online_users(g_chat):
                        await group_manager.send_to_user(g_chat, uid, message)

    # ---------------- WebRTC Signals ----------------
    async def send_offer(self, chat_id: str, from_user: int, to_user: int, offer: str):
        message = {
            "type": "call_offer",
            "from_user": from_user,
            "offer": offer,
            "call_type": self.active_calls[chat_id]["call_type"]
        }
        await self._send_to_user(chat_id, to_user, message)

    async def send_answer(self, chat_id: str, from_user: int, to_user: int, answer: str):
        message = {
            "type": "call_answer",
            "from_user": from_user,
            "answer": answer
        }
        await self._send_to_user(chat_id, to_user, message)

    async def send_ice(self, chat_id: str, from_user: int, to_user: int, candidate: str):
        message = {
            "type": "call_ice",
            "from_user": from_user,
            "candidate": candidate
        }
        await self._send_to_user(chat_id, to_user, message)

    # ---------------- Helpers ----------------
    async def _send_to_user(self, chat_id: str, user_id: int, message: dict):
        if user_id in private_manager.user_connections:
            await private_manager.send_to_user(user_id, message)
        else:
            for g_chat in group_manager.active_connections:
                if user_id in group_manager.get_online_users(g_chat):
                    await group_manager.send_to_user(g_chat, user_id, message)

manager_gateway = WebSocketGateway()