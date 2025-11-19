from app.models.group_message import GroupMessage, MessageType
from app.models.group_member import GroupMember
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from app.schemas.group import GroupMessageUpdate
from datetime import datetime
from app.core.cloudinary import upload_to_cloudinary, delete_from_cloudinary, configure_cloudinary, extract_public_id_from_url
from pathlib import Path
import uuid
from app.models.group_message_seen import GroupMessageSeen
from app.services.websocket_manager import manager

configure_cloudinary()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 3 * 1024 * 1024  # 3MB

def update_message(db: Session, message_id: int, message_data: GroupMessageUpdate, current_user_id: int):
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Message not found")
        
    if message.sender_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only sender can use this feature")
        
    message.content= message_data.content
    message.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(message)

    return message

async def delete_message(db: Session, message_id: int, current_user_id: int):
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Message not found")
        
    if message.sender_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    if message.file_url:
        public_id = extract_public_id_from_url(message.file_url)
        if public_id:
            delete_from_cloudinary(public_id)
    
    db.delete(message)
    db.commit()
    return {"detail": "Message has been deleted"}

async def upload_file_message(db: Session, group_id: int, file: UploadFile, current_user_id: int):
    is_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user_id
    ).first()
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only member can upload file")
        
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only png and JPG are allowed")
        
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="File is too large, Max size is 3MB")
        
    unique_filename = f"groups/{group_id}/messages/{uuid.uuid4().hex}{file_extension}"
    
    upload_result = upload_to_cloudinary(content, public_id=unique_filename)
    if not upload_result or "secure_url" not in upload_result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to upload file")
        
    save_message = GroupMessage(
        group_id=group_id,
        sender_id=current_user_id,
        created_at = datetime.utcnow(),
        message_type = MessageType.image,
        public_id = upload_result["public_id"],
        file_url = upload_result["secure_url"],    
        content = None
    )
    
    db.add(save_message)
    db.commit()
    db.refresh(save_message)
    return save_message

async def update_file_message(db: Session, message_id: int, file: UploadFile, current_user_id: int):
    
    message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Message not found")

    if message.sender_id != current_user_id:
        raise HTTPException(status_code.status.HTTP_403_FORBIDDEN,
                            detail="Only sender can update")
    
    if message.file_url:    
        public_id = extract_public_id_from_url(message.file_url)
        delete_from_cloudinary(public_id)
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only png and JPG are allowed")
        
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="File is too large, Max size is 3MB")
        
    unique_filename = f"groups/{message.group_id}/messages/{uuid.uuid4().hex}{file_extension}"
    
    upload_result = upload_to_cloudinary(content, public_id=unique_filename)
    if not upload_result or "secure_url" not in upload_result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to upload file")
        
    message.public_id = upload_result["public_id"]
    message.file_url = upload_result["secure_url"]
    message.updated_at = datetime.utcnow()
        
    db.commit()
    db.refresh(message)
    
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
        
def get_seen_messages(db: Session, message_id):
    seen_messages = db.query(GroupMessageSeen).filter(
        GroupMessageSeen.message_id == message_id
    ).all()
    if not seen_messages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Seen message not found")
    
    return seen_messages
    