from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut
from app.crud.note import (
    create_note, get_notes_by_user, get_note_by_id, 
    update_note, delete_note, toggle_pin_note, archive_note
)

# Remove prefix from here - let main.py handle it
router = APIRouter(tags=["notes"])

@router.post("/", response_model=NoteOut)
def create_new_note(
    note: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return create_note(db, note, current_user.id)

@router.get("/", response_model=List[NoteOut])
def get_user_notes(
    archived: Optional[bool] = Query(False, description="Filter by archived status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"Fetching notes for user {current_user.id}, archived={archived}")
        notes = get_notes_by_user(db, current_user.id, archived=archived)
        print(f"Found {len(notes)} notes")
        return notes
    except Exception as e:
        print(f"Error in get_user_notes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{note_id}", response_model=NoteOut)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = get_note_by_id(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.put("/{note_id}", response_model=NoteOut)
def update_user_note(
    note_id: int,
    note_update: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = update_note(db, note_id, current_user.id, note_update)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.delete("/{note_id}")
def delete_user_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = delete_note(db, note_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

@router.post("/{note_id}/pin")
def pin_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = toggle_pin_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note pinned" if note.is_pinned else "Note unpinned"}

@router.post("/{note_id}/archive")
def archive_user_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = archive_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note archived" if note.is_archived else "Note unarchived"}