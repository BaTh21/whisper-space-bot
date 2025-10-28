from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from app.models.base import Base
from datetime import datetime
from sqlalchemy.orm import relationship

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    diary_groups = relationship("DiaryGroup", back_populates="group")
    diaries = relationship("Diary", secondary="diary_groups", viewonly=True)