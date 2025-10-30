# app/schemas/chat.py
from __future__ import annotations   # ADD THIS LINE AT THE TOP

from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

MessageTypeInput = Literal["text", "image", "file"]

class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"
    reply_to_id: Optional[int] = None  # NEW


class MessageOut(TimestampMixin):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    is_read: bool = False
    reply_to_id: Optional[int] = None
    reply_to: Optional["MessageOut"] = None  # Now works!

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        if obj.reply_to:
            data.reply_to = cls.from_orm(obj.reply_to)
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