from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.diary import create_diary, get_visible, get_by_id, can_view, create_comment, create_like, get_diary_comments, get_diary_likes_count
from app.models.user import User
from app.schemas.diary import DiaryCreate, DiaryOut, DiaryCommentCreate, DiaryCommentOut, CreatorResponse, GroupResponse, DiaryLikeResponse
from app.services.websocket_manager import manager
from app.models.diary import Diary
from app.models.friend import Friend, FriendshipStatus
from app.models.diary_like import DiaryLike

router = APIRouter()


@router.post("/", response_model=DiaryOut, status_code=status.HTTP_201_CREATED)
def create_diary_endpoint(
    diary_in: DiaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if diary_in.share_type == " group":
        if not diary_in.group_ids or len(diary_in.group_ids) == 0:
            raise HTTPException(status_code=400, detail="group_ids are required for group share")

        for group_id in diary_in.group_ids:
            if not exists_member(db, group_id, current_user.id):
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
        author={"id": current_user.id, "username": current_user.username},
        title=diary.title,
        content=diary.content,
        share_type=diary.share_type.value,
        groups=[
            {"id": g.id, "name": g.name} for g in diary.groups
        ],
        likes=getattr(diary, "likes", 0),
        is_deleted=diary.is_deleted,
        created_at=diary.created_at,
        updated_at=diary.updated_at
    )

@router.get("/feed", response_model=List[DiaryOut])
def get_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch visible diaries with related author, groups, and likes
    diaries = (
        db.query(Diary)
        .options(
            joinedload(Diary.author),
            joinedload(Diary.groups),
            joinedload(Diary.likes).joinedload(DiaryLike.user)  # preload user for likes
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
                username=d.author.username
            ),
            title=d.title,
            content=d.content,
            share_type=d.share_type.value,
            groups=[GroupResponse(id=g.id, name=g.name) for g in d.groups],
            likes=[
                DiaryLikeResponse(
                    id=l.id,
                    user=CreatorResponse(
                        id=l.user.id,
                        username=l.user.username
                    )
                ) for l in d.likes
            ],
            is_deleted=d.is_deleted,
            created_at=d.created_at,
            updated_at=d.updated_at
        )
        result.append(diary_out)

    return result

@router.post("/{diary_id}/comment", response_model=DiaryCommentOut)
def comment_on_diary(
    diary_id: int,
    comment_in: DiaryCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(status_code=404, detail="Diary not found or not visible")

    comment = create_comment(db, diary_id, current_user.id, comment_in.content)
    
    return DiaryCommentOut(
        id=comment.id,
        diary_id=comment.diary_id,
        author=CreatorResponse(
            id=current_user.id,
            username=current_user.username
        ),
        content=comment.content,
        created_at=comment.created_at.isoformat() if comment.created_at else None
    )


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


@router.get("/{diary_id}/comments", response_model=List[DiaryCommentOut])
def get_diary_comments_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")
    
    comments = get_diary_comments(db, diary_id)
    
    comment_list = []
    for comment in comments:
        comment_list.append(DiaryCommentOut(
            id=comment.id,
            diary_id=comment.diary_id,
            author=CreatorResponse(id=comment.user.id, username=comment.user.username),
            content=comment.content,
            created_at=comment.created_at.isoformat() if comment.created_at else None
        ))
    
    return comment_list


@router.get("/{diary_id}/likes", response_model=int)
def get_diary_likes_count_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")
    
    likes_count = get_diary_likes_count(db, diary_id)
    return likes_count