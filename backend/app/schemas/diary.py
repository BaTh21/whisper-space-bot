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

class DiaryLikeResponse(BaseModel):
    id: int
    user: CreatorResponse
    
class DiaryOut(TimestampMixin):
    id: int
    author : CreatorResponse
    title: str
    content: str
    share_type: ShareTypeOutput
    groups: List[GroupResponse]
    likes: list[DiaryLikeResponse]
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class DiaryCommentCreate(BaseModel):
    content: str

class DiaryCommentOut(TimestampMixin):
    id: int
    diary_id: int
    author: CreatorResponse
    content: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)