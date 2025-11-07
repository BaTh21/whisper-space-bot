from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer
from sqlalchemy.sql import func
from app.models.base import Base
from datetime import datetime

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=False)  # Foreign key to users table
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    color = Column(String(20), default="#ffffff")  # Note background color
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)