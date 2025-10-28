# app/api/v1/routers/diaries.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.diary import create_diary, get_visible, get_by_id, can_view, create_comment, create_like, get_diary_comments, get_diary_likes_count
from app.crud.group import exists_member
from app.models.user import User
from app.schemas.diary import DiaryCreate, DiaryOut, DiaryCommentCreate, DiaryCommentOut
from app.services.websocket_manager import manager

router = APIRouter()


@router.post("/", response_model=DiaryOut, status_code=status.HTTP_201_CREATED)
def create_diary_endpoint(
    diary_in: DiaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Group validation
    if diary_in.share_type == "group":
        if not diary_in.group_id:
            raise HTTPException(400, "group_id is required for group share")
        if not exists_member(db, diary_in.group_id, current_user.id):
            raise HTTPException(403, "You are not a member of this group")

    diary = create_diary(db, current_user.id, diary_in)

    return DiaryOut(
        id=diary.id,
        user_id=diary.user_id,
        title=diary.title,
        content=diary.content,
        share_type=diary.share_type.value,
        group_id=diary.group_id,
        is_deleted=diary.is_deleted,
        created_at=diary.created_at,
        updated_at=diary.updated_at
    )


@router.get("/feed", response_model=List[DiaryOut])
def get_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diaries = get_visible(db, current_user.id)
    return [
        DiaryOut(
            id=d.id,
            user_id=d.user_id,
            title=d.title,
            content=d.content,
            share_type=d.share_type.value,
            group_id=d.group_id,
            is_deleted=d.is_deleted,
            created_at=d.created_at,
            updated_at=d.updated_at
        )
        for d in diaries
    ]


@router.post("/{diary_id}/comment", response_model=DiaryCommentOut)
def comment_on_diary(
    diary_id: int,
    comment_in: DiaryCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")

    comment = create_comment(db, diary_id, current_user.id, comment_in.content)
    
    # Return with username
    return DiaryCommentOut(
        id=comment.id,
        diary_id=comment.diary_id,
        user_id=comment.user_id,
        content=comment.content,
        username=current_user.username,
        created_at=comment.created_at.isoformat() if comment.created_at else None
    )


@router.post("/{diary_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_diary_endpoint(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")

    create_like(db, diary_id, current_user.id)
    return None


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
    
    # Convert comments to proper format
    comment_list = []
    for comment in comments:
        comment_list.append(DiaryCommentOut(
            id=comment.id,
            diary_id=comment.diary_id,
            user_id=comment.user_id,
            content=comment.content,
            username=comment.user.username if comment.user else f"User {comment.user_id}",
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