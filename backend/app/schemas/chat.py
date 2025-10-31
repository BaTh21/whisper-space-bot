from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

MessageTypeInput = Literal["text", "image", "file"]

class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"
    reply_to_id: Optional[int] = None
    is_forwarded: Optional[bool] = False  # NEW: Forward flag
    original_sender: Optional[str] = None  # NEW: Original sender username

class MessageOut(TimestampMixin):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    is_read: bool = False
    reply_to_id: Optional[int] = None
    reply_to: Optional["MessageOut"] = None
    is_forwarded: Optional[bool] = False
    original_sender: Optional[str] = None
    # ADD THESE TWO FIELDS
    sender_username: Optional[str] = None
    receiver_username: Optional[str] = None

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