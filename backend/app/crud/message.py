from app.models.group_message import GroupMessage, MessageType
from app.models.group_member import GroupMember
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from app.schemas.group import GroupMessageUpdate
from app.schemas.chat import ParentMessageResponse, AuthorResponse, GroupMessageOut
from datetime import datetime, timezone
from app.core.cloudinary import extract_public_id_from_url, upload_to_cloudinary, delete_from_cloudinary, configure_cloudinary
from pathlib import Path
import uuid
from app.models.group_message_seen import GroupMessageSeen
from app.services.websocket_manager import manager
from app.helpers.to_utc_iso import to_local_iso
from app.models.user import User
import cloudinary
import cloudinary.uploader
from app.services.websocket_manager import manager

configure_cloudinary()

ALLOWED_EXTENSIONS = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",

    ".pdf": "file",
    ".txt": "file",
    ".doc": "file",
    ".docx": "file",
    ".zip": "file",

    ".mp4": "video",
    ".mov": "video",
    ".mkv": "video",
}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 3MB

def update_message(db: Session, message_id: int, content: str, current_user_id: int):
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Message not found")
        
    if message.sender_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only sender can use this feature")
        
    message.content= content
    message.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(message)

    return message

async def delete_message(db: Session, message_id: int, current_user_id: int):
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user_id:
        raise HTTPException(status_code=403, detail="Only sender can delete this message")

    if message.file_url:
        public_id = extract_public_id_from_url(message.file_url)
        if public_id:
            delete_from_cloudinary(public_id)

    if message.voice_url:
        await delete_voice_message(message)

    db.query(GroupMessageSeen).filter(GroupMessageSeen.message_id == message.id).delete(synchronize_session=False)

    db.delete(message)
    db.commit()

    return {"detail": "Message has been deleted"}

async def upload_file_message(
    db: Session,
    group_id: int,
    file: UploadFile,
    current_user_id: int,
    temp_id: str,
    parent_message_id: int | None = None,
):
    is_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user_id
    ).first()
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only members can upload files")
        
    if parent_message_id:
        parent_exists = db.query(GroupMessage).filter(
            GroupMessage.id == parent_message_id,
            GroupMessage.group_id == group_id
        ).first()

        if not parent_exists:
            raise HTTPException(status_code=404, detail="Parent message not found")
        
    file_extension = Path(file.filename).suffix.lower()

    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type"
        )

    message_type = ALLOWED_EXTENSIONS[file_extension]

    resource_type = "image"
    if message_type == "video":
        resource_type = "video"
    elif message_type == "file":
        resource_type = "raw"

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large"
        )

    unique_filename = f"groups/{group_id}/messages/{uuid.uuid4().hex}{file_extension}"

    upload_result = upload_to_cloudinary(
        file.file,
        public_id=unique_filename,
        resource_type=resource_type,
    )
    
    save_message = GroupMessage(
        group_id=group_id,  
        sender_id=current_user_id,
        message_type=message_type,
        public_id=upload_result["public_id"],
        file_url=upload_result["secure_url"],    
        content=None,
        parent_message_id=parent_message_id,
    )
    db.add(save_message)
    db.commit()
    db.refresh(save_message)
    
    parent_msg_data = None

    if save_message.parent_message:
        parent = save_message.parent_message
        parent_msg_data = {
            "id": parent.id,
            "message_type": parent.message_type.value if hasattr(parent.message_type, "value") else parent.message_type,
            "content": parent.content,
            "call_content": parent.call_content,
            "file_url": parent.file_url,
            "voice_url": parent.voice_url,
            "sender": {
                "id": parent.sender.id,
                "username": parent.sender.username,
                "avatar_url": parent.sender.avatar_url,
            }
        }
    
    payload = {
        "action": "file_upload",
        "id": save_message.id,
        "sender": {
            "id": save_message.sender.id,
            "username": save_message.sender.username,
            "avatar_url": save_message.sender.avatar_url,
        },
        "message_type": save_message.message_type,
        "file_url": save_message.file_url,
        "created_at": to_local_iso(save_message.created_at, tz_offset_hours=7),
        "temp_id": temp_id,
        "parent_message": parent_msg_data 
    }
    
    await manager.broadcast(f"group_{group_id}", payload)
    
    return save_message

async def update_file_message(
    db: Session,
    message_id: int,
    file: UploadFile,
    current_user_id: int,
    temp_id: str,
):
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Message not found")

    if message.sender_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only sender can update")

    # Delete old file if exists
    if message.file_url:
        public_id = extract_public_id_from_url(message.file_url)
        delete_from_cloudinary(public_id)

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type"
        )

    message_type = ALLOWED_EXTENSIONS[file_extension]

    # Determine resource type for Cloudinary
    resource_type = "image"
    if message_type == "video":
        resource_type = "video"
    elif message_type == "file":
        resource_type = "raw"

    # Reset file pointer
    file.file.seek(0)

    # Check size (still optional)
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large"
        )

    unique_filename = f"groups/{message.group_id}/messages/{uuid.uuid4().hex}{file_extension}"

    # Upload directly using file-like object (required for videos)
    upload_result = upload_to_cloudinary(
        file.file,
        public_id=unique_filename,
        resource_type=resource_type,
    )

    if not upload_result or "secure_url" not in upload_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )

    # Update message in DB
    message.public_id = upload_result["public_id"]
    message.file_url = upload_result["secure_url"]
    message.message_type = message_type
    message.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    # Broadcast update via WebSocket
    payload = {
        "action": "file_update",
        "sender": {
            "id": message.sender.id,
            "username": message.sender.username,
            "avatar_url": message.sender.avatar_url,
        },
        "message_id": message.id,
        "file_url": message.file_url,
        "message_type": message.message_type,
        "updated_at": to_local_iso(message.updated_at, tz_offset_hours=7),
        "temp_id": temp_id,
    }

    await manager.broadcast(f"group_{message.group_id}", payload)

    return message

async def handle_seen_message(db, current_user_id, group_id, message_id, chat_id):
    try:
    
        msg = db.query(GroupMessage).filter(
            GroupMessage.id == message_id,
            GroupMessage.group_id == group_id
        ).first()
        if not msg:
            return 

        seen_record = db.query(GroupMessageSeen).filter_by(
            message_id = message_id,
            user_id=current_user_id
        ).first()
        if seen_record and seen_record.seen:
            return 
        
        now = datetime.utcnow()
        
        if not seen_record:
            seen_record = GroupMessageSeen(
                message_id=message_id,
                user_id=current_user_id,
                seen=True,
                seen_at=now
            )
            db.add(seen_record)
        else:
            seen_record.seen = True
            seen_record.seen_at = now
            
        db.commit()

        await manager.broadcast(chat_id, {
            "event": "message_seen",
            "message_id": message_id,
            "user_id": current_user_id,
            "seen_at": now.isoformat(),
        })

    except Exception as e:
        db.rollback()
        print(f"[Seen Error] {e}")
        
async def handle_forward_message(
    db: Session,
    current_user_id: int,
    message_id: int,
    target_group_ids: list[int],
):
    forwarded_messages = []

    original = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not original:
        raise HTTPException(
            status_code=404, detail="Original message not found"
        )
        
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        return []
    
    forwarded_messages = []
    
    for group_id in target_group_ids:
        chat_id = f"group_{group_id}"
        
        new_msg = GroupMessage(
            group_id=group_id,
            sender_id=current_user_id,
            forwarded_by_id=original.sender.id,
            forwarded_at=datetime.utcnow(),
            parent_message_id=original.parent_message_id,
            content=original.content,
            call_content=original.call_content,
            file_url=original.file_url,
            voice_url=original.voice_url,
            public_id=original.public_id,
            voice_public_id=original.voice_public_id,
            message_type=original.message_type
        )

        db.add(new_msg)
        db.commit()
        db.refresh(new_msg)

        msg_out = {
            "action": "forward",
            "id": new_msg.id,
            "group_id": group_id,
            "message_type": new_msg.message_type.value,
            "content": new_msg.content,
            "call_content": new_msg.call_content,
            "sender": {
                "id": user.id,
                "username": user.username,
                "avatar_url": user.avatar_url
            },
            "forwarded_by": {
                "id": original.sender.id,
                "username": original.sender.username,
                "avatar_url": original.sender.avatar_url
            },
            "parent_message": {
                "id": original.id,
                "content": original.content,
                "file_url": original.file_url,
                "sender": {
                    "id": original.sender.id,
                    "username": original.sender.username,
                    "avatar_url": original.sender.avatar_url
                }
            } if original.parent_message_id else None,
            "file_url": new_msg.file_url,
            "voice_url": new_msg.voice_url,
            "created_at": to_local_iso(new_msg.created_at, tz_offset_hours=7),
            # "updated_at": to_local_iso(new_msg.created_at, tz_offset_hours=7)
        }

        await manager.broadcast(chat_id, msg_out)
        forwarded_messages.append(msg_out)

    return forwarded_messages
        
def get_seen_messages(db: Session, message_id):
    seen_messages = db.query(GroupMessageSeen).filter(
        GroupMessageSeen.message_id == message_id
    ).all()
    if not seen_messages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Seen message not found")
    
    return seen_messages

async def upload_voice_message(group_id: int,
                         file: UploadFile,
                        #  duration: float,
                         db: Session,
                         current_user_id: int,
                         temp_id: str,
                         parent_message_id: int | None = None,
                         ):
    
    allowed_types = [
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 
        'audio/aac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'
    ]
    if not file.content_type or file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Supported: MP3, WAV, OGG, WEBM, AAC, M4A")
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    if parent_message_id:
        parent_exists = db.query(GroupMessage).filter(
            GroupMessage.id == parent_message_id,
            GroupMessage.group_id == group_id
        ).first()

        if not parent_exists:
            raise HTTPException(status_code=404, detail="Parent message not found")
    
    upload_result = cloudinary.uploader.upload(
        content,
        resource_type="video",
        folder="whisper_space/group/voice_messages",
        public_id=f"user_{current_user_id}_{uuid.uuid4().hex}",
        overwrite=False
    )
    voice_url = upload_result["secure_url"]
    voice_public_id = upload_result["public_id"]
    
    new_message = GroupMessage(
        group_id=group_id,
        sender_id=current_user_id,
        message_type=MessageType.voice,
        voice_url = voice_url,
        voice_public_id=voice_public_id,
        parent_message_id=parent_message_id
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    parent_msg_data = None

    if new_message.parent_message:
        parent = new_message.parent_message
        parent_msg_data = {
            "id": parent.id,
            "message_type": parent.message_type.value if hasattr(parent.message_type, "value") else parent.message_type,
            "content": parent.content,
            "call_content": parent.call_content,
            "file_url": parent.file_url,
            "voice_url": parent.voice_url,
            "sender": {
                "id": parent.sender.id,
                "username": parent.sender.username,
                "avatar_url": parent.sender.avatar_url,
            }
        }
    
    payload = {
        "action": "file_upload",
        "id": new_message.id,
        "sender": {
            "id": new_message.sender.id,
            "username": new_message.sender.username,
            "avatar_url": new_message.sender.avatar_url,
        },
        "message_type": new_message.message_type.voice,
        "voice_url": new_message.voice_url,
        "created_at": to_local_iso(new_message.created_at, tz_offset_hours=7),
        "temp_id": temp_id,
        "parent_message": parent_msg_data 
    }
    
    await manager.broadcast(f"group_{group_id}", payload)
    
    return new_message

async def delete_voice_message(message: GroupMessage):
    if not message.voice_public_id:
        return

    try:
        result = cloudinary.uploader.destroy(
            message.voice_public_id,
            resource_type="video"
        )
        if result.get("result") != "ok":
            print(f"[Warning] Cannot delete voice message from Cloudinary: {message.id}")
    except Exception as e:
        print(f"[Error] Failed to delete voice message id {message.id}: {str(e)}")
        
def is_user_online(user_id: int) -> bool:
    return user_id in manager.user_connections and len(manager.user_connections[user_id]) > 0
        
