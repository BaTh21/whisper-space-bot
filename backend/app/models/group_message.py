# app/models/group_message.py
from sqlalchemy import Column, Enum, Boolean, DateTime, ForeignKey, Text, Integer, String
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
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime())
    message_type = Column(Enum(MessageType), default=MessageType.text)
    file_url = Column(String(255), nullable=True)
    public_id = Column(String(255), nullable=True)

    group = relationship("Group", back_populates="messages")
    sender = relationship("User")