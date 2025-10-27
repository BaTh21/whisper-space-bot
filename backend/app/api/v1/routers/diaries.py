# app/api/v1/routers/diaries.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.diary import create_diary, get_visible, get_by_id, can_view, create_comment, create_like
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
    return DiaryCommentOut.from_orm(comment)


@router.post("/{diary_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_diary(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = get_by_id(db, diary_id)
    if not diary or not can_view(db, diary, current_user.id):
        raise HTTPException(404, "Diary not found or not visible")

    create_like(db, diary_id, current_user.id)
    return None