from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut, ShareNoteRequest, PublicNoteOut
from app.crud.note import (
    create_note, get_notes_by_user, get_note_by_id, 
    update_note, delete_note, toggle_pin_note, archive_note,
    share_note, get_public_note, get_shared_notes, stop_sharing
)

router = APIRouter(tags=["notes"])

@router.post("", response_model=NoteOut)
def create_new_note(
    note: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return create_note(db, note, current_user.id)

@router.get("", response_model=List[NoteOut])
def get_user_notes(
    archived: Optional[bool] = Query(False, description="Filter by archived status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"🔍 ROUTER: Fetching notes for user {current_user.id}, archived={archived}")
        notes = get_notes_by_user(db, current_user.id, archived=archived)
        print(f"✅ ROUTER: Successfully returning {len(notes)} notes")
        return notes
    except Exception as e:
        print(f"❌ ROUTER Error in get_user_notes: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

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
        raise HTTPException(status_code=404, detail="Note not found or no edit permission")
    return note

@router.delete("/{note_id}")
def delete_user_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = delete_note(db, note_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found or no permission to delete")
    return {"message": "Note deleted permanently"}

@router.post("/{note_id}/pin", response_model=NoteOut)
def pin_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = toggle_pin_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or no permission to pin")
    return note

@router.post("/{note_id}/archive", response_model=NoteOut)
def archive_user_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = archive_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or no permission to archive")
    return note

@router.post("/{note_id}/share", response_model=NoteOut)
def share_note_endpoint(
    note_id: int,
    share_data: ShareNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = share_note(db, note_id, current_user.id, share_data)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or no permission to share")
    return note

@router.post("/{note_id}/stop-sharing", response_model=NoteOut)
def stop_sharing_endpoint(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = stop_sharing(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or no permission to stop sharing")
    return note

@router.get("/public/{share_token}", response_model=PublicNoteOut)
def get_public_note_endpoint(
    share_token: str,
    db: Session = Depends(get_db)
):
    note = get_public_note(db, share_token)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or link expired")
    return note

@router.get("/shared/with-me", response_model=List[NoteOut])
def get_notes_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notes that friends have shared with current user"""
    try:
        print(f"🔍 Fetching shared notes for user {current_user.id}")
        notes = get_shared_notes(db, current_user.id)
        print(f"✅ Found {len(notes)} shared notes")
        return notes
    except Exception as e:
        print(f"❌ Error fetching shared notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load shared notes: {str(e)}")