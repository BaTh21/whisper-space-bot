# app/models/group_message.py
from sqlalchemy import Column, Enum, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from app.models.base import Base
from datetime import datetime
import enum

class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    is_unsent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    group = relationship("Group")
    sender = relationship("User")