from sqlalchemy import (
    Column, Integer, Enum, ForeignKey,
    Boolean, DateTime, JSON, Index, func, Text
)
from sqlalchemy.orm import relationship
from app.models.base import Base
import enum

class ActivityType(enum.Enum):
    friend_request = "friend_request"
    post_like = "post_like"
    post_comment = "post_comment"
    group_invite = "group_invite"

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum(ActivityType), nullable=False)
    post_id = Column(Integer, ForeignKey("diaries.id"), nullable=True)
    comment_id = Column(Integer, ForeignKey("diary_comments.id"), nullable=True)
    friend_request_id = Column(Integer, ForeignKey("friends.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)

    extra_data  = Column(Text, nullable=True)

    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

    __table_args__ = (
        Index("idx_activity_recipient", "recipient_id", "is_read"),
        Index("idx_activity_type", "type"),
    )
