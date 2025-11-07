# In app/schemas/note.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class NoteBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    title: str
    content: Optional[str] = None
    is_pinned: bool = False
    is_archived: bool = False
    color: str = "#ffffff"

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    color: Optional[str] = None

class NoteOut(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime