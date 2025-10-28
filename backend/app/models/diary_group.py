from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class DiaryGroup(Base):
    __tablename__ = "diary_groups"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    diary_id = Column(Integer, ForeignKey("diaries.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)

    diary = relationship("Diary", back_populates="diary_groups")
    group = relationship("Group", back_populates="diary_groups")