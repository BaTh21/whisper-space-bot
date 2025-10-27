from sqlalchemy.orm import Session
from app.models.group import Group
from app.models.group_member import GroupMember
from typing import List


def create_group(db: Session, name: str, creator_id: int, description: str = None) -> Group:
    group = Group(name=name, creator_id=creator_id, description=description)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def get_user_groups(db: Session, user_id: int) -> List[Group]:
    return db.query(Group).join(GroupMember).filter(GroupMember.user_id == user_id).all()


def add_member(db: Session, group_id: int, user_id: int):
    member = GroupMember(group_id=group_id, user_id=user_id)
    db.add(member)
    db.commit()


def exists_member(db: Session, group_id: int, user_id: int) -> bool:
    return db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first() is not None