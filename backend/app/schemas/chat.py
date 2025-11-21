from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional, List
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

MessageTypeInput = Literal["text", "image", "file", "voice"]

class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"
    reply_to_id: Optional[int] = None
    is_forwarded: Optional[bool] = False  
    original_sender: Optional[str] = None  
    voice_duration: Optional[float] = None 
    file_size: Optional[int] = None 

class MessageOut(TimestampMixin):
    id: int
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
        return data

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
    seen_by: Optional[List[GroupMessageSeen]] = []
    
    parent_message: Optional[ParentMessageResponse] = None

    class Config:
        from_attributes = True
