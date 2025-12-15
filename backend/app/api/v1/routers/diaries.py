from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.diary import create_diary, get_visible, get_by_id, can_view, create_comment, create_like, get_diary_comments, get_diary_likes_count, update_diary, delete_diary, create_diary_for_group, delete_comment, update_comment, share_diary, delete_share
from app.models.user import User
from app.schemas.diary import DiaryCreate, DiaryOut, DiaryCommentCreate, DiaryCommentOut, CreatorResponse, GroupResponse, DiaryLikeResponse, DiaryUpdate, CreateDiaryForGroup, CommentUpdate, DiaryShare
from app.models.diary import Diary
from app.models.friend import Friend, FriendshipStatus
from app.models.diary_like import DiaryLike
from app.models.group_member import GroupMember
from app.models.diary_comment import DiaryComment

router = APIRouter()

@router.post("/", response_model=DiaryOut, status_code=status.HTTP_201_CREATED)
def create_diary_endpoint(
    diary_in: DiaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if diary_in.share_type == "group":
        if not diary_in.group_ids or len(diary_in.group_ids) == 0:
            raise HTTPException(status_code=400, detail="group_ids are required for group share")

        for group_id in diary_in.group_ids:
            check_member = db.query(GroupMember).filter(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id
            ).all()
            if not check_member:
                raise HTTPException(status_code=403, detail=f"You are not a member of group {group_id}")

    elif diary_in.share_type == "friends":
        friends = db.query(Friend).filter(
            ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)),
            Friend.status == FriendshipStatus.accepted
        ).all()

        if not friends:
            raise HTTPException(status_code=400, detail="You do not have friend yet")
    
    diary = create_diary(db, current_user.id, diary_in)
    
    return DiaryOut(
        id=diary.id,
        author=CreatorResponse(
            id=current_user.id,
            username=current_user.username,
            avatar_url=current_user.avatar_url
        ),
        title=diary.title,
        content=diary.content,
        share_type=diary.share_type.value,
        groups=[
            GroupResponse(id=g.id, name=g.name) for g in diary.groups
        ],
        images=diary.images,  # Cloudinary URLs
        likes=getattr(diary, "likes", 0),
        is_deleted=diary.is_deleted,
        created_at=diary.created_at,
        updated_at=diary.updated_at
    )

@router.post("/groups/{group_id}", response_model=DiaryOut)
def create_diary_for_group_(group_id: int,
                            diary_data: CreateDiaryForGroup,
                            db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)
                            ):
    return create_diary_for_group(db, group_id, diary_data, current_user.id)

@router.get("/feed", response_model=List[DiaryOut])
def get_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diaries = (
        db.query(Diary)
        .options(
            joinedload(Diary.author),
            joinedload(Diary.groups),
            joinedload(Diary.likes).joinedload(DiaryLike.user)
        )
        .filter(Diary.id.in_([d.id for d in get_visible(db, current_user.id)]))
        .order_by(Diary.created_at.desc())
        .all()
    )

    result = []
    for d in diaries:
        diary_out = DiaryOut(
            id=d.id,
            author=CreatorResponse(
                id=d.author.id,
                username=d.author.username,
                avatar_url=d.author.avatar_url
            ),
            title=d.title,
            content=d.content,
            share_type=d.share_type.value,
            groups=[GroupResponse(id=g.id, name=g.name) for g in d.groups],
            images=d.images,
            likes=[
                DiaryLikeResponse(
                    id=l.id,
                    user=CreatorResponse(
                        id=l.user.id,
                        username=l.user.username,
                        avatar_url=l.user.avatar_url
                    )
                ) for l in d.likes
            ],
            is_deleted=d.is_deleted,
            created_at=d.created_at,
            updated_at=d.updated_at
        )
        result.append(diary_out)

    return result

@router.get("/{diary_id}", response_model=DiaryOut)
def get_diary_by_id(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if diary.is_deleted:
        if diary.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Diary not found")
    
    if diary.user_id == current_user.id:
        pass
    elif not can_view(db, diary, current_user.id):
        raise HTTPException(status_code=403, detail="You don't have permission to view this diary")
    
    return DiaryOut(
        id=diary.id,
        author=CreatorResponse(
            id=diary.author.id,
            username=diary.author.username,
            avatar_url=diary.author.avatar_url
        ),
        title=diary.title,
        content=diary.content,
        share_type=diary.share_type.value,
        groups=[GroupResponse(id=g.id, name=g.name) for g in diary.groups],
        images=diary.images,
        likes=[
            DiaryLikeResponse(
                id=l.id,
                user=CreatorResponse(
                    id=l.user.id,
                    username=l.user.username,
                    avatar_url=l.user.avatar_url
                )
            ) for l in diary.likes
        ],
        is_deleted=diary.is_deleted,
        created_at=diary.created_at,
        updated_at=diary.updated_at
    )

@router.patch("/{diary_id}", response_model=DiaryOut)
def update_diary_by_id(diary_id: int,
                       diary_data: DiaryUpdate,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    diary = update_diary(db, diary_id, diary_data, current_user.id)
    
    return DiaryOut(
        id=diary.id,
        author=CreatorResponse(
            id=diary.author.id,
            username=diary.author.username,
            avatar_url=diary.author.avatar_url
        ),
        title=diary.title,
        content=diary.content,
        share_type=diary.share_type.value,
        groups=[GroupResponse(id=g.id, name=g.name) for g in diary.groups],
        images=diary.images,
        likes=[
            DiaryLikeResponse(
                id=l.id,
                user=CreatorResponse(
                    id=l.user.id,
                    username=l.user.username,
                    avatar_url=l.user.avatar_url
                )
            ) for l in diary.likes
        ],
        is_deleted=diary.is_deleted,
        created_at=diary.created_at,
        updated_at=diary.updated_at
    )

@router.delete("/{diary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diary_by_id(diary_id: int,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    delete_diary(db, diary_id, current_user.id)
    return None

@router.post("/{diary_id}/comment", response_model=DiaryCommentOut)
def comment_on_diary(
    diary_id: int,
    comment_in: DiaryCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if diary.user_id == current_user.id:
        pass
    elif not can_view(db, diary, current_user.id):
        raise HTTPException(status_code=404, detail="Diary not found or not visible")
    
    comment = create_comment(db, diary_id, current_user.id, comment_in.content, 
                           comment_in.parent_id, comment_in.images)
    
    user_response = CreatorResponse(
        id=current_user.id,
        username=current_user.username,
        avatar_url=current_user.avatar_url
    )
    
    return DiaryCommentOut(
        id=comment.id,
        diary_id=comment.diary_id,
        user=user_response,
        content=comment.content,
        images=comment.images,
        parent_id=comment.parent_id,
        created_at=comment.created_at if comment.created_at else datetime.utcnow()
    )

@router.get("/{diary_id}/comments", response_model=List[DiaryCommentOut])
def get_diary_comments_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # First, check if diary exists
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    
    if not diary:
        raise HTTPException(404, "Diary not found")
    
    # Allow creator to always view comments (even if share_type is "friends")
    if diary.user_id == current_user.id:
        # Continue to load comments
        pass
    elif not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")
    
    # Load ALL comments for this diary with user relationship
    comments = (
        db.query(DiaryComment)
        .options(joinedload(DiaryComment.user))
        .filter(DiaryComment.diary_id == diary_id)
        .order_by(DiaryComment.created_at.asc())
        .all()
    )
    
    # Get total count (including replies)
    total_count = db.query(DiaryComment).filter(DiaryComment.diary_id == diary_id).count()
    
    # Build nested comment tree
    comment_tree = build_comment_tree(comments)
    return comment_tree
    
    # Helper function to build nested comments
def build_comment_tree(comments_list):
    """Build nested comment tree with unlimited depth"""
    # Create lookup dictionary
    comment_map = {}
    root_comments = []
    
    # First pass: create nodes for all comments
    for comment in comments_list:
        comment_map[comment.id] = {
            'id': comment.id,
            'comment': comment,
            'children': []
        }
    
    # Second pass: build tree
    for comment in comments_list:
        node = comment_map[comment.id]
        if comment.parent_id is None:
            root_comments.append(node)
        else:
            # Find parent and add this as child
            parent_node = comment_map.get(comment.parent_id)
            if parent_node:
                parent_node['children'].append(node)
            else:
                # Orphan comment (parent not found or not loaded)
                root_comments.append(node)
    
    # Convert to nested structure
    def build_nested(node):
        comment = node['comment']
        user_response = CreatorResponse(
            id=comment.user.id,
            username=comment.user.username,
            avatar_url=comment.user.avatar_url
        ) if comment.user else CreatorResponse(
            id=0,
            username="Unknown",
            avatar_url=None
        )
        
        # Recursively build children
        children = [build_nested(child) for child in node['children']]
        
        return DiaryCommentOut(
            id=comment.id,
            diary_id=comment.diary_id,
            user=user_response,
            content=comment.content,
            images=comment.images if comment.images else None,
            parent_id=comment.parent_id,
            replies=children if children else None,
            created_at=comment.created_at if comment.created_at else datetime.utcnow()
        )
    
    return [build_nested(node) for node in root_comments]

@router.put("/comments/{comment_id}", response_model=DiaryCommentOut)
def update_comment_by_id(comment_id: int,
                         comment_data: CommentUpdate,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)
                         ):
    comment = update_comment(db, comment_id, comment_data, current_user.id)
    
    user_response = CreatorResponse(
        id=comment.user.id,
        username=comment.user.username,
        avatar_url=comment.user.avatar_url
    ) if comment.user else CreatorResponse(
        id=0,
        username="Unknown",
        avatar_url=None
    )
    
    return DiaryCommentOut(
        id=comment.id,
        diary_id=comment.diary_id,
        user=user_response,
        content=comment.content,
        images=comment.images if comment.images else None,
        parent_id=comment.parent_id,
        created_at=comment.created_at if comment.created_at else datetime.utcnow()
    )

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment_by_id(comment_id: int,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)
                         ):
    delete_comment(db, comment_id, current_user.id)
    return None

@router.post("/{diary_id}/like")
def like_diary_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")

    create_like(db, diary_id, current_user.id)
    return {"message": "Like toggled successfully"}

@router.get("/{diary_id}/likes", response_model=int)
def get_diary_likes_count_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary).filter(Diary.id == diary_id).first()
    
    if not diary:
        raise HTTPException(404, "Diary not found")
    
    if diary.user_id == current_user.id:
        pass
    elif not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")
    
    likes_count = get_diary_likes_count(db, diary_id)
    return likes_count