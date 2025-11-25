import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect,Query
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal, get_session
from app.core.security import get_current_user, get_current_user_ws
from app.crud.friend import is_friend
from app.crud.chat import create_private_message, is_group_member, create_group_message, mark_message_as_read
from app.models.user import User
from app.schemas.chat import MessageOut, GroupMessageOut
from sqlalchemy.orm import Session, joinedload 
from app.schemas.chat import MessageOut, GroupMessageOut, ParentMessageResponse
from app.services.websocket_manager import manager
from app.models.group_message import MessageType, GroupMessage
from app.schemas.chat import MessageCreate, AuthorResponse
import json
from app.models.group_message_reply import GroupMessageReply
from app.crud.message import handle_seen_message, handle_forward_message, update_message, delete_message, update_file_message, upload_file_message
import traceback
from app.models.group_message_seen import GroupMessageSeen

from app.api.v1.routers.websocket_server import handle_websocket_private
from app.models.message_seen_status import MessageSeenStatus
from app.models.private_message import PrivateMessage
from app.helpers.to_utc_iso import to_local_iso

router = APIRouter()

def _chat_id(user_a: int, user_b: int) -> str:
    a, b = sorted([user_a, user_b])
    return f"private_{a}_{b}"

@router.websocket("/private/{friend_id}")
async def ws_private_chat(
    websocket: WebSocket,
    friend_id: int,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time private chat with seen status tracking
    """
    current_user = None
    heartbeat_task = None
    
    try:
        # ✅ AUTHENTICATE USER (NO websocket.accept() - manager handles it)
        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Authentication failed")
            return

        # ✅ VALIDATE FRIENDSHIP
        if not is_friend(db, current_user.id, friend_id):
            await websocket.close(code=4003, reason="Not friends")
            return

        chat_id = _chat_id(current_user.id, friend_id)
        
        # ✅ CONNECT TO MANAGER (This calls websocket.accept() internally)
        await manager.connect(chat_id, websocket)

        # ✅ HEARTBEAT FUNCTION
        async def send_heartbeat():
            """Send periodic pings to keep connection alive and detect dead connections"""
            try:
                while True:
                    await asyncio.sleep(25)  # Send every 25 seconds
                    try:
                        await websocket.send_json({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except Exception:
                        break  # Stop heartbeat if send fails
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        # ✅ START HEARTBEAT
        heartbeat_task = asyncio.create_task(send_heartbeat())

        # ✅ MAIN MESSAGE LOOP
        while True:
            try:
                # ✅ ADD TIMEOUT TO PREVENT HANGING
                raw_data = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=35.0  # Slightly longer than heartbeat interval
                )
                
                # ✅ HANDLE PONG RESPONSES
                if raw_data.strip():
                    try:
                        data = json.loads(raw_data)
                        if data.get("type") == "pong":
                            continue  # Skip further processing for pong messages
                    except json.JSONDecodeError:
                        # If it's not JSON, it might be a raw pong
                        if raw_data.strip() == "pong":
                            continue

                # ✅ PARSE JSON DATA
                try:
                    data = json.loads(raw_data) if raw_data.strip() else {}
                except json.JSONDecodeError:
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Invalid JSON format"
                        })
                    except Exception:
                        pass  # Client may have disconnected
                    continue

                # ✅ EXTRACT MESSAGE DATA
                msg_type = data.get("type")
                content = data.get("content")
                reply_to_id = data.get("reply_to_id")
                message_type = data.get("message_type", "text")
                voice_duration = data.get("voice_duration")
                file_size = data.get("file_size")

                # ✅ VALIDATE REQUIRED FIELDS
                if not msg_type:
                    await websocket.send_json({
                        "type": "error", 
                        "error": "Message type is required"
                    })
                    continue

                # === HANDLE MESSAGE TYPES ===

                # ✅ TEXT/VOICE/FILE MESSAGE
                if msg_type == "message":
                    if not content or not content.strip():
                        await websocket.send_json({
                            "type": "error",
                            "error": "Message content cannot be empty"
                        })
                        continue

                    try:
                        # Create message in DB
                        msg = create_private_message(
                            db=db,
                            sender_id=current_user.id,
                            receiver_id=friend_id,
                            content=content.strip(),
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
                            joinedload(PrivateMessage.reply_to).joinedload(PrivateMessage.sender)
                        ).filter(PrivateMessage.id == msg.id).first()

                        if not full_msg:
                            await websocket.send_json({
                                "type": "error", 
                                "error": "Failed to create message"
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
                            "sender_id": full_msg.sender_id,
                            "sender_username": current_user.username,
                            "receiver_id": full_msg.receiver_id,
                            "content": full_msg.content,
                            "message_type": full_msg.message_type.value,
                            "is_read": full_msg.is_read,
                            "read_at": full_msg.read_at.isoformat() if full_msg.read_at else None,
                            "delivered_at": full_msg.delivered_at.isoformat() if full_msg.delivered_at else None,
                            "created_at": full_msg.created_at.isoformat(),
                            "reply_to_id": full_msg.reply_to_id,
                            "avatar_url": full_msg.sender.avatar_url,
                            "voice_duration": full_msg.voice_duration,
                            "file_size": full_msg.file_size,
                            "seen_by": seen_by
                        }

                        # ✅ ADD REPLY_TO DATA IF EXISTS
                        if full_msg.reply_to:
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
                                "sender_username": full_msg.reply_to.sender.username,
                                "voice_duration": full_msg.reply_to.voice_duration,
                                "file_size": full_msg.reply_to.file_size,
                                "seen_by": reply_seen_by
                            }

                        # ✅ BROADCAST TO BOTH USERS
                        await manager.broadcast(chat_id, message_data)

                    except Exception:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to send message"
                        })

                # ✅ READ RECEIPTS
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
                            # Get the updated message with seen status information
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

                                # ✅ BROADCAST MESSAGE UPDATE
                                await manager.broadcast(chat_id, {
                                    "type": "message_updated",
                                    "message_id": message_id,
                                    "is_read": True,
                                    "read_at": datetime.utcnow().isoformat(),
                                    "seen_by": seen_by
                                })

                        else:
                            await websocket.send_json({
                                "type": "error",
                                "error": "Failed to mark message as read"
                            })
                            
                    except Exception:
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
                    except Exception:
                        pass

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
                    except Exception:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "error": "Failed to delete message"
                        })

                # ✅ UNKNOWN MESSAGE TYPE
                else:
                    await websocket.send_json({
                        "type": "error",
                        "error": f"Unknown message type: {msg_type}"
                    })

            except asyncio.TimeoutError:
                # ✅ HANDLE TIMEOUT (NORMAL - WAITING FOR MESSAGES)
                continue  # Just continue waiting for messages
                
            except WebSocketDisconnect:
                # ✅ CLIENT DISCONNECTED NORMALLY
                break
                
            except Exception:
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Internal server error"
                    })
                except Exception:
                    break  # Client disconnected

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # ✅ PROPER CLEANUP - ALWAYS EXECUTED
        try:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
        except Exception:
            pass

        # ✅ DISCONNECT FROM MANAGER
        if current_user:
            chat_id = _chat_id(current_user.id, friend_id)
            manager.disconnect(chat_id, websocket)

@router.websocket("/group/{group_id}")
async def ws_group_chat(
    websocket: WebSocket,
    group_id: int,
    # db: Session = Depends(get_db)
):
    await websocket.accept()
    
    with get_session() as db:

        current_user = await get_current_user_ws(websocket, db)
        if not current_user:
            await websocket.close(code=4001, reason="Please login to use chat")
            return

        if not is_group_member(db, group_id, current_user.id):
            await websocket.close(code=4003, reason="Not a member of this group")
            return

        chat_id = f"group_{group_id}"
        manager.active_connections.setdefault(chat_id, set()).add(websocket)

        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("message_type", "text")
                content = data.get("content")
                parent_message_id = data.get("reply_to")  # Optional
                action = data.get("action")
                incoming_temp_id = data.get("temp_id")

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

                    forwarded_msgs = await handle_forward_message(
                        db,
                        current_user_id=current_user.id,
                        message_id=message_id,
                        target_group_ids=target_group_ids
                    )

                    await websocket.send_json({
                        "action": "forwarded",
                        "message_id": message_id,
                        "forwarded_to": target_group_ids,
                        "forwarded_by": {
                            "id": current_user.id,
                            "username": current_user.username,
                            "avatar_url": current_user.avatar_url
                        },
                        "sender": {
                            "id": current_user.id,
                            "username": current_user.username,
                            "avatar_url": current_user.avatar_url
                        }
                    })

                    for gid, fwd_msg in zip(target_group_ids, forwarded_msgs):
                        target_chat_id = f"group_{gid}"
                        await manager.broadcast(target_chat_id, {
                            "action": "new_message",
                            **fwd_msg
                        })

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

                try:
                    msg = GroupMessage(
                        group_id=group_id,
                        sender_id=current_user.id,
                        content=content,
                        message_type=MessageType(message_type),
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
                        "sender": {
                            "id": parent.sender.id,
                            "username": parent.sender.username,
                            "avatar_url": parent.sender.avatar_url
                        }
                    }

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
                    # "updated_at": to_local_iso(msg.updated_at, tz_offset_hours=7),
                    "file_url": msg.file_url,
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
            manager.disconnect(chat_id, websocket)
        except Exception as e:
            traceback.print_exc()
            print(f"[WS Error] {e}")
            await websocket.close(code=1011, reason="Server error")


@router.websocket("/private/{friend_id}")
async def websocket_private_chat(
    websocket: WebSocket,
    friend_id: int,
    token: str = Query(..., description="JWT token")
):
    """
    WebSocket endpoint for private chat with a friend
    """
    await handle_websocket_private(websocket, friend_id, token)