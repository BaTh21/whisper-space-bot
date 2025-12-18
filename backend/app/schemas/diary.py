import base64
from pydantic import BaseModel, ConfigDict, field_serializer, validator, Field
from typing import Literal, Optional, List, Union
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

ShareTypeInput = Literal["public", "friends", "group", "personal"]
ShareTypeOutput = str

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

class DiaryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    share_type: str = Field(..., pattern="^(public|friends|group|personal)$")
    group_ids: Optional[List[int]] = None
    images: Optional[List[str]] = Field(None, max_items=10)
    videos: Optional[List[str]] = Field(None, max_items=3)
    
    @validator('share_type', pre=True)
    def normalize_share_type(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v
    
    @validator('images', 'videos', pre=True, each_item=True)
    def validate_media_data(cls, v):
        if not v:
            return v
        
        if isinstance(v, str):
            # Check if it's already a URL
            if v.startswith(('http://', 'https://')):
                return v
            
            # Check if it's a data URL
            if v.startswith('data:'):
                if ',' not in v:
                    raise ValueError('Invalid data URL format')
                
                # Validate base64
                header, data = v.split(',', 1)
                try:
                    base64.b64decode(data, validate=True)
                    return v
                except:
                    raise ValueError('Invalid base64 encoding')
            
            # Try to decode as raw base64
            try:
                base64.b64decode(v, validate=True)
                # Determine MIME type
                if len(v) > 1000000:  # More than 1MB, likely video
                    return f"data:video/mp4;base64,{v}"
                else:
                    return f"data:image/jpeg;base64,{v}"
            except:
                raise ValueError('Invalid media data format')
        
        return v
    
    @validator('videos')
    def validate_video_size(cls, v):
        if not v:
            return v
        
        for video in v:
            if video.startswith('data:'):
                header, data = video.split(',', 1)
                size = len(data) * 3 / 4  # Approximate size in bytes
                if size > 50 * 1024 * 1024:  # 50MB
                    raise ValueError('Each video must be less than 50MB')
        
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
    replies: Optional[List['CommentReplyResponse']] = None
    parent_id: Optional[int] = None
    
    class Config:
        form_attributes = True
    
# FIXED: DiaryOut with proper defaults
class DiaryOut(BaseModel):
    id: int
    author: CreatorResponse
    title: str
    content: str
    share_type: str
    groups: Optional[List[GroupResponse]] = None
    likes: Optional[List[DiaryLikeResponse]] = None
    is_deleted: Optional[bool] = None
    images: List[str] = Field(default_factory=list)  # Fixed: Use default_factory
    videos: List[str] = Field(default_factory=list)  # Fixed: Use default_factory
    video_thumbnails: List[str] = Field(default_factory=list)  # FIXED: Not Optional, default empty list
    media_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('video_thumbnails')
    def serialize_video_thumbnails(self, thumbnails: List[str], _info) -> List[str]:
        # Filter out None values
        return [thumb for thumb in thumbnails if thumb is not None]
    
    @field_serializer('images', 'videos')
    def serialize_arrays(self, value: List[str], _info) -> List[str]:
        # Ensure we always return a list
        if value is None:
            return []
        return value
    
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
    share_type: Optional[str] = None
    group_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @validator('share_type', pre=True)
    def normalize_share_type(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip().lower()
            allowed_values = ["public", "friends", "group", "personal"]
            if v not in allowed_values:
                raise ValueError(f"share_type must be one of: {allowed_values}")
        return v
    
    @validator('images', pre=True)
    def validate_and_process_images(cls, v):
        if v is None:
            return v
        
        # If it's an empty list, return empty list
        if isinstance(v, list) and len(v) == 0:
            return []
        
        if not isinstance(v, list):
            raise ValueError('images must be a list')
        
        if len(v) > 10:
            raise ValueError('Maximum 10 images allowed')
        
        processed_images = []
        for img in v:
            if img is None:
                continue
                
            if isinstance(img, str):
                if (img.startswith('data:image/') or 
                    img.startswith(('http://', 'https://'))):
                    processed_images.append(img)
                else:
                    # Try to validate as base64
                    try:
                        base64.b64decode(img, validate=True)
                        processed_images.append(f"data:image/jpeg;base64,{img}")
                    except:
                        raise ValueError(f'Invalid image format: {img[:50]}...')
            else:
                raise ValueError('Image must be a string')
        
        return processed_images
    
    @validator('videos', pre=True)
    def validate_and_process_videos(cls, v):
        if v is None:
            return v
        
        if isinstance(v, list) and len(v) == 0:
            return []
        
        if not isinstance(v, list):
            raise ValueError('videos must be a list')
        
        if len(v) > 3:
            raise ValueError('Maximum 3 videos allowed')
        
        processed_videos = []
        for vid in v:
            if vid is None:
                continue
                
            if isinstance(vid, str):
                if (vid.startswith('data:video/') or 
                    vid.startswith(('http://', 'https://'))):
                    processed_videos.append(vid)
                else:
                    try:
                        base64.b64decode(vid, validate=True)
                        processed_videos.append(f"data:video/mp4;base64,{vid}")
                    except:
                        raise ValueError(f'Invalid video format: {vid[:50]}...')
            else:
                raise ValueError('Video must be a string')
        
        return processed_videos
    
    @validator('group_ids', pre=True)
    def validate_group_ids(cls, v, values):
        if v is None:
            return v
        
        # Only require group_ids if share_type is 'group'
        if values.get('share_type') == 'group':
            if not v or len(v) == 0:
                raise ValueError('group_ids are required when share_type is "group"')
            if not all(isinstance(gid, int) for gid in v):
                raise ValueError('All group_ids must be integers')
        return v

class CommentUpdate(BaseModel):
    content: str
    images: Optional[List[str]] = None