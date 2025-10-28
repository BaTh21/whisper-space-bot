from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.diary import Diary, ShareType
from app.models.diary_comment import DiaryComment
from app.models.diary_like import DiaryLike
from app.models.diary_group import DiaryGroup
from app.schemas.diary import DiaryCreate
from typing import List, Optional
from app.models.friend import Friend, FriendshipStatus
from app.models.group_member import GroupMember
from sqlalchemy import or_, and_

from app.models.friend import Friend
from app.models.group_member import GroupMember

def get_feed(db: Session, user_id: int) -> List[Diary]:
    # Subquery: user's friends
    subq_friends = (
        select(Friend.friend_id)
        .where(Friend.user_id == user_id, Friend.status == "accepted")
        .scalar_subquery()
    )

    # Subquery: user's group IDs
    subq_groups = (
        select(GroupMember.group_id)
        .where(GroupMember.user_id == user_id)
        .scalar_subquery()
    )

    # Explicitly wrap with select() to avoid warning
    return (
        db.query(Diary)
        .filter(
            (Diary.share_type == ShareType.public) |
            (Diary.user_id == user_id) |
            ((Diary.share_type == ShareType.friends) & Diary.user_id.in_(select(subq_friends))) |
            ((Diary.share_type == ShareType.group) & Diary.group_id.in_(select(subq_groups)))
        )
        .order_by(Diary.created_at.desc())
        .all()
    )


def create_diary(db: Session, user_id: int, diary_in: DiaryCreate) -> Diary:
    diary = Diary(
        user_id=user_id,
        title=diary_in.title,
        content=diary_in.content,
        share_type=ShareType(diary_in.share_type),
    )
    db.add(diary)
    db.flush()

    if diary_in.share_type == "group" and diary_in.group_ids:
        diary_groups = [
            DiaryGroup(diary_id=diary.id, group_id=group_id)
            for group_id in diary_in.group_ids
        ]
        db.add_all(diary_groups)

    db.commit()
    db.refresh(diary)
    return diary


def get_by_id(db: Session, diary_id: int) -> Optional[Diary]:
    return db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()

def get_visible(db: Session, user_id: int) -> List[Diary]:
    subq_friends = (
        db.query(Friend.friend_id)
        .filter(
            Friend.user_id == user_id,
            Friend.status == FriendshipStatus.accepted
        )
        .subquery()
    )

    subq_groups = (
        db.query(GroupMember.group_id)
        .filter(GroupMember.user_id == user_id)
        .subquery()
    )

    subq_group_diaries = (
        db.query(DiaryGroup.diary_id)
        .filter(DiaryGroup.group_id.in_(subq_groups))
        .subquery()
    )

    diaries = (
        db.query(Diary)
        .filter(
            Diary.is_deleted == False,
            or_(
                Diary.share_type == ShareType.public,
                and_(
                    Diary.share_type == ShareType.friends,
                    Diary.user_id.in_(subq_friends)
                ),
                and_(
                    Diary.share_type == ShareType.group,
                    Diary.id.in_(subq_group_diaries)
                ),
                Diary.user_id == user_id
            )
        )
        .order_by(Diary.created_at.desc())
        .all()
    )

    return diaries


def can_view(db: Session, diary: Diary, user_id: int) -> bool:
    if diary.share_type == ShareType.public:
        return True
    if diary.share_type == ShareType.friends:
        from app.models.friend import Friend, FriendshipStatus
        return db.query(Friend).filter(
            ((Friend.user_id == user_id) & (Friend.friend_id == diary.user_id)) |
            ((Friend.user_id == diary.user_id) & (Friend.friend_id == user_id)),
            Friend.status == FriendshipStatus.accepted
        ).first() is not None
    if diary.share_type == ShareType.group:
        from app.models.group_member import GroupMember
        return db.query(GroupMember).filter(
            GroupMember.group_id == diary.group_id,
            GroupMember.user_id == user_id
        ).first() is not None
    return False


def create_comment(db: Session, diary_id: int, user_id: int, content: str) -> DiaryComment:
    comment = DiaryComment(diary_id=diary_id, user_id=user_id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def create_like(db: Session, diary_id: int, user_id: int) -> None:
    # Prevent duplicate likes
    exists = db.query(DiaryLike).filter(
        DiaryLike.diary_id == diary_id,
        DiaryLike.user_id == user_id
    ).first()
    if not exists:
        like = DiaryLike(diary_id=diary_id, user_id=user_id)
        db.add(like)
        db.commit()

def get_diary_comments(db: Session, diary_id: int) -> List[DiaryComment]:
    return db.query(DiaryComment).filter(
        DiaryComment.diary_id == diary_id
    ).order_by(DiaryComment.created_at.asc()).all()

def get_diary_likes_count(db: Session, diary_id: int) -> int:
    return db.query(DiaryLike).filter(
        DiaryLike.diary_id == diary_id
    ).count()