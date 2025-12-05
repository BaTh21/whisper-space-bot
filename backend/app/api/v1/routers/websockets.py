import asyncio
import json
import traceback
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user_ws, verify_token
from app.crud.friend import is_friend
from app.crud.chat import create_private_message, mark_message_as_read
from app.models.user import User
from app.models.message_seen_status import MessageSeenStatus
from app.models.private_message import PrivateMessage, MessageType
from app.models.group_message import GroupMessage
from app.models.group_message_seen import GroupMessageSeen
from app.schemas.chat import GroupMessageOut, ParentMessageResponse, AuthorResponse
from app.utils.chat_helpers import _chat_id, is_group_member, validate_reply_message
from app.crud.message import handle_forward_message, update_message, delete_message
from app.helpers.to_utc_iso import to_local_iso
from app.crud.reaction import create_reaction, delete_reaction
from app.schemas.reaction import ReactionCreate


router = APIRouter()

@router.websocket("/private/{friend_id}")
async def handle_websocket_private(
    websocket: WebSocket,
    friend_id: int,
    db: Session = Depends(get_db)
):
    
    from app.services.websocket_manager import manager
    """
    WebSocket endpoint for real-time private chat with online/offline status tracking
    """
    current_user = None
    heartbeat_task = None
    
    try:
        # ✅ AUTHENTICATE USER via query params (for WebSocket)
        token = None
        
        # 1. First try to get token from query params
        query_params = dict(websocket.query_params)
        if "token" in query_params:
            token = query_params["token"]
            print(f"🔑 Token from query params: {token[:20]}...")
        
        # 2. If no token in query params, check headers
        if not token:
            token_header = websocket.headers.get("Authorization")
            if token_header and token_header.startswith("Bearer "):
                token = token_header.split(" ")[1]
                print(f"🔑 Token from headers: {token[:20]}...")
        
        # 3. If still no token, wait for auth message
        if not token:
            try:
                print("⏳ Waiting for auth message...")
                data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
                if data.get("type") == "auth" and data.get("token"):
                    token = data["token"]
                    print(f"🔑 Token from auth message: {token[:20]}...")
                else:
                    await websocket.close(code=4001, reason="Authentication required")
                    return
            except (asyncio.TimeoutError, json.JSONDecodeError):
                await websocket.close(code=4001, reason="Authentication timeout")
                return
        
        # Verify token
        print("🔍 Verifying token...")
        payload = verify_token(token)
        if not payload:
            print("❌ Token verification failed")
            await websocket.close(code=4001, reason="Invalid or expired token")
            return
        
        # Get user ID from token
        raw_user_id = payload.get("sub")
        if not raw_user_id:
            print("❌ Token missing sub claim")
            await websocket.close(code=4001, reason="Token missing sub")
            return
        
        try:
            user_id = int(raw_user_id)
        except (ValueError, TypeError):
            print(f"❌ Invalid user ID in token: {raw_user_id}")
            await websocket.close(code=4001, reason="Invalid user ID in token")
            return
        
        # Load user from DB
        print(f"👤 Loading user with ID: {user_id}")
        current_user = db.query(User).filter(User.id == user_id).first()
        if not current_user:
            print(f"❌ User not found with ID: {user_id}")
            await websocket.close(code=4001, reason="User not found")
            return
        
        print(f"✅ User authenticated: {current_user.username} (ID: {current_user.id})")

        # ✅ VALIDATE FRIENDSHIP
        print(f"🤝 Checking friendship between {current_user.id} and {friend_id}")
        if not is_friend(db, current_user.id, friend_id):
            print(f"❌ Users {current_user.id} and {friend_id} are not friends")
            await websocket.close(code=4003, reason="Not friends")
            return
        
        await websocket.accept()
        
        # Send authentication success immediately
        await websocket.send_json({
            "type": "auth_success",
            "message": "Authenticated successfully",
            "user_id": current_user.id,
            "username": current_user.username,
        })
        
        # ✅ MARK EXISTING UNREAD MESSAGES AS SEEN ON CONNECTION
        unread_msgs = db.query(PrivateMessage).filter(
            PrivateMessage.receiver_id == current_user.id,
            PrivateMessage.sender_id == friend_id,
            PrivateMessage.is_read == False
        ).all()

        seen_ids = []
        for msg in unread_msgs:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
            
            existing_seen = db.query(MessageSeenStatus).filter(
                MessageSeenStatus.message_id == msg.id,
                MessageSeenStatus.user_id == current_user.id
            ).first()
            
            if not existing_seen:
                seen_status = MessageSeenStatus(
                    message_id=msg.id,
                    user_id=current_user.id,
                    seen_at=datetime.utcnow()
                )
                db.add(seen_status)
            
            seen_ids.append(msg.id)

        db.commit()
        
        chat_id = _chat_id(current_user.id, friend_id)
        
        # ✅ CONNECT TO MANAGER
        await manager.connect(chat_id, websocket, user_id=current_user.id)
        
        # ✅ HEARTBEAT FUNCTION
        async def send_heartbeat():
            try:
                while True:
                    await asyncio.sleep(25)
                    try:
                        await websocket.send_json({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        await manager.update_user_activity(current_user.id)
                    except Exception:
                        break
            except asyncio.CancelledError:
                raise
            except Exception as e:
                print(f"Heartbeat error: {e}")

        # ✅ START HEARTBEAT
        heartbeat_task = asyncio.create_task(send_heartbeat())
        print(f"Started heartbeat for user {current_user.id}")

        # ✅ MAIN MESSAGE LOOP
        while True:
            try:
                raw_data = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=35.0
                )
                
                await manager.update_user_activity(current_user.id)
                
                # Handle pong
                if raw_data.strip():
                    try:
                        data = json.loads(raw_data)
                        if data.get("type") == "pong":
                            continue
                    except json.JSONDecodeError:
                        if raw_data.strip() == "pong":
                            continue

                # Parse data
                try:
                    data = json.loads(raw_data) if raw_data.strip() else {}
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Invalid JSON format"
                    })
                    continue

                msg_type = data.get("type")
                content = data.get("content")
                reply_to_id = data.get("reply_to_id")
                message_type = data.get("message_type", "text")
                voice_duration = data.get("voice_duration")
                file_size = data.get("file_size")
                temp_id = data.get("temp_id")  # For frontend message tracking
                
                if not msg_type:
                    await websocket.send_json({
                        "type": "error", 
                        "error": "Message type is required"
                    })
                    continue

                # === HANDLE MESSAGE TYPES ===

                # ✅ TEXT/VOICE/FILE MESSAGE
                if msg_type == "message":
                    # FIXED: Allow voice messages with Cloudinary URLs
                    if message_type == "voice":
                        # For voice messages, content should be a Cloudinary URL
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "Voice messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    elif message_type == "file":
                        # For file messages, content should be a URL
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "File messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    elif message_type == "image":
                        # For image messages, content should be a URL
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "Image messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    else:
                        # For text messages, validate content
                        if not content or not content.strip():
                            await websocket.send_json({
                                "type": "error",
                                "error": "Message content cannot be empty",
                                "temp_id": temp_id
                            })
                            continue
                    
                    # ✅ VALIDATE REPLY MESSAGE
                    if reply_to_id:
                        try:
                            replied_message = validate_reply_message(db, reply_to_id, current_user.id, friend_id)
                            if not replied_message:
                                await websocket.send_json({
                                    "type": "error",
                                    "error": "Replied message not found",
                                    "temp_id": temp_id
                                })
                                continue
                        except HTTPException as e:
                            await websocket.send_json({
                                "type": "error", 
                                "error": e.detail,
                                "temp_id": temp_id
                            })
                            continue

                    try:
                        # Create message in DB
                        msg = create_private_message(
                            db=db,
                            sender_id=current_user.id,
                            receiver_id=friend_id,
                            content=content.strip() if message_type == "text" else content,
                            reply_to_id=reply_to_id,
                            message_type=message_type,
                            voice_duration=voice_duration,
                            file_size=file_size
                        )

                        # ✅ RELOAD WITH ALL RELATIONSHIPS
                        full_msg = db.query(PrivateMessage).options(
                            joinedload(PrivateMessage.sender),
                            joinedload(PrivateMessage.receiver),
                            joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user),
                            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
                            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
                        ).filter(PrivateMessage.id == msg.id).first()

                        if not full_msg:
                            await websocket.send_json({
                                "type": "error", 
                                "error": "Failed to create message",
                                "temp_id": temp_id
                            })
                            continue

                        # ✅ PREPARE SEEN_BY INFORMATION
                        seen_by = []
                        if full_msg.seen_statuses:
                            for status in full_msg.seen_statuses:
                                seen_by.append({
                                    "user_id": status.user.id,
                                    "username": status.user.username,
                                    "avatar_url": status.user.avatar_url,
                                    "seen_at": status.seen_at.isoformat() if status.seen_at else None
                                })

                        # ✅ PREPARE RESPONSE DATA
                        message_data = {
                            "type": "message",
                            "id": full_msg.id,
                            "temp_id": temp_id,
                            "sender_id": full_msg.sender_id,
                            "sender_username": current_user.username,
                            "receiver_id": full_msg.receiver_id,
                            "content": full_msg.content,
                            "message_type": full_msg.message_type.value,
                            "is_read": full_msg.is_read,
                            "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,
                            "created_at": full_msg.created_at.isoformat(),
                            "reply_to_id": full_msg.reply_to_id,
                            "avatar_url": full_msg.sender.avatar_url,
                            "voice_duration": full_msg.voice_duration,
                            "file_size": full_msg.file_size,
                            "seen_by": seen_by
                        }

                        # ✅ ADD REPLY_TO DATA IF EXISTS
                        if full_msg.reply_to:
                            # Create compact reply preview (like Telegram)
                            reply_content = full_msg.reply_to.content or ""
                            if full_msg.reply_to.message_type == MessageType.voice:
                                reply_content = "🎤 Voice message"
                            elif full_msg.reply_to.message_type == MessageType.image:
                                reply_content = "🖼️ Photo"
                            elif full_msg.reply_to.message_type == MessageType.file:
                                reply_content = "📎 File"
                            elif len(reply_content) > 100:
                                reply_content = reply_content[:100] + "..."
                            
                            # Add compact reply preview
                            message_data["reply_preview"] = {
                                "id": full_msg.reply_to.id,
                                "sender_username": full_msg.reply_to.sender.username,
                                "content": reply_content,
                                "message_type": full_msg.reply_to.message_type.value,
                                "voice_duration": full_msg.reply_to.voice_duration,
                                "file_size": full_msg.reply_to.file_size
                            }
                            reply_seen_by = []
                            if hasattr(full_msg.reply_to, 'seen_statuses') and full_msg.reply_to.seen_statuses:
                                for status in full_msg.reply_to.seen_statuses:
                                    reply_seen_by.append({
                                        "user_id": status.user.id,
                                        "username": status.user.username,
                                        "avatar_url": status.user.avatar_url,
                                        "seen_at": status.seen_at.isoformat() if status.seen_at else None
                                    })
                            
                            message_data["reply_to"] = {
                                "id": full_msg.reply_to.id,
                                "sender_id": full_msg.reply_to.sender_id,
                                "content": full_msg.reply_to.content,
                                "message_type": full_msg.reply_to.message_type.value,
                                "sender_username": full_msg.reply_to.sender.username,
                                "voice_duration": full_msg.reply_to.voice_duration,
                                "created_at": full_msg.reply_to.created_at.isoformat(),
                                "file_size": full_msg.reply_to.file_size,
                                "is_read": full_msg.reply_to.is_read,
                                "read_at": full_msg.reply_to.read_at.isoformat() if full_msg.reply_to.read_at else None,
                                "seen_by": reply_seen_by
                            }

                        # ✅ BROADCAST TO BOTH USERS
                        await manager.broadcast(chat_id, message_data)
                        print(f"📢 Broadcast new message {full_msg.id} with reply: {full_msg.reply_to_id}")

                    except Exception as e:
                        print(f"Error sending message: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to send message",
                            "temp_id": temp_id
                        })

                # ✅ READ RECEIPTS (REAL-TIME)
                elif msg_type == "read":
                    message_id = data.get("message_id")
                    if not message_id:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID is required for read receipt"
                        })
                        continue

                    try:
                        # Mark message as read in database
                        success = mark_message_as_read(db, message_id, current_user.id)
                        
                        if success:
                            # Get the updated message with complete seen status
                            updated_message = db.query(PrivateMessage).options(
                                joinedload(PrivateMessage.seen_statuses).joinedload(MessageSeenStatus.user)
                            ).filter(PrivateMessage.id == message_id).first()
                            
                            if updated_message:
                                # Prepare complete seen_by information
                                seen_by = []
                                for status in updated_message.seen_statuses:
                                    seen_by.append({
                                        "user_id": status.user.id,
                                        "username": status.user.username,
                                        "avatar_url": status.user.avatar_url,
                                        "seen_at": status.seen_at.isoformat() if status.seen_at else None
                                    })

                                # ✅ Broadcast message update
                                broadcast_data = {
                                    "type": "message_updated",
                                    "message_id": message_id,
                                    "id": message_id,
                                    "is_read": True,
                                    "read_at": datetime.utcnow().isoformat(),
                                    "seen_by": seen_by,
                                    "reader_id": current_user.id
                                }
                                
                                await manager.broadcast(chat_id, broadcast_data)
                                print(f"📢 REAL-TIME SEEN: Broadcast seen status for message {message_id} by user {current_user.id}")
                                
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "error": "Failed to mark message as read"
                            })
                            
                    except Exception as e:
                        print(f"Error processing read receipt: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to process read receipt"
                        })

                # ✅ TYPING INDICATORS
                elif msg_type == "typing":
                    is_typing = data.get("is_typing", False)
                    try:
                        await manager.broadcast(chat_id, {
                            "type": "typing",
                            "is_typing": is_typing,
                            "user_id": current_user.id,
                            "username": current_user.username
                        })
                    except Exception as e:
                        print(f"Error broadcasting typing: {e}")

                # ✅ MESSAGE DELETION
                elif msg_type == "delete":
                    message_id = data.get("message_id")
                    if not message_id:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID is required for deletion"
                        })
                        continue

                    try:
                        # Get message and verify ownership
                        message = db.query(PrivateMessage).filter(
                            PrivateMessage.id == message_id,
                            PrivateMessage.sender_id == current_user.id
                        ).first()
                        
                        if message:
                            # Delete seen statuses first
                            db.query(MessageSeenStatus).filter(
                                MessageSeenStatus.message_id == message_id
                            ).delete()
                            
                            # Delete message
                            db.delete(message)
                            db.commit()
                            
                            # Broadcast deletion
                            await manager.broadcast(chat_id, {
                                "type": "message_deleted",
                                "message_id": message_id,
                                "deleted_by": current_user.id,
                                "deleted_at": datetime.utcnow().isoformat()
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "error": "Message not found or not authorized to delete"
                            })
                    except Exception as e:
                        db.rollback()
                        print(f"Error deleting message: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to delete message"
                        })

                # ✅ MESSAGE EDITING
                elif msg_type == "edit":
                    message_id = data.get("message_id")
                    new_content = data.get("new_content")
                    
                    if not message_id or not new_content:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID and new content are required"
                        })
                        continue
                    
                    try:
                        # Get message and verify ownership
                        message = db.query(PrivateMessage).filter(
                            PrivateMessage.id == message_id,
                            PrivateMessage.sender_id == current_user.id
                        ).first()
                        
                        if message:
                            # Update message content
                            message.content = new_content
                            message.updated_at = datetime.utcnow()
                            db.commit()
                            
                            # Broadcast edit
                            await manager.broadcast(chat_id, {
                                "type": "message_edited",
                                "message_id": message_id,
                                "new_content": new_content,
                                "edited_by": current_user.id,
                                "edited_at": datetime.utcnow().isoformat()
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "error": "Message not found or not authorized to edit"
                            })
                    except Exception as e:
                        db.rollback()
                        print(f"Error editing message: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to edit message"
                        })

                # ✅ ONLINE STATUS REQUESTS
                elif msg_type == "get_online_users":
                    # Send current online users for this chat
                    online_users = manager.get_online_users(chat_id)
                    await websocket.send_json({
                        "type": "online_users",
                        "user_ids": list(online_users),
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                # ✅ REACTIONS
                elif msg_type == "reaction_add":
                    message_id = data.get("message_id")
                    emoji = data.get("emoji")
                    
                    if not message_id or not emoji:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID and emoji are required"
                        })
                        continue
                    
                    try:
                        # Create reaction in database
                        reaction_in = ReactionCreate(emoji=emoji)
                        reaction = create_reaction(db, message_id, current_user.id, reaction_in)
                        
                        # Broadcast to all users in chat
                        await manager.broadcast(chat_id, {
                            "type": "reaction_added",
                            "message_id": message_id,
                            "reaction": {
                                "id": reaction.id,
                                "emoji": reaction.emoji,
                                "user_id": reaction.user_id,
                                "user": {
                                    "id": reaction.user.id,
                                    "username": reaction.user.username,
                                    "avatar_url": reaction.user.avatar_url
                                },
                                "created_at": reaction.created_at.isoformat()
                            }
                        })
                    except Exception as e:
                        print(f"Error adding reaction: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to add reaction"
                        })
                        
                elif msg_type == "reaction_remove":
                    message_id = data.get("message_id")
                    reaction_id = data.get("reaction_id")
                    
                    if not message_id or not reaction_id:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID and reaction ID are required"
                        })
                        continue
                    
                    try:
                        # Delete reaction from database
                        success, error_message = delete_reaction(db, message_id, reaction_id, current_user.id)
                        
                        if success:
                            # Broadcast removal to chat
                            await manager.broadcast(chat_id, {
                                "type": "reaction_removed",
                                "message_id": message_id,
                                "reaction_id": reaction_id,
                                "user_id": current_user.id,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                            
                            # Also confirm to the sender
                            await websocket.send_json({
                                "type": "reaction_removed",
                                "message_id": message_id,
                                "reaction_id": reaction_id,
                                "success": True
                            })
                        else:
                            # Send error back to the user who tried to remove
                            await websocket.send_json({
                                "type": "error",
                                "error": f"Failed to remove reaction: {error_message}",
                                "success": False
                            })
                            
                    except Exception as e:
                        # Send error back to the user
                        await websocket.send_json({
                            "type": "error",
                            "error": f"Failed to remove reaction: {str(e)}",
                            "success": False
                        })
                        
                # ✅ CHECK SPECIFIC USER STATUS
                elif msg_type == "check_user_status":
                    user_id_to_check = data.get("user_id")
                    if user_id_to_check:
                        is_online = manager.is_user_online(user_id_to_check)
                        last_activity = manager.get_user_last_activity(user_id_to_check)
                        
                        await websocket.send_json({
                            "type": "user_status",
                            "user_id": user_id_to_check,
                            "is_online": is_online,
                            "last_activity": last_activity.isoformat() if last_activity else None,
                            "timestamp": datetime.utcnow().isoformat()
                        })

                # ✅ HEARTBEAT/ACTIVITY UPDATE
                elif msg_type == "heartbeat":
                    # Already handled above with activity update
                    # Send pong response
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    pass

                # ✅ MESSAGE FORWARDING
                elif msg_type == "forward":
                    message_id = data.get("message_id")
                    target_user_id = data.get("target_user_id")
                    
                    if not message_id or not target_user_id:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID and target user ID are required"
                        })
                        continue
                    
                    try:
                        # Get original message
                        original_msg = db.query(PrivateMessage).filter(
                            PrivateMessage.id == message_id
                        ).first()
                        
                        if not original_msg:
                            await websocket.send_json({
                                "type": "error",
                                "error": "Original message not found"
                            })
                            continue
                        
                        # Check if user is friends with target
                        if not is_friend(db, current_user.id, target_user_id):
                            await websocket.send_json({
                                "type": "error",
                                "error": "You must be friends with the target user"
                            })
                            continue
                        
                        # Create forwarded message
                        forwarded_msg = create_private_message(
                            db=db,
                            sender_id=current_user.id,
                            receiver_id=target_user_id,
                            content=original_msg.content,
                            message_type=original_msg.message_type,
                            voice_duration=original_msg.voice_duration,
                            file_size=original_msg.file_size,
                            is_forwarded=True,
                            forwarded_from_id=original_msg.sender_id
                        )
                        
                        # Notify sender
                        await websocket.send_json({
                            "type": "forward_success",
                            "message_id": forwarded_msg.id,
                            "target_user_id": target_user_id
                        })
                        
                    except Exception as e:
                        print(f"Error forwarding message: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to forward message"
                        })

                # ✅ UNKNOWN MESSAGE TYPE
                else:
                    await websocket.send_json({
                        "type": "error",
                        "error": f"Unknown message type: {msg_type}"
                    })
                

            except asyncio.TimeoutError:
                # ✅ HANDLE TIMEOUT (NORMAL - WAITING FOR MESSAGES)
                print(f"Timeout waiting for message from user {current_user.id}")
                continue  # Just continue waiting for messages
                
            except WebSocketDisconnect:
                # ✅ CLIENT DISCONNECTED NORMALLY
                print(f"User {current_user.id} disconnected from WebSocket")
                break
                
            except Exception as e:
                print(f"WebSocket error for user {current_user.id}: {e}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Internal server error"
                    })
                except Exception:
                    break  # Client disconnected

    except WebSocketDisconnect:
        print(f"User {current_user.id if current_user else 'unknown'} disconnected normally")
    except Exception as e:
        print(f"WebSocket connection error: {e}")
    finally:
        # ✅ PROPER CLEANUP - ALWAYS EXECUTED
        try:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    print("Heartbeat task cancelled successfully")
        except Exception as e:
            print(f"Error cancelling heartbeat: {e}")

        # ✅ DISCONNECT FROM MANAGER (handles offline status automatically)
        if current_user:
            chat_id = _chat_id(current_user.id, friend_id)
            manager.disconnect(chat_id, websocket, user_id=current_user.id)
            print(f"User {current_user.id} fully disconnected from chat {chat_id}")        
@router.websocket("/notifications")
async def websocket_notifications(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    Unified WebSocket endpoint for all notifications
    """
    current_user: User | None = None

    try:
        # Accept connection first
        await websocket.accept()
        
        print("🔌 Notifications WebSocket connection accepted")
        
        # 1. First try to get token from query params
        token = None
        query_params = dict(websocket.query_params)
        if "token" in query_params:
            token = query_params["token"]
            print(f"🔑 Token from query params: {token[:20]}...")
        
        # 2. If no token in query params, check headers
        if not token:
            token_header = websocket.headers.get("Authorization")
            if token_header and token_header.startswith("Bearer "):
                token = token_header.split(" ")[1]
                print(f"🔑 Token from headers: {token[:20]}...")
        
        # 3. If still no token, wait for auth message
        if not token:
            try:
                print("⏳ Waiting for auth message...")
                data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
                if data.get("type") == "auth" and data.get("token"):
                    token = data["token"]
                    print(f"🔑 Token from auth message: {token[:20]}...")
                else:
                    await websocket.close(code=4001, reason="Authentication required")
                    return
            except (asyncio.TimeoutError, json.JSONDecodeError):
                await websocket.close(code=4001, reason="Authentication timeout")
                return
        
        # Verify token
        print("🔍 Verifying token...")
        payload = verify_token(token)
        if not payload:
            print("❌ Token verification failed")
            await websocket.send_json({
                "type": "auth_error",
                "error": "Invalid or expired token"
            })
            await websocket.close(code=4001, reason="Invalid or expired token")
            return
        
        # Get user ID from token
        raw_user_id = payload.get("sub")
        if not raw_user_id:
            print("❌ Token missing sub claim")
            await websocket.send_json({
                "type": "auth_error",
                "error": "Token missing user ID"
            })
            await websocket.close(code=4001, reason="Token missing sub")
            return
        
        try:
            user_id = int(raw_user_id)
        except (ValueError, TypeError):
            print(f"❌ Invalid user ID in token: {raw_user_id}")
            await websocket.send_json({
                "type": "auth_error",
                "error": "Invalid user ID in token"
            })
            await websocket.close(code=4001, reason="Invalid user ID in token")
            return
        
        # Load user from DB
        print(f"👤 Loading user with ID: {user_id}")
        current_user = db.query(User).filter(User.id == user_id).first()
        if not current_user:
            print(f"❌ User not found with ID: {user_id}")
            await websocket.send_json({
                "type": "auth_error",
                "error": "User not found"
            })
            await websocket.close(code=4001, reason="User not found")
            return
        
        print(f"✅ User authenticated: {current_user.username} (ID: {current_user.id})")

        # 4. Success – send auth_success
        await websocket.send_json({
            "type": "auth_success",
            "message": "Authenticated successfully",
            "user_id": current_user.id,
            "username": current_user.username,
        })

        # 5. Join user's notification room
        user_room = f"user_{current_user.id}"
        await manager.connect(user_room, websocket, user_id=current_user.id)

        print(f"📢 User {current_user.id} ({current_user.username}) connected to notifications")

        # 6. Keep-alive loop
        while True:
            try:
                msg = await websocket.receive_json()
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg.get("type") == "heartbeat":
                    # Update user activity
                    await manager.update_user_activity(current_user.id)
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                print(f"📢 User {current_user.id} disconnected from notifications")
                break
            except Exception as e:
                print(f"📢 Message handling error: {e}")
                continue

    except WebSocketDisconnect:
        print(f"📢 Notifications WebSocket disconnected normally")
    except Exception as e:
        print(f"❌ Notification WS authentication error: {e}")
        traceback.print_exc()
        try:
            await websocket.close(code=1011, reason=f"Authentication failed: {str(e)}")
        except:
            pass
    finally:
        if current_user:
            await manager.disconnect(f"user_{current_user.id}", websocket)
            print(f"📢 User {current_user.id} disconnected from notifications")
            
@router.websocket("/group/{group_id}")
async def websocket_group_chat(
    websocket: WebSocket,
    group_id: int,
):
    
    from app.services.ws_manager_group import manager
    
    await websocket.accept()
    
    db = next(get_db())
    try:
        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Please login to use chat")
            return

        if not is_group_member(db, group_id, current_user.id):
            await websocket.close(code=4003, reason="Not a member of this group")
            return

        chat_id = f"group_{group_id}"
        await manager.connect(chat_id, websocket, user_id=current_user.id)

        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("message_type", "text")
                content = data.get("content")
                parent_message_id = data.get("reply_to")  # Optional
                action = data.get("action")
                incoming_temp_id = data.get("temp_id")
                to_user = data.get("to_user")
                sdp = data.get("sdp")
                
                if action == "online_users":
                    online_user_ids = list(manager.get_online_users(chat_id))
                    await websocket.send_json({
                        "action": "online_users",
                        "user_ids": online_user_ids
                    })

                if action == "seen":
                    message_id = int(data.get("message_id"))

                    msg = db.query(GroupMessage).filter(
                        GroupMessage.id == message_id,
                        GroupMessage.group_id == group_id
                    ).first()
                    if not msg:
                        continue

                    seen_record = db.query(GroupMessageSeen).filter_by(
                        message_id=message_id,
                        user_id=current_user.id
                    ).first()

                    now = datetime.utcnow()

                    if not seen_record:
                        seen_record = GroupMessageSeen(
                            message_id=message_id,
                            user_id=current_user.id,
                            seen=True,
                            seen_at=to_local_iso(now, tz_offset_hours=7),
                        )
                        db.add(seen_record)
                        db.commit()
                    else:
                        if seen_record.seen:
                            continue

                        seen_record.seen = True
                        seen_record.seen_at = to_local_iso(now, tz_offset_hours=7)
                        db.commit()

                    await manager.broadcast(chat_id, {
                        "action": "seen",
                        "message_id": message_id,
                        "user_id": current_user.id,
                        "seen_at": to_local_iso(now, tz_offset_hours=7)
                    })
                    continue

                if action == "forward_to_groups":
                    message_id = data.get("message_id")
                    target_group_ids = [int(g) for g in data.get("group_ids", [])]
                    target_group_ids = [gid for gid in target_group_ids if gid != group_id]
                    
                    if not target_group_ids:
                        continue
                    
                    await handle_forward_message(
                        db,
                        current_user_id=current_user.id,
                        message_id=message_id,
                        target_group_ids=target_group_ids
                    )
                    continue

                if action == "edit":
                    message_id = int(data.get("message_id"))
                    new_content = data.get("new_content")
                    now = datetime.utcnow()

                    updated = update_message(
                        db=db,
                        message_id=message_id,
                        content=new_content,
                        current_user_id=current_user.id,
                    )

                    await manager.broadcast(chat_id, {
                        "action": "edit",
                        "message_id": message_id,
                        "new_content": new_content,
                        "updated_at": to_local_iso(updated.updated_at, tz_offset_hours=7)
                    })
                    continue
                
                if action == "delete":
                    message_id = int(data.get("message_id"))
                    await delete_message(db, message_id, current_user.id)
                    
                    await manager.broadcast(chat_id, {
                        "action": "delete",
                        "message_id": message_id
                    })
                    continue
                
                if action == "file_upload":
                    file_url = data.get("file_url")
                    message_id = data.get("message_id")
                    
                    msg = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
                    if not msg:
                        continue
                    
                    await manager.broadcast(chat_id, {
                        "action": "file_upload",
                        "id": msg.id,
                        "sender": {
                            "id": msg.sender.id,
                            "username": msg.sender.username,
                            "avatar_url": msg.sender.avatar_url
                        },
                        "file_url": msg.file_url,
                        "created_at": to_local_iso(msg.created_at, tz_offset_hours=7),
                        "temp_id": incoming_temp_id
                    })
                    continue

                if action == "file_update":
                    message_id = data.get("message_id")
                    file_url = data.get("file_url")
                    
                    msg = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
                    if not msg:
                        continue

                    await manager.broadcast(chat_id, {
                        "action": "file_update",
                        "message_id": msg.id,
                        "file_url": file_url,
                        "updated_at": to_local_iso(msg.updated_at, tz_offset_hours=7),
                        "temp_id": incoming_temp_id
                    })
                    continue
                
                if action == "voice_upload":
                    voice_url = data.get("voice_url")
                    message_id = data.get("message_id")
                    message_type = data.get("message_type", "voice")
                    
                    msg = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
                    if not msg:
                        continue
                    
                    await manager.broadcast(chat_id, {
                        "action": "voice_upload",
                        "id": msg.id,
                        "sender": {
                            "id": msg.sender.id,
                            "username": msg.sender.username,
                            "avatar_url": msg.sender.avatar_url
                        },
                        "voice_url": voice_url,
                        "message_type": message_type,
                        "created_at": to_local_iso(msg.created_at, tz_offset_hours=7),
                        "temp_id": incoming_temp_id
                    })
                    continue
                
                if action == "call_start":
                    await manager.broadcast(chat_id, {
                        "action": "call_request",
                        "from_user": current_user.id,
                    })
                    continue
                
                if action == "call_accept":
                    await manager.send_to_user(chat_id, to_user, {
                        "action": "call_accepted",
                        "from_user": current_user.id
                    })
                    continue
                
                if action == "call_reject":
                    await manager.send_to_user(chat_id, to_user, {
                        "action": "call_rejected",
                        "from_user": current_user.id
                    })
                    continue

                if action == "call_join":
                    await manager.broadcast(chat_id,{
                        "action": "call_join",
                        "user_id": current_user.id
                    }, exclude={websocket})
                    continue
                
                if action == "call_leave":
                    await manager.broadcast(chat_id,{
                        "action": "call_leave",
                        "user_id": current_user.id
                    })
                    continue
                
                if action == "call_offer":
                    await manager.send_to_user(chat_id, to_user, {
                        "action": "call_offer",
                        "from_user": current_user.id,
                        "sdp": sdp
                    })
                    continue
                
                if action == "call_answer":
                    await manager.send_to_user(chat_id, to_user, {
                        "action": "call_answer",
                        "from_user": current_user.id,
                        "sdp": sdp
                    })
                    continue
                
                if action == "call_ice":
                    await manager.send_to_user(chat_id, to_user, {
                        "action": "call_ice",
                        "from_user": current_user.id,
                        "candidate": data["candidate"]
                    })
                    continue
                
                try:
                    msg = GroupMessage(
                        group_id=group_id,
                        sender_id=current_user.id,
                        content=content,
                        message_type=message_type,
                        parent_message_id=parent_message_id
                    )
                    db.add(msg)
                    db.commit()
                    db.refresh(msg)
                except Exception as e:
                    db.rollback()
                    print(f"[DB Error] {e}")
                    await websocket.send_json({
                        "error": "Failed to save message",
                        "temp_id": incoming_temp_id
                    })
                    continue

                parent_msg_data = None
                if msg.parent_message:
                    parent = msg.parent_message
                    parent_msg_data = {
                        "id": parent.id,
                        "content": parent.content,
                        "file_url": parent.file_url,
                        "voice_url": parent.voice_url,
                        "sender": {
                            "id": parent.sender.id,
                            "username": parent.sender.username,
                            "avatar_url": parent.sender.avatar_url
                        }
                    }

                # Build message output
                msg_out = {
                    "id": msg.id,
                    "temp_id": incoming_temp_id,
                    "sender": {
                        "id": msg.sender.id,
                        "username": msg.sender.username,
                        "avatar_url": msg.sender.avatar_url
                    },
                    "group_id": msg.group_id,
                    "content": msg.content,
                    "created_at": to_local_iso(msg.created_at, tz_offset_hours=7),
                    "file_url": msg.file_url,
                    "voice_url": msg.voice_url,
                    "parent_message": parent_msg_data
                }

                try:
                    await manager.broadcast(chat_id, msg_out)
                except Exception as e:
                    print(f"[Broadcast Error] Group {group_id}: {e}")
                    await websocket.send_json({
                        "error": "Failed to broadcast message",
                        "temp_id": incoming_temp_id
                    })
                    continue

        except WebSocketDisconnect:
            manager.disconnect(chat_id, websocket, user_id=current_user.id)
        except Exception as e:
            traceback.print_exc()
            print(f"[WS Error] {e}")
            await websocket.close(code=1011, reason="Server error")

    except Exception as e:
        traceback.print_exc()
        print(f"[WS Error] {e}")
        await websocket.close(code=1011, reason="Server error")
    finally:
        db.close()