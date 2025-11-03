# app/models/group_message.py
from sqlalchemy import Column, Enum, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from app.models.base import Base
from datetime import datetime
import enum
import enum
from sqlalchemy import Enum

class MessageType(enum.Enum):
    text = "text"
    image = "image"
    file = "file"

class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    # is_unsent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    message_type = Column(Enum(MessageType), default=MessageType.text)

    group = relationship("Group", back_populates="messages")
    sender = relationship("User")