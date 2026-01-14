import base64
from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Union
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

class UserResponse(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    email: str

class FriendResponse(BaseModel):
    id: int
    user: Optional[UserResponse] = None
    friend: Optional[UserResponse] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True