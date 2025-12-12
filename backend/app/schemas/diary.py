from pydantic import BaseModel, ConfigDict, field_serializer, validator
from typing import Literal, Optional, List
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone  

ShareTypeInput = Literal["public", "friends", "group", "personal"]
ShareTypeOutput = str


class DiaryCreate(BaseModel):
    title: str
    content: str
    share_type: ShareTypeInput
    group_ids: Optional[List[int]] = None
    
    @validator('share_type', pre=True)
    def strip_share_type(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v
    
class DiaryShare(BaseModel):
    # share_type: ShareTypeInput
    group_ids: List[int] = None
    
class CreateDiaryForGroup(BaseModel):
    title: str
    content: str

class CreatorResponse(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    
class GroupResponse(BaseModel):
    id: int
    name: str

class DiaryLikeResponse(BaseModel):
    id: int
    user: CreatorResponse
    
class CommentResponse(BaseModel):
    content: str
    created_at: datetime
    user: CreatorResponse
    
    class Config:
        form_attributes = True
    
class DiaryOut(TimestampMixin):
    id: int
    author : CreatorResponse
    title: str
    content: str
    share_type: ShareTypeOutput
    groups: Optional[List[GroupResponse]] = None
    likes: Optional[list[DiaryLikeResponse]] = None
    comments: Optional[list[CommentResponse]] = None
    is_deleted: Optional[bool] = None,
    created_at: datetime
    shared_id: Optional[int] = None
    is_shared: Optional[bool] = None
    shared_by: Optional[CreatorResponse] = None
    shared_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
    @field_serializer('created_at', 'updated_at')
    def serialize_dates(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        # Always return ISO 8601 with UTC timezone
        if dt.tzinfo is None:
            # If naive datetime, format as UTC
            return dt.isoformat() + 'Z'
        else:
            # If timezone-aware, convert to UTC then format
            utc_dt = dt.astimezone(timezone.utc)
            return utc_dt.isoformat().replace('+00:00', 'Z')


class DiaryCommentCreate(BaseModel):
    content: str

class DiaryCommentOut(TimestampMixin):
    id: int
    diary_id: int
    user: CreatorResponse
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    @field_serializer('created_at')
    def serialize_created_at(self, v: datetime, _info) -> str:
        if v.tzinfo is None:
            return v.isoformat() + 'Z'
        return v.isoformat()
    
class DiaryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    share_type: Optional[ShareTypeInput] = None
    group_ids: Optional[List[int]] = None
    
    class Config:
        use_enum_values = True
    
class CommentUpdate(BaseModel):
    content: str
    