# app/schemas/chat.py
from pydantic import BaseModel, ConfigDict
from typing import Literal
from app.schemas.base import TimestampMixin


MessageTypeInput = Literal["text", "image", "file"]


class MessageCreate(BaseModel):
    content: str
    message_type: MessageTypeInput = "text"


class MessageOut(TimestampMixin):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str  # ← str
    is_read: bool = False

    model_config = ConfigDict(from_attributes=True)