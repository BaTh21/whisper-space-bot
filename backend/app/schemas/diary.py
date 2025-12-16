from pydantic import BaseModel, ConfigDict, field_serializer, validator, Field
from typing import Literal, Optional, List, Union
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

ShareTypeInput = Literal["public", "friends", "group", "personal"]
ShareTypeOutput = str

class DiaryCreate(BaseModel):
    title: str
    content: str
    share_type: ShareTypeInput
    group_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None  # Base64 encoded images
    
    @validator('share_type', pre=True)
    def strip_share_type(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v
    
    @validator('images')
    def validate_images(cls, v):
        if v is None:
            return v
        for img in v:
            if not img.startswith('data:image/'):
                raise ValueError('Images must be base64 encoded with data URL')
        return v

class DiaryShare(BaseModel):
    group_ids: List[int] = None

class CreateDiaryForGroup(BaseModel):
    title: str
    content: str
    images: Optional[List[str]] = None
    
    @validator('images')
    def validate_images(cls, v):
        if v is None:
            return v
        for img in v:
            if not img.startswith('data:image/'):
                raise ValueError('Images must be base64 encoded with data URL')
        return v

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

class CommentReplyResponse(BaseModel):
    id: int
    user: CreatorResponse
    content: str
    images: Optional[List[str]] = None
    created_at: datetime
    parent_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)
    
class CommentResponse(BaseModel):
    content: str
    created_at: datetime
    user: CreatorResponse
    images: Optional[List[str]] = None
    replies: Optional[List[CommentReplyResponse]] = None
    parent_id: Optional[int] = None
    
    class Config:
        form_attributes = True
    
class DiaryOut(TimestampMixin):
    id: int
    author: CreatorResponse
    title: str
    content: str
    share_type: ShareTypeOutput
    groups: Optional[List[GroupResponse]] = None
    likes: Optional[list[DiaryLikeResponse]] = None
    comments: Optional[list[CommentResponse]] = None
    is_deleted: Optional[bool] = None
    images: Optional[List[str]] = None  # Cloudinary URLs
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('created_at', 'updated_at')
    def serialize_dates(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + 'Z'
        else:
            utc_dt = dt.astimezone(timezone.utc)
            return utc_dt.isoformat().replace('+00:00', 'Z')

class DiaryCommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None
    images: Optional[List[str]] = None
    
    @validator('images')
    def validate_images(cls, v):
        if v is None:
            return v
        for img in v:
            if not img.startswith('data:image/'):
                raise ValueError('Images must be base64 encoded with data URL')
        return v

class DiaryCommentOut(TimestampMixin):
    id: int
    diary_id: int
    user: CreatorResponse
    content: str
    images: Optional[List[str]] = None
    parent_id: Optional[int] = None
    replies: Optional[List['DiaryCommentOut']] = None
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
    share_type: Optional[Union[ShareTypeInput,str]] = None
    group_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True

class CommentUpdate(BaseModel):
    content: str
    images: Optional[List[str]] = None