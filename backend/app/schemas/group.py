
from datetime import datetime
from time import timezone
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal
from app.schemas.base import TimestampMixin
from app.schemas.user import UserOut

MessageType = Literal["text", "image", "file"]

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    invite_user_ids: List[int] = []

class GroupOut(TimestampMixin):
    id: int
    name: str
    creator_id: int
    description: Optional[str] = None
    
    class Config:
        from_attributes = True
class GroupInviteOut(BaseModel):
    id: int
    group: GroupOut
    inviter: UserOut
    created_at: datetime

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

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: (
                dt.replace(tzinfo=datetime.timezone.utc) if dt.tzinfo is None
                else dt.astimezone(timezone.utc)
            ).isoformat().replace("+00:00", "Z")
        }
    )