from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.diary import Diary, ShareType
from app.models.diary_comment import DiaryComment
from app.models.diary_like import DiaryLike
from app.models.diary_group import DiaryGroup
from app.schemas.diary import DiaryCreate, DiaryUpdate, CreateDiaryForGroup, CommentUpdate, DiaryShare
from typing import List, Optional
from app.models.friend import Friend, FriendshipStatus
from app.models.group_member import GroupMember
from sqlalchemy import or_, and_, select
from fastapi import HTTPException, status
from datetime import datetime
from app.models.group import Group

from app.models.friend import Friend
from app.models.group_member import GroupMember
from app.models.friend import Friend, FriendshipStatus

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

def create_diary_for_group(db: Session, group_id: int, diary_data: CreateDiaryForGroup, current_user_id: int):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Group not found")

    check_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user_id
    ).first()
    if not check_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only member can create diary")
    
    new_diary = Diary(
        title=diary_data.title,
        content=diary_data.content,
        share_type=ShareType.group,
        created_at=datetime.utcnow(),
        user_id=current_user_id
    )
    
    db.add(new_diary)
    db.flush()

    diary_groups = DiaryGroup(diary_id=new_diary.id, group_id=group_id)
    db.add(diary_groups)

    db.commit()
    db.refresh(new_diary)
    return new_diary
    

def get_by_id(db: Session, diary_id: int) -> Optional[Diary]:
    return db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()

def get_visible(db: Session, user_id: int) -> List[Diary]:
    # Get IDs of friends
    subq_friends = (
        db.query(Friend.friend_id)
        .filter(
            Friend.user_id == user_id,
            Friend.status == FriendshipStatus.accepted
        )
        .subquery()
    )

    # Get IDs of groups the user is in
    subq_groups = (
        db.query(GroupMember.group_id)
        .filter(GroupMember.user_id == user_id)
        .subquery()
    )

    # Get diary IDs that belong to those groups
    subq_group_diaries = (
        db.query(DiaryGroup.diary_id)
        .filter(DiaryGroup.group_id.in_(select(subq_groups.c.group_id)))
        .subquery()
    )

    # Fetch diaries visible to the user
    diaries = (
        db.query(Diary)
        .filter(
            Diary.is_deleted.is_(False),
            or_(
                Diary.share_type == ShareType.public,
                and_(
                    Diary.share_type == ShareType.friends,
                    Diary.user_id.in_(select(subq_friends.c.friend_id))
                ),
                and_(
                    Diary.share_type == ShareType.group,
                    Diary.id.in_(select(subq_group_diaries.c.diary_id))
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
    if diary.share_type == ShareType.personal:
        return diary.user_id == user_id
    if diary.share_type == ShareType.friends:
        return db.query(Friend).filter(
            or_(
                and_(Friend.user_id == user_id, Friend.friend_id == diary.user_id),
                and_(Friend.user_id == diary.user_id, Friend.friend_id == user_id)
            ),
            Friend.status == FriendshipStatus.accepted
        ).first() is not None
    if diary.share_type == ShareType.group:
        from app.models.group_member import GroupMember
        group_ids = [diary.group_id] if diary.group_id else []
        group_ids += [g.id for g in diary.groups]
        return db.query(GroupMember).filter(
            GroupMember.group_id.in_(group_ids),
            GroupMember.user_id == user_id
        ).first() is not None
    return False

def update_diary(db: Session, diary_id: int, diary_data: DiaryUpdate, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
    
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only creator can edit this diary")
    
    update_data = diary_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(diary, key, value)
    
    diary.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(diary)
    return diary

def delete_diary(db: Session, diary_id: int, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
        
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only creator can delete this diary")

    db.delete(diary)
    db.commit()
    return {"detail": "Diary has been deleted"}

def share_diary(db: Session, diary_id: int, diary_data: DiaryShare, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
    
    shared_groups = []
    for group_id in diary_data.group_ids:
        check_existing = db.query(DiaryGroup).filter(
            DiaryGroup.group_id == group_id,
            DiaryGroup.diary_id == diary_id
        ).first()
        if check_existing:
            continue
        
        new_share = DiaryGroup(
            diary_id=diary_id, 
            group_id=group_id,
            shared_by=current_user_id,
            is_shared=True,
            shared_at=datetime.utcnow()
            )
        
        db.add(new_share)
        shared_groups.append(group_id)
        
    if not shared_groups:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Diary already shared to selected group")
    
    db.commit()
    db.refresh(diary)
    return diary
        
def delete_share(db: Session, share_id: int, current_user_id: int):
    
    share = db.query(DiaryGroup).filter(
        DiaryGroup.id == share_id,
    ).first()
    if not share:
        raise HTTPException(status_code.status.HTTP_404_NOT_FOUND,
                            detail="Share not found")
        
    if share.shared_by != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only who share can delete this share")

    db.delete(share)
    db.commit()
    return {"detail": "Share has been remove"}
    

def create_comment(db: Session, diary_id: int, user_id: int, content: str) -> DiaryComment:
    comment = DiaryComment(diary_id=diary_id, user_id=user_id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def create_like(db: Session, diary_id: int, user_id: int) -> None:
    # Prevent duplicate likes
    like = db.query(DiaryLike).filter(
        DiaryLike.diary_id == diary_id,
        DiaryLike.user_id == user_id
    ).first()
    if like:
        db.delete(like)
    else:
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
    
def delete_comment(db: Session, comment_id: int, current_user_id: int):
    comment = db.query(DiaryComment).filter(DiaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Comment not found")
        
    if comment.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only owner can delete this comment")
        
    db.delete(comment)
    db.commit()
    return {"detail": "Comment has been deleted"}

def update_comment(db: Session,
                   comment_id: int,
                   comment_data: CommentUpdate,
                   current_user_id: int
                   ):
    
    comment = db.query(DiaryComment).filter(DiaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Comment not found")

    if comment.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only owner can update this comment")

    update_data = comment_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(comment, key, value)
        
    db.commit()
    db.refresh(comment)
    return comment