from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional, List
from app.schemas.base import TimestampMixin


ShareTypeInput = Literal["public", "friends", "group", "personal"]
ShareTypeOutput = str


class DiaryCreate(BaseModel):
    title: str
    content: str
    share_type: ShareTypeInput
    group_ids: Optional[List[int]] = None
    
class CreatorResponse(BaseModel):
    id: int
    username: str
    
class GroupResponse(BaseModel):
    id: int
    name: str

class DiaryOut(TimestampMixin):
    id: int
    author : CreatorResponse
    title: str
    content: str
    share_type: ShareTypeOutput
    groups: List[GroupResponse]
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class DiaryCommentCreate(BaseModel):
    content: str


class DiaryCommentOut(TimestampMixin):
    id: int
    diary_id: int
    user: CreatorResponse
    content: str
    username: Optional[str] = None  # Add username field instead of full user object
    created_at: str  # Make sure this is included

    model_config = ConfigDict(from_attributes=True)