from pydantic import BaseModel
from typing import Optional, Literal
from app.schemas.base import TimestampMixin

MessageType = Literal["text", "image", "file"]

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class GroupOut(TimestampMixin):
    id: int
    name: str
    creator_id: int
    description: Optional[str] = None

    class Config:
        from_attributes = True

class GroupMessageCreate(BaseModel):
    content: str
    message_type: MessageType = "text"

class GroupMessageOut(TimestampMixin):
    id: int
    sender_id: int
    group_id: int
    content: str
    message_type: MessageType

    class Config:
        from_attributes = True