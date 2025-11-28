from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional, List
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone
from pydantic import validator, field_validator

from app.models.private_message import MessageType

MessageTypeInput = Literal["text", "image", "file", "voice"]

class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"
    reply_to_id: Optional[int] = None
    is_forwarded: Optional[bool] = False  
    original_sender: Optional[str] = None  
    voice_duration: Optional[float] = None 
    file_size: Optional[int] = None 
    
    @field_validator('voice_duration')
    @classmethod
    def voice_duration_required(cls, v, info):
        # Get the entire data being validated
        data = getattr(info, 'data', {})
        message_type = data.get('message_type')
        
        if message_type == 'voice' and v is None:
            raise ValueError('voice_duration is required for voice messages')
        return v

    @field_validator('content')
    @classmethod
    def content_must_be_url_for_voice(cls, v, info):
        # Get the entire data being validated
        data = getattr(info, 'data', {})
        message_type = data.get('message_type')
        
        if message_type == 'voice':
            if not v.startswith(('http://', 'https://')):
                raise ValueError('Voice message content must be a valid URL')
        elif not v or not v.strip():
            raise ValueError('Text message cannot be empty')
        return v
    

class MessageSeenByUser(BaseModel):
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    seen_at: str
    
class ReplyPreview(BaseModel):
    """Compact reply preview like Telegram"""
    id: int
    sender_username: str
    content: str
    message_type: str
    voice_duration: Optional[float] = None
    file_size: Optional[int] = None

class MessageOut(TimestampMixin):
    id: int
    temp_id: Optional[str] = None
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    is_read: bool = False
    reply_to_id: Optional[int] = None
    reply_to: Optional["MessageOut"] = None
    read_at: Optional[str] = None  
    delivered_at: Optional[str] = None
    created_at: str 
    is_forwarded: Optional[bool] = False
    original_sender: Optional[str] = None
    # ADD THESE TWO FIELDS
    sender_username: Optional[str] = None
    receiver_username: Optional[str] = None
    voice_duration: Optional[float] = None  # ADDED
    file_size: Optional[int] = None  # ADDED
    seen_by: List[MessageSeenByUser] = []

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        if obj.reply_to:
            data.reply_to = cls.from_orm(obj.reply_to)
        # Add username data when using from_orm
        if hasattr(obj, 'sender') and obj.sender:
            data.sender_username = obj.sender.username
        if hasattr(obj, 'receiver') and obj.receiver:
            data.receiver_username = obj.receiver.username
            
        # ADD THIS: Populate seen_by information
        if hasattr(obj, 'seen_statuses'):
            data.seen_by = [
                MessageSeenByUser(
                    user_id=status.user.id,
                    username=status.user.username,
                    avatar_url=status.user.avatar_url,
                    seen_at=status.seen_at.isoformat() if status.seen_at else None
                )
                for status in obj.seen_statuses
            ]
        return data
    
    @staticmethod
    def _truncate_reply_content(replied_message) -> str:
        """Truncate reply content like Telegram does"""
        content = replied_message.content or ""
        
        # Handle different message types
        if replied_message.message_type == MessageType.voice:
            return "🎤 Voice message"
        elif replied_message.message_type == MessageType.image:
            return "🖼️ Photo"
        elif replied_message.message_type == MessageType.file:
            return "📎 File"
        
        # Truncate text content
        if len(content) > 100:
            return content[:100] + "..."
        return content

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: (
                dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None
                else dt.astimezone(timezone.utc)
            ).isoformat().replace("+00:00", "Z")
        }
    )
    
class AuthorResponse(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    
class ReplyResponse(BaseModel):
    id: Optional[int] = None
    content: Optional[str] = None
    created_at: Optional[datetime] = None
    sender: AuthorResponse

    class Config:
        from_attributes = True

class ParentMessageResponse(BaseModel):
    id: int
    sender: AuthorResponse
    content: Optional[str] = None
    file_url: Optional[str] = None
    voice_url: Optional[str] = None
    
class MarkMessagesAsReadRequest(BaseModel):
    message_ids: List[int]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message_ids": [1, 2, 3, 4]
            }
        }
    )

class MarkMessagesAsReadResponse(BaseModel):
    status: str
    marked_count: int
    message_ids: List[int]    
    
    
class GroupMessageSeen(BaseModel):
    id: int
    user: AuthorResponse    
    seen_at: datetime

class GroupMessageOut(BaseModel):
    id: int
    incoming_temp_id: Optional[str] = None
    sender: AuthorResponse
    forwarded_by: Optional[AuthorResponse] = None
    group_id: int
    content: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    file_url: Optional[str] = None
    voice_url: Optional[str] = None
    seen_by: Optional[List[GroupMessageSeen]] = []
    temp_id: Optional[str] = None
    
    parent_message: Optional[ParentMessageResponse] = None

    class Config:
        from_attributes = True
