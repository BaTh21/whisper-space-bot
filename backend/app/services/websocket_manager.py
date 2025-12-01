from __future__ import annotations
from typing import Dict, Set, Optional
from fastapi import WebSocket
from datetime import datetime, timezone
import asyncio

class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Dict[WebSocket, dict]] = {}  # chat_id -> {websocket: user_info}
        self.online_users: Dict[str, Set[int]] = {}  # chat_id -> set of online user_ids
        self.user_chats: Dict[int, Set[str]] = {}  # user_id -> set of chat_ids they're connected to
        self.last_activity: Dict[int, datetime] = {}  # user_id -> last activity timestamp

    async def _update_user_online_status_db(self, user_id: int, is_online: bool):
        """Update user online status in database"""
        try:
            from app.core.database import SessionLocal
            from app.crud.chat import update_user_online_status
            
            db = SessionLocal()
            try:
                success = update_user_online_status(db, user_id, is_online)
                if success:
                    print(f"📊 Updated user {user_id} online status in DB: {is_online}")
                else:
                    print(f"❌ Failed to update user {user_id} online status in DB")
            except Exception as e:
                print(f"❌ Database error updating user status: {e}")
            finally:
                db.close()
        except ImportError:
            print(f"⚠️ Database modules not available, skipping DB update for user {user_id}")
        except Exception as e:
            print(f"❌ Error updating user online status in DB: {e}")

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: int) -> None:
        """Connect user to chat and broadcast online status"""
        # Initialize structures
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = {}
        
        # Store connection info
        self.active_connections[chat_id][websocket] = {
            "user_id": user_id,
            "connected_at": datetime.now(timezone.utc)
        }
        
        # Track online users
        if chat_id not in self.online_users:
            self.online_users[chat_id] = set()
        self.online_users[chat_id].add(user_id)
        
        # Track user's active chats
        if user_id not in self.user_chats:
            self.user_chats[user_id] = set()
        self.user_chats[user_id].add(chat_id)
        
        # Update last activity
        self.last_activity[user_id] = datetime.now(timezone.utc)
        
        # Update database status
        await self._update_user_online_status_db(user_id, True)
        
        # Broadcast user came online to all participants in this chat
        await self.broadcast(chat_id, {
            "type": "user_online",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude={websocket})
        
        # Send current online users to the newly connected user
        await websocket.send_json({
            "type": "online_users",
            "user_ids": list(self.online_users[chat_id]),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        print(f"✅ User {user_id} connected to chat {chat_id}. Online users: {list(self.online_users[chat_id])}")

    def disconnect(self, chat_id: str, websocket: WebSocket, user_id: Optional[int] = None) -> None:
        """Disconnect user from chat and handle offline status"""
        if chat_id in self.active_connections and websocket in self.active_connections[chat_id]:
            # Get user_id from connection info if not provided
            if user_id is None:
                user_info = self.active_connections[chat_id][websocket]
                user_id = user_info["user_id"]
            
            # Remove the connection
            del self.active_connections[chat_id][websocket]
            
            # Clean up empty chat
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]
            
            # Remove user from online users in this chat
            if chat_id in self.online_users:
                self.online_users[chat_id].discard(user_id)
                
                # Clean up empty online users set
                if not self.online_users[chat_id]:
                    del self.online_users[chat_id]
            
            # Remove chat from user's active chats
            if user_id in self.user_chats:
                self.user_chats[user_id].discard(chat_id)
                
                # If user has no more active chats, mark as offline
                if not self.user_chats[user_id]:
                    asyncio.create_task(self._handle_user_offline(user_id))
            
            print(f"📱 User {user_id} disconnected from chat {chat_id}")

    async def _handle_user_offline(self, user_id: int):
        """Handle user going offline with delay to avoid flickering"""
        # Wait 3 seconds to confirm user is really offline
        await asyncio.sleep(3)
        
        # Check if user reconnected during the delay
        if user_id in self.user_chats and self.user_chats[user_id]:
            print(f"🟢 User {user_id} reconnected, skipping offline broadcast")
            return
        
        # User is confirmed offline - update database and broadcast
        await self._update_user_online_status_db(user_id, False)
        await self._broadcast_user_offline(user_id)
        
        # Clean up
        if user_id in self.last_activity:
            del self.last_activity[user_id]
        if user_id in self.user_chats:
            del self.user_chats[user_id]
            
        print(f"🔴 User {user_id} is now offline")

    async def _broadcast_user_offline(self, user_id: int):
        """Broadcast user offline status to all relevant chats"""
        offline_time = datetime.now(timezone.utc)
        
        # Find all chats this user was part of
        chats_to_notify = set()
        for chat_id, online_set in self.online_users.items():
            if user_id in online_set:
                chats_to_notify.add(chat_id)
        
        # Broadcast offline status to each chat
        for chat_id in chats_to_notify:
            await self.broadcast(chat_id, {
                "type": "user_offline",
                "user_id": user_id,
                "timestamp": offline_time.isoformat(),
                "last_seen": offline_time.isoformat()
            })
            
        print(f"📢 Broadcasted offline status for user {user_id} to {len(chats_to_notify)} chats")

    async def broadcast(self, chat_id: str, message: dict, exclude: Set[WebSocket] = None) -> None:
        """Broadcast message to all connections in a chat"""
        if chat_id not in self.active_connections:
            return
            
        exclude = exclude or set()
        dead_connections = set()
        
        for websocket in list(self.active_connections[chat_id].keys()):
            if websocket in exclude:
                continue
            try:
                await websocket.send_json(message)
            except Exception:
                dead_connections.add(websocket)

        # Clean up dead connections
        for websocket in dead_connections:
            self.disconnect(chat_id, websocket)

    async def send_to_user(self, chat_id: str, user_id: int, message: dict) -> bool:
        """Send message to a specific user in a chat"""
        if chat_id not in self.active_connections:
            return False

        sent = False
        dead_connections = set()
        
        for websocket, info in self.active_connections[chat_id].items():
            if info["user_id"] == user_id:
                try:
                    await websocket.send_json(message)
                    sent = True
                except Exception:
                    dead_connections.add(websocket)

        # Clean up dead connections
        for websocket in dead_connections:
            self.disconnect(chat_id, websocket)
            
        return sent

    def get_online_users(self, chat_id: str) -> Set[int]:
        """Get set of online user IDs for a chat"""
        return self.online_users.get(chat_id, set())

    def is_user_online(self, user_id: int) -> bool:
        """Check if a user is online in any chat"""
        return user_id in self.user_chats and bool(self.user_chats[user_id])

    def get_user_chats(self, user_id: int) -> Set[str]:
        """Get all chats a user is currently connected to"""
        return self.user_chats.get(user_id, set())

    async def update_user_activity(self, user_id: int):
        """Update user's last activity timestamp"""
        self.last_activity[user_id] = datetime.now(timezone.utc)
        
        # Optional: Update database activity timestamp
        try:
            from app.core.database import SessionLocal
            from app.models.user import User
            
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.last_activity = datetime.now(timezone.utc)
                    db.commit()
            except Exception as e:
                print(f"❌ Error updating user activity in DB: {e}")
                db.rollback()
            finally:
                db.close()
        except ImportError:
            pass  # Skip if database not available
        except Exception as e:
            print(f"❌ Error updating user activity: {e}")

    def get_user_last_activity(self, user_id: int) -> Optional[datetime]:
        """Get user's last activity timestamp"""
        return self.last_activity.get(user_id)

    async def force_user_offline(self, user_id: int):
        """Force a user offline (e.g., on logout)"""
        # Get all chats the user is in
        user_chats = self.get_user_chats(user_id).copy()
        
        # Disconnect all their connections
        for chat_id in user_chats:
            # Find all websockets for this user in the chat
            sockets_to_disconnect = []
            for websocket, info in self.active_connections.get(chat_id, {}).items():
                if info["user_id"] == user_id:
                    sockets_to_disconnect.append(websocket)
            
            # Disconnect each socket
            for websocket in sockets_to_disconnect:
                self.disconnect(chat_id, websocket, user_id)
        
        # Update database and broadcast offline status
        await self._update_user_online_status_db(user_id, False)
        await self._broadcast_user_offline(user_id)
        
        print(f"🛑 Forcefully disconnected user {user_id} from all chats")

    async def get_user_online_status_from_db(self, user_id: int) -> Optional[dict]:
        """Get user online status from database as fallback"""
        try:
            from app.core.database import SessionLocal
            from app.crud.chat import get_user_online_status
            
            db = SessionLocal()
            try:
                status_info = get_user_online_status(db, user_id)
                return status_info
            finally:
                db.close()
        except ImportError:
            return None
        except Exception as e:
            print(f"❌ Error getting user status from DB: {e}")
            return None

    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        total_connections = sum(len(connections) for connections in self.active_connections.values())
        total_online_users = len(self.user_chats)
        total_active_chats = len(self.active_connections)
        
        return {
            "total_connections": total_connections,
            "total_online_users": total_online_users,
            "total_active_chats": total_active_chats,
            "online_users_per_chat": {
                chat_id: len(users) 
                for chat_id, users in self.online_users.items()
            }
        }

    async def health_check(self) -> dict:
        """Perform health check on WebSocket manager"""
        stats = self.get_connection_stats()
        
        # Check database connectivity
        db_healthy = False
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
            db_healthy = True
        except:
            db_healthy = False
            
        return {
            "websocket_manager": "healthy",
            "database_connection": "healthy" if db_healthy else "unhealthy",
            "stats": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

manager = WebSocketManager()