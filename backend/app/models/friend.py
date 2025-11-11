from sqlalchemy import Column, Enum, DateTime, ForeignKey, Integer
from app.models.base import Base
from datetime import datetime
import enum

class FriendshipStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    blocked = "blocked"

class Friend(Base):
    __tablename__ = "friends"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status = Column(Enum(FriendshipStatus), default=FriendshipStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)
