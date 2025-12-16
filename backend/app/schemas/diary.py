import base64
from pydantic import BaseModel, ConfigDict, field_serializer, validator, Field
from typing import Literal, Optional, List, Union
from app.schemas.base import TimestampMixin
from datetime import datetime, timezone

ShareTypeInput = Literal["public", "friends", "group", "personal"]
ShareTypeOutput = str

class DiaryCreate(BaseModel):
    title: str
    content: str
    share_type: str = Field(..., pattern="^(public|friends|group|personal)$")
    group_ids: Optional[List[int]] = None
    images: Optional[List[Union[str, bytes]]] = Field(None, max_items=10)  # Accept both base64 strings and bytes
    
    @validator('share_type', pre=True)
    def normalize_share_type(cls, v):
        if isinstance(v, str):
            v = v.strip().lower()
        return v
    
    @validator('images', pre=True)
    def validate_and_process_images(cls, v):
        if v is None or len(v) == 0:
            return v
        
        if not isinstance(v, list):
            raise ValueError('images must be a list')
        
        if len(v) > 10:
            raise ValueError('Maximum 10 images allowed')
        
        processed_images = []
        for img in v:
            if isinstance(img, bytes):
                # Convert bytes to base64 string
                img = f"data:image/jpeg;base64,{base64.b64encode(img).decode('utf-8')}"
            elif isinstance(img, str):
                # Validate base64 string
                if not img.startswith('data:image/'):
                    # Try to detect if it's plain base64
                    try:
                        # Check if it's a valid base64 string
                        base64.b64decode(img, validate=True)
                        # Assume it's JPEG if no mime type provided
                        img = f"data:image/jpeg;base64,{img}"
                    except:
                        raise ValueError('Images must be base64 encoded or data URLs')
            else:
                raise ValueError('Image must be string or bytes')
            
            # Validate size (max 5MB per image)
            base64_data = img.split(',')[1] if ',' in img else img
            if len(base64_data) * 3 / 4 > 5 * 1024 * 1024:  # Approximate size check
                raise ValueError('Each image must be less than 5MB')
            
            processed_images.append(img)
        
        return processed_images

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
    share_type: Optional[str] = None  # Remove pattern constraint for updates
    group_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None  # Use only string for base64
    
    class Config:
        from_attributes = True
    
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