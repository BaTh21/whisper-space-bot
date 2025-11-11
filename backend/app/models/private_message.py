from sqlalchemy import Column, Enum, Boolean, DateTime, ForeignKey, Text, Integer, String
from sqlalchemy.orm import relationship
from app.models.base import Base
from datetime import datetime
import enum

class MessageType(enum.Enum):
    text = "text"
    image = "image"
    file = "file"

class PrivateMessage(Base):
    __tablename__ = "private_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.text)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)  # ADD THIS
    delivered_at = Column(DateTime(timezone=True), nullable=True)  # ADD THIS
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    reply_to_id = Column(Integer, ForeignKey("private_messages.id", ondelete="SET NULL"), nullable=True)
    is_forwarded = Column(Boolean, default=False)
    original_sender = Column(String(255), nullable=True)
    
    reply_to = relationship("PrivateMessage", remote_side=[id], uselist=False)
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])