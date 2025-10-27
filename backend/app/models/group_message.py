from sqlalchemy import Column, Enum, DateTime, ForeignKey, Text, Integer
from app.models.private_message import MessageType
from app.models.base import Base
from datetime import datetime

class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
