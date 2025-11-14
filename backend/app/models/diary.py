from sqlalchemy import Column, Enum, String, Text, Boolean, DateTime, ForeignKey, Integer
from app.models.base import Base
from datetime import datetime
import enum
from sqlalchemy.orm import relationship
from app.models.diary_group import DiaryGroup

class ShareType(enum.Enum):
    public = "public"
    friends = "friends"
    personal = "personal"
    group = "group"

class Diary(Base):
    __tablename__ = "diaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    share_type = Column(Enum(ShareType), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"))
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    author = relationship("User", back_populates="diaries")
    diary_groups = relationship("DiaryGroup", back_populates="diary", cascade="all, delete-orphan")
    groups = relationship("Group", secondary="diary_groups", viewonly=True)
    
    likes = relationship("DiaryLike", back_populates="diary", cascade="all, delete-orphan")
    comments = relationship("DiaryComment", back_populates="diary", cascade="all, delete-orphan")