import asyncio
import json
import traceback
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user_ws
from app.crud.friend import is_friend
from app.crud.chat import create_private_message, send_heartbeat, mark_message_as_read
from app.models.user import User
from app.models.private_message import PrivateMessage, MessageType
from app.models.group_message import GroupMessage
from app.models.group_message_seen import GroupMessageSeen
from app.schemas.chat import GroupMessageOut, ParentMessageResponse, AuthorResponse
from app.utils.chat_helpers import _chat_id, is_group_member, validate_reply_message
from app.crud.message import update_message, delete_message, is_user_online, heartbeat, mark_user_as_read_if_online
from app.helpers.to_utc_iso import to_local_iso
from app.crud.chat_gateway import forward_message
from app.services.websocket_manager import manager

router = APIRouter()

@router.websocket("/")
async def global_websocket(websocket: WebSocket):
    db = next(get_db())
    current_user = None
    global_room = "global"

    try:
        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Please login")
            return

        await websocket.accept()

        await manager.connect(global_room, websocket, current_user.id)

        chats = get_user_chat_list(db, current_user.id)

        await websocket.send_json({
            "type": "chat_list",
            "chats": chats
        })

        while True:
            try:
                data = await websocket.receive_json()
                event_type = data.get("type")

                if event_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    await manager.update_user_activity(current_user.id)
                    continue

                if event_type == "refresh_chats":
                    chats = get_user_chat_list(db, current_user.id)

                    await websocket.send_json({
                        "type": "chat_list",
                        "chats": chats
                    })
                    continue

                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid event type"
                })

            except WebSocketDisconnect:
                break

            except Exception as e:
                traceback.print_exc()
                print(f"[Global WS Error] {e}")
                await websocket.close(code=1011, reason="Server error")
                break

    except Exception as e:
        traceback.print_exc()
        print(f"[Global WS Fatal Error] {e}")
        await websocket.close(code=1011, reason="Server error")

    finally:
        if current_user:
            manager.disconnect(global_room, websocket, current_user.id)
        db.close()
    
@router.websocket("/private/{friend_id}")
async def handle_websocket_private(
    websocket: WebSocket,
    friend_id: int,
):

    current_user = None
    heartbeat_task = None
    
    db = next(get_db())
    try:
        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Please login to use chat")
            return
        
        if not is_friend(db, current_user.id, friend_id):
            await websocket.close(code=4003, reason="Not friends")
            return

        is_online = is_user_online(friend_id)
        
        await websocket.accept()

        await websocket.send_json({
            "type": "auth_success",
            "message": "Authenticated successfully",
            "user_id": current_user.id,
            "username": current_user.username,
        })
        
        chat_id = _chat_id(current_user.id, friend_id)
        await manager.connect(chat_id, websocket, user_id=current_user.id)
        
        heartbeat_task = asyncio.create_task(heartbeat(websocket, chat_id, current_user.id))

        while True:
            try:
                raw_data = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=35.0
                )
                
                if raw_data.strip():
                    try:
                        data = json.loads(raw_data)
                        if data.get("type") == "pong":
                            continue
                    except json.JSONDecodeError:
                        if raw_data.strip() == "pong":
                            continue

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
                temp_id = data.get("temp_id")
                
                if not msg_type:
                    await websocket.send_json({
                        "type": "error", 
                        "error": "Message type is required"
                    })
                    continue
                
                if msg_type == "message":
                    if message_type == "voice":
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "Voice messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    elif message_type == "file":
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "File messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    elif message_type == "image":
                        if not content or not content.startswith(('http://', 'https://')):
                            await websocket.send_json({
                                "type": "error",
                                "error": "Image messages require a valid URL",
                                "temp_id": temp_id
                            })
                            continue
                    else:
                        if not content or not content.strip():
                            await websocket.send_json({
                                "type": "error",
                                "error": "Message content cannot be empty",
                                "temp_id": temp_id
                            })
                            continue
                    
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

                        full_msg = db.query(PrivateMessage).options(
                            joinedload(PrivateMessage.sender),
                            joinedload(PrivateMessage.receiver),
                            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender),
                            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.seen_statuses)
                        ).filter(PrivateMessage.id == msg.id).first()

                        if not full_msg:
                            await websocket.send_json({
                                "type": "error", 
                                "error": "Failed to create message",
                                "temp_id": temp_id
                            })
                            continue

                        message_data = {
                            "type": "message",
                            "id": full_msg.id,
                            "temp_id": data.get("temp_id"),
                            "sender_id": full_msg.sender_id,
                            "sender_username": current_user.username,
                            "receiver_id": full_msg.receiver_id,
                            "content": full_msg.content,
                            "message_type": full_msg.message_type.value,
                            "created_at": full_msg.created_at.isoformat(),
                            "reply_to_id": full_msg.reply_to_id,
                            "avatar_url": full_msg.sender.avatar_url,
                            "voice_duration": full_msg.voice_duration,
                            "file_size": full_msg.file_size,
                            "is_read": is_online,
                        }

                        if full_msg.reply_to:
                            reply_content = full_msg.reply_to.content or ""
                            if full_msg.reply_to.message_type == MessageType.voice:
                                reply_content = "🎤 Voice message"
                            elif full_msg.reply_to.message_type == MessageType.image:
                                reply_content = "🖼️ Photo"
                            elif full_msg.reply_to.message_type == MessageType.file:
                                reply_content = "📎 File"
                            elif len(reply_content) > 100:
                                reply_content = reply_content[:100] + "..."
                            
                            message_data["reply_to"] = {
                                "id": full_msg.reply_to.id,
                                "sender_id": full_msg.reply_to.sender_id,
                                "content": full_msg.reply_to.content,
                                "message_type": full_msg.reply_to.message_type.value,
                                "sender_username": full_msg.reply_to.sender.username,
                                "voice_duration": full_msg.reply_to.voice_duration,
                                "created_at": full_msg.reply_to.created_at.isoformat(),
                                "file_size": full_msg.reply_to.file_size,
                            }

                        await manager.broadcast(chat_id, message_data)
                        
                        if is_online:
                            await mark_message_as_read(db, friend_id, current_user.id)

                    except Exception as e:
                        print(f"Error sending message: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to send message",
                            "temp_id": temp_id
                        })

                elif msg_type == "typing":
                    is_typing = data.get("is_typing", False)
                    await manager.broadcast(chat_id, {
                        "type": "typing",
                        "is_typing": is_typing,
                        "user_id": current_user.id,
                        "username": current_user.username
                    })

                elif msg_type == "delete":
                    message_id = data.get("message_id")
                    if not message_id:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message ID is required for deletion"
                        })
                        continue

                    try:
                        message = db.query(PrivateMessage).filter(
                            PrivateMessage.id == message_id,
                            PrivateMessage.sender_id == current_user.id
                        ).first()
                        
                        if message:
                            
                            db.delete(message)
                            db.commit()
                            
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
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to delete message"
                        })

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
                        message = db.query(PrivateMessage).filter(
                            PrivateMessage.id == message_id,
                            PrivateMessage.sender_id == current_user.id
                        ).first()
                        
                        if message:
                            message.content = new_content
                            message.edited_at = datetime.utcnow()
                            db.commit()
                            
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
                        await websocket.send_json({
                            "type": "error",
                            "error": f"Failed to remove reaction: {str(e)}",
                            "success": False
                        })

                elif msg_type == "heartbeat":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    pass

                elif msg_type == "forward":

                    result = await forward_message(
                        db=db,
                        current_user=current_user,
                        source="private",
                        message_id=data["message_id"],
                        target_user_ids=data.get("targets", {}).get("users", []),
                        target_group_ids=data.get("targets", {}).get("groups", []),
                    )

                    # 🔹 Send to private users
                    for uid, payload in result["users"]:
                        await manager.send_to_user(uid, payload)

                    # 🔹 Send to groups
                    for gid, payload in result["groups"]:
                        await manager.broadcast(f"group_{gid}", payload)

                    await websocket.send_json({
                        "type": "forward_success"
                    })
                    pass

                else:
                    await websocket.send_json({
                        "type": "error",
                        "error": f"Unknown message type: {msg_type}"
                    })

            except asyncio.TimeoutError:
                continue
                
            except WebSocketDisconnect:
                break
                
            except Exception as e:
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Internal server error"
                    })
                except Exception:
                    break

    except WebSocketDisconnect:
        try:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    print("Heartbeat task cancelled successfully")
        except Exception as e:
            print(f"Error cancelling heartbeat: {e}")

        if current_user:
            chat_id = _chat_id(current_user.id, friend_id)
            manager.disconnect(chat_id, websocket, user_id=current_user.id)
            print(f"User {current_user.id} fully disconnected from chat {chat_id}")        
            
@router.websocket("/group/{group_id}")
async def websocket_group_chat(
    websocket: WebSocket,
    group_id: int,
):
    
    db = next(get_db())
    try:
        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Please login to use chat")
            return

        if not is_group_member(db, group_id, current_user.id):
            await websocket.close(code=4003, reason="Not a member of this group")
            return
        
        await websocket.accept()

        chat_id = f"group_{group_id}"
        await manager.connect(chat_id, websocket, user_id=current_user.id)
        
        heartbeat_task = asyncio.create_task(heartbeat(websocket, chat_id, current_user.id))

        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("message_type", "text")
                content = data.get("content")
                parent_message_id = data.get("reply_to")  # Optional
                action = data.get("action")
                incoming_temp_id = data.get("temp_id")
                
                if action == "ping":
                    await websocket.send_json({"action": "pong"})
                    continue

                if action == "online_users":
                    online_user_ids = list(manager.get_online_users(chat_id))
                    await websocket.send_json({
                        "action": "online_users",
                        "user_ids": online_user_ids
                    })
                    continue

                if action == "forward":
                    result = await forward_message(
                        db=db,
                        current_user=current_user,
                        source="group",
                        message_id=data["message_id"],
                        target_user_ids=data.get("targets", {}).get("users", []),
                        target_group_ids=data.get("targets", {}).get("groups", []),
                    )

                    # Forward to users
                    for uid, payload in result["users"]:
                        await manager.send_to_user(uid, payload)

                    # Forward to groups
                    for gid, payload in result["groups"]:
                        await manager.broadcast(f"group_{gid}", payload, exclude={websocket})

                    await websocket.send_json({
                        "action": "forward_success"
                    })
                    continue

                if action == "edit":
                    message_id = int(data.get("message_id"))
                    new_content = data.get("new_content")

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
                        "message_type": "text",
                        "updated_at": to_local_iso(updated.updated_at, tz_offset_hours=7)
                    })
                    continue
                
                if action == "delete":
                    message_id = data.get("message_id")

                    if message_id is None:
                        await websocket.send_json({
                            "error": "message_id is required for delete"
                        })
                        continue

                    try:
                        message_id = int(message_id)
                    except ValueError:
                        await websocket.send_json({
                            "error": "invalid message_id"
                        })
                        continue

                    await delete_message(db, message_id, current_user.id)

                    await manager.broadcast(chat_id, {
                        "action": "delete",
                        "message_id": message_id
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
                        "message_type": parent.message_type.value,
                        "content": parent.content,
                        "call_content": parent.call_content,
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
                    "action": "message",
                    "id": msg.id,
                    "temp_id": incoming_temp_id,
                    "sender": {
                        "id": msg.sender.id,
                        "username": msg.sender.username,
                        "avatar_url": msg.sender.avatar_url
                    },
                    "group_id": msg.group_id,
                    "message_type": msg.message_type.value,
                    "content": msg.content,
                    "call_content": msg.call_content,
                    "created_at": to_local_iso(msg.created_at, tz_offset_hours=7),
                    "file_url": msg.file_url,
                    "voice_url": msg.voice_url,
                    "parent_message": parent_msg_data
                }

                try:
                    await manager.broadcast(chat_id, msg_out)
                    
                    await mark_user_as_read_if_online(db, current_user.id, group_id, msg.id)
                except Exception as e:
                    print(f"[Broadcast Error] Group {group_id}: {e}")
                    await websocket.send_json({
                        "error": "Failed to broadcast message",
                        "temp_id": incoming_temp_id
                    })
                    
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
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
        manager.disconnect(chat_id, websocket, user_id=current_user.id)
        db.close()
        
    

