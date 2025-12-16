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
from datetime import datetime, timezone
from app.models.group import Group
from app.services.image_service_sync import image_service_sync

def create_diary(db: Session, user_id: int, diary_in: DiaryCreate) -> Diary:
    # Handle images
    image_urls = []
    if diary_in.images:
        image_urls = image_service_sync.save_multiple_images(diary_in.images, is_diary=True)
    
    diary = Diary(
        user_id=user_id,
        title=diary_in.title,
        content=diary_in.content,
        share_type=ShareType(diary_in.share_type),
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        images=image_urls
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
    
    image_urls = []
    if diary_data.images:
        image_urls = image_service_sync.save_multiple_images(diary_data.images, is_diary=True)
    
    new_diary = Diary(
        title=diary_data.title,
        content=diary_data.content,
        share_type=ShareType.group,
        created_at=datetime.now(timezone.utc),
        user_id=current_user_id,
        is_deleted=False,
        images=image_urls
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
    # Get IDs of friends (people I added as friends)
    my_friends = (
        db.query(Friend.friend_id)
        .filter(
            Friend.user_id == user_id,
            Friend.status == FriendshipStatus.accepted
        )
        .subquery()
    )
    
    # Get IDs of people who added me as friend
    friends_of_me = (
        db.query(Friend.user_id)
        .filter(
            Friend.friend_id == user_id,
            Friend.status == FriendshipStatus.accepted
        )
        .subquery()
    )
    
    all_friends_union = (
        db.query(Friend.friend_id.label('friend_id'))
        .filter(Friend.user_id == user_id, Friend.status == FriendshipStatus.accepted)
        .union(
            db.query(Friend.user_id.label('friend_id'))
            .filter(Friend.friend_id == user_id, Friend.status == FriendshipStatus.accepted)
        )
        .subquery()
    )
    
    user_groups = (
        db.query(GroupMember.group_id)
        .filter(GroupMember.user_id == user_id)
        .subquery()
    )

    group_diaries = (
        db.query(DiaryGroup.diary_id)
        .filter(DiaryGroup.group_id.in_(select(user_groups.c.group_id)))
        .subquery()
    )

    diaries = (
        db.query(Diary)
        .filter(
            Diary.is_deleted.is_(False),
            or_(
                Diary.share_type == ShareType.public,
                
                and_(
                    Diary.share_type == ShareType.friends,
                    or_(
                        and_(
                            Diary.user_id.in_(select(my_friends.c.friend_id)),
                            Diary.user_id != user_id
                        ),
                        and_(
                            Diary.user_id.in_(select(friends_of_me.c.user_id)),
                            Diary.user_id != user_id
                        )
                    )
                ),
                
                and_(
                    Diary.share_type == ShareType.group,
                    Diary.id.in_(select(group_diaries.c.diary_id))
                ),
                
                Diary.user_id == user_id
            )
        )
        .order_by(Diary.created_at.desc())
        .all()
    )

    return diaries

def can_view(db: Session, diary: Diary, user_id: int) -> bool:
    if diary.is_deleted:
        return False
    
    if diary.user_id == user_id:
        return True
    
    if diary.share_type == ShareType.public:
        return True
    
    if diary.share_type == ShareType.personal:
        return False
    
    if diary.share_type == ShareType.friends:
        is_friend = db.query(Friend).filter(
            or_(
                and_(
                    Friend.user_id == diary.user_id,
                    Friend.friend_id == user_id,
                    Friend.status == FriendshipStatus.accepted
                ),
                and_(
                    Friend.user_id == user_id,
                    Friend.friend_id == diary.user_id,
                    Friend.status == FriendshipStatus.accepted
                )
            )
        ).first() is not None
        return is_friend
    
    if diary.share_type == ShareType.group:
        group_ids = [dg.group_id for dg in diary.diary_groups]
        if diary.group_id:
            group_ids.append(diary.group_id)
        
        group_ids = list(set(group_ids))
        
        if not group_ids:
            return False
        
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
    
    update_dict = diary_data.dict(exclude_unset=True, exclude_none=True)
    
    # Handle images update - FIXED VERSION
    if 'images' in update_dict:
        print(f"Processing images update. Input: {update_dict['images']}")
        
        # If images is an empty list, remove all images
        if update_dict['images'] == []:
            print("Clearing all images")
            if diary.images:
                image_service_sync.cleanup_images(diary.images)
            diary.images = []
        elif update_dict['images']:
            # We have new images to process
            # Separate URLs (already uploaded) from base64 (need upload)
            existing_urls = []
            base64_images = []
            
            for img in update_dict['images']:
                if img.startswith(('http://', 'https://')):
                    existing_urls.append(img)
                elif img.startswith('data:image/'):
                    base64_images.append(img)
                else:
                    # Try to handle plain base64
                    try:
                        base64.b64decode(img, validate=True)
                        base64_images.append(f"data:image/jpeg;base64,{img}")
                    except:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid image format: {img[:50]}..."
                        )
            
            print(f"Image analysis - URLs: {len(existing_urls)}, Base64: {len(base64_images)}")
            
            # Clean up old images that are not in existing_urls
            if diary.images:
                images_to_remove = [old_img for old_img in diary.images 
                                   if old_img not in existing_urls]
                if images_to_remove:
                    print(f"Cleaning up {len(images_to_remove)} old images")
                    image_service_sync.cleanup_images(images_to_remove)
            
            # Upload new base64 images
            new_urls = []
            if base64_images:
                print(f"Uploading {len(base64_images)} new images")
                try:
                    new_urls = image_service_sync.save_multiple_images(base64_images, is_diary=True)
                    print(f"Uploaded to URLs: {new_urls}")
                except Exception as e:
                    print(f"Error uploading images: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to upload images: {str(e)}"
                    )
            
            # Combine existing URLs with new URLs
            diary.images = existing_urls + new_urls
            print(f"Final image URLs: {diary.images}")
    # If 'images' key is not in update_dict, we don't change the images at all
    
    # Handle share_type update
    if 'share_type' in update_dict:
        share_type_value = update_dict['share_type']
        
        try:
            if isinstance(share_type_value, str):
                diary.share_type = ShareType(share_type_value.lower())
            else:
                available_values = [t.value for t in ShareType]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid share_type. Must be one of: {available_values}"
                )
        except ValueError as e:
            available_values = [t.value for t in ShareType]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid share_type. Must be one of: {available_values}"
            )
    
    if 'title' in update_dict:
        diary.title = update_dict['title']
    
    if 'content' in update_dict:
        diary.content = update_dict['content']
    
    # Handle group_ids if share_type is group
    if 'group_ids' in update_dict:
        if diary.share_type == ShareType.group:
            db.query(DiaryGroup).filter(DiaryGroup.diary_id == diary_id).delete()
            
            for group_id in update_dict['group_ids']:
                diary_group = DiaryGroup(diary_id=diary_id, group_id=group_id)
                db.add(diary_group)
    
    diary.updated_at = datetime.now(timezone.utc)
    
    try:
        db.commit()
        db.refresh(diary)
        return diary
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

def delete_diary(db: Session, diary_id: int, current_user_id: int):
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                           detail="Diary not found")
    
    if diary.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                           detail="Only creator can delete this diary")
    
    # Clean up images from Cloudinary
    if diary.images:
        image_service_sync.cleanup_images(diary.images)
    
    # Also clean up comment images
    comments = db.query(DiaryComment).filter(DiaryComment.diary_id == diary_id).all()
    for comment in comments:
        if comment.images:
            image_service_sync.cleanup_images(comment.images)
    
    # HARD DELETE
    db.delete(diary)
    
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

def create_comment(db: Session, diary_id: int, user_id: int, content: str, parent_id: Optional[int] = None, images: Optional[List[str]] = None) -> DiaryComment:
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                          detail="Diary not found")
    
    if parent_id:
        parent_comment = db.query(DiaryComment).filter(DiaryComment.id == parent_id).first()
        if not parent_comment or parent_comment.diary_id != diary_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail="Parent comment not found")
    
    image_urls = []
    if images:
        image_urls = image_service_sync.save_multiple_images(images, is_diary=False)
    
    comment = DiaryComment(
        diary_id=diary_id,
        user_id=user_id,
        content=content,
        parent_id=parent_id,
        images=image_urls,
        created_at=datetime.now(timezone.utc)
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    comment = db.query(DiaryComment).options(joinedload(DiaryComment.user)).filter(DiaryComment.id == comment.id).first()
    
    return comment

def create_like(db: Session, diary_id: int, user_id: int) -> None:
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                          detail="Diary not found")
    
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
    diary = db.query(Diary).filter(Diary.id == diary_id, Diary.is_deleted == False).first()
    if not diary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                          detail="Diary not found")
    
    return (
        db.query(DiaryComment)
        .options(joinedload(DiaryComment.user))
        .filter(DiaryComment.diary_id == diary_id)
        .order_by(DiaryComment.created_at.asc())
        .all()
    )

def get_diary_likes_count(db: Session, diary_id: int) -> int:
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
    
    if comment.images:
        image_service_sync.cleanup_images(comment.images)
    
    if comment.replies:
        for reply in comment.replies:
            if reply.images:
                image_service_sync.cleanup_images(reply.images)
    
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
    
    if 'images' in update_data:
        if comment.images:
            image_service_sync.cleanup_images(comment.images)
        
        if update_data['images']:
            image_urls = image_service_sync.save_multiple_images(update_data['images'], is_diary=False)
            comment.images = image_urls
        else:
            comment.images = []
    
    if 'content' in update_data:
        comment.content = update_data['content']
    
    db.commit()
    db.refresh(comment)
    return comment