from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
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

def create_diary(db: Session, user_id: int, diary_in: DiaryCreate) -> Diary:
    diary = Diary(
        user_id=user_id,
        title=diary_in.title,
        content=diary_in.content,
        share_type=ShareType(diary_in.share_type),
        is_deleted=False 
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
        user_id=current_user_id,
        is_deleted=False
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
                Diary.user_id == user_id  # User can always see their own diaries
            )
        )
        .order_by(Diary.created_at.desc())
        .all()
    )

    return diaries


def can_view(db: Session, diary: Diary, user_id: int) -> bool:
    # Check if diary is deleted
    if diary.is_deleted:
        return False
    
    # CREATOR CAN ALWAYS VIEW THEIR OWN DIARY
    if diary.user_id == user_id:
        return True
    
    if diary.share_type == ShareType.public:
        return True
    
    if diary.share_type == ShareType.personal:
        return False  # Only creator can view, already handled above
    
    if diary.share_type == ShareType.friends:
        # Check if users are friends
        is_friend = db.query(Friend).filter(
            or_(
                and_(Friend.user_id == user_id, Friend.friend_id == diary.user_id),
                and_(Friend.user_id == diary.user_id, Friend.friend_id == user_id)
            ),
            Friend.status == FriendshipStatus.accepted
        ).first() is not None
        return is_friend
    
    if diary.share_type == ShareType.group:
        # Get group IDs from diary_groups
        group_ids = [dg.group_id for dg in diary.diary_groups]
        if diary.group_id:
            group_ids.append(diary.group_id)
        
        # Remove duplicates
        group_ids = list(set(group_ids))
        
        if not group_ids:
            return False
        
        # Check if user is member of any of these groups
        is_member = db.query(GroupMember).filter(
            GroupMember.group_id.in_(group_ids),
            GroupMember.user_id == user_id
        ).first() is not None
        return is_member
    
    return False

def update_diary(db: Session, diary_id: int, diary_data: DiaryUpdate, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
    
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only creator can edit this diary")
    
    update_data = diary_data.dict(exclude_unset=True, exclude_none=True)
    
    # Handle share_type update
    if 'share_type' in update_data:
        try:
            share_type_value = update_data['share_type']
            
            # Handle different input types
            if isinstance(share_type_value, str):
                diary.share_type = ShareType(share_type_value.lower())
            elif hasattr(share_type_value, 'value'):  # If it's an enum
                diary.share_type = ShareType(share_type_value.value.lower())
            else:
                diary.share_type = ShareType(str(share_type_value).lower())
                
        except (ValueError, AttributeError) as e:
            available_values = [t.value for t in ShareType]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid share_type. Must be one of: {available_values}"
            )
    
    # Handle title and content updates
    if 'title' in update_data:
        diary.title = update_data['title']
    
    if 'content' in update_data:
        diary.content = update_data['content']
    
    # Handle group_ids if share_type is group
    if 'group_ids' in update_data:
        if diary.share_type == ShareType.group:
            # Remove existing group associations
            db.query(DiaryGroup).filter(DiaryGroup.diary_id == diary_id).delete()
            
            # Add new group associations
            for group_id in update_data['group_ids']:
                diary_group = DiaryGroup(diary_id=diary_id, group_id=group_id)
                db.add(diary_group)
        # If share_type is not group, ignore group_ids
    
    diary.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(diary)
    return diary

def delete_diary(db: Session, diary_id: int, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
        
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only creator can delete this diary")

    # HARD DELETE: Remove from database
    db.delete(diary)
    
    # Also delete related comments and likes
    db.query(DiaryComment).filter(DiaryComment.diary_id == diary_id).delete()
    db.query(DiaryLike).filter(DiaryLike.diary_id == diary_id).delete()
    db.query(DiaryGroup).filter(DiaryGroup.diary_id == diary_id).delete()
    
    db.commit()
    return {"detail": "Diary has been permanently deleted"}

def share_diary(db: Session, diary_id: int, diary_data: DiaryShare, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Diary not found")
    
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only diary owner can share this diary")
    
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
    share = db.query(DiaryGroup).filter(DiaryGroup.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Share not found")
        
    if share.shared_by != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only who share can delete this share")

    db.delete(share)
    db.commit()
    return {"detail": "Share has been removed"}
    

def create_comment(db: Session, diary_id: int, user_id: int, content: str) -> DiaryComment:
    # Check if diary exists and is not deleted
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                           detail="Diary not found")
    
    comment = DiaryComment(
        diary_id=diary_id, 
        user_id=user_id, 
        content=content,
        created_at=datetime.utcnow()
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    # Load user relationship
    comment = db.query(DiaryComment).options(joinedload(DiaryComment.user)).filter(DiaryComment.id == comment.id).first()
    
    return comment


def create_like(db: Session, diary_id: int, user_id: int) -> None:
    # Check if diary exists and is not deleted
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                           detail="Diary not found")
    
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
    # Check if diary exists and is not deleted
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                           detail="Diary not found")
    
    # Load user relationship with the comments
    return (
        db.query(DiaryComment)
        .options(joinedload(DiaryComment.user))
        .filter(DiaryComment.diary_id == diary_id)
        .order_by(DiaryComment.created_at.asc())
        .all()
    )

def get_diary_likes_count(db: Session, diary_id: int) -> int:
    # Check if diary exists and is not deleted
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                           detail="Diary not found")
    
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