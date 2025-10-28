# app/schemas/chat.py
from pydantic import BaseModel, ConfigDict
from typing import Literal
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone


MessageTypeInput = Literal["text", "image", "file"]


class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"


class MessageOut(TimestampMixin):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    is_read: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: (
                dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None
                else dt.astimezone(timezone.utc)
            ).isoformat().replace("+00:00", "Z")
        }
    )