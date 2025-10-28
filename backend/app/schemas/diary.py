# app/schemas/diary.py
from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional
from app.schemas.base import TimestampMixin


ShareTypeInput = Literal["public", "friends", "group"]
ShareTypeOutput = str


class DiaryCreate(BaseModel):
    title: str
    content: str
    share_type: ShareTypeInput
    group_id: Optional[int] = None


class DiaryOut(TimestampMixin):
    id: int
    user_id: int
    title: str
    content: str
    share_type: ShareTypeOutput
    group_id: Optional[int] = None
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class DiaryCommentCreate(BaseModel):
    content: str


class DiaryCommentOut(TimestampMixin):
    id: int
    diary_id: int
    user_id: int
    content: str
    username: Optional[str] = None  # Add username field instead of full user object
    created_at: str  # Make sure this is included

    model_config = ConfigDict(from_attributes=True)