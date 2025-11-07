from sqlalchemy.orm import Session
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate
from typing import List, Optional

def create_note(db: Session, note: NoteCreate, user_id: int) -> Note:
    db_note = Note(
        title=note.title,
        content=note.content,
        user_id=user_id,
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        color=note.color
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def get_notes_by_user(
    db: Session, 
    user_id: int, 
    skip: int = 0, 
    limit: int = 100,
    archived: bool = False,
    deleted: bool = False
) -> List[Note]:
    query = db.query(Note).filter(
        Note.user_id == user_id,
        Note.is_archived == archived,
        Note.is_deleted == deleted
    )
    
    if not archived and not deleted:
        query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    else:
        query = query.order_by(Note.updated_at.desc())
        
    return query.offset(skip).limit(limit).all()

def get_note_by_id(db: Session, note_id: int, user_id: int) -> Optional[Note]:
    return db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user_id,
        Note.is_deleted == False
    ).first()

def update_note(db: Session, note_id: int, user_id: int, note_update: NoteUpdate) -> Optional[Note]:
    db_note = get_note_by_id(db, note_id, user_id)
    if db_note:
        update_data = note_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_note, field, value)
        db.commit()
        db.refresh(db_note)
    return db_note

def delete_note(db: Session, note_id: int, user_id: int) -> bool:
    db_note = get_note_by_id(db, note_id, user_id)
    if db_note:
        # Soft delete
        db_note.is_deleted = True
        db.commit()
        return True
    return False

def toggle_pin_note(db: Session, note_id: int, user_id: int) -> Optional[Note]:
    db_note = get_note_by_id(db, note_id, user_id)
    if db_note:
        db_note.is_pinned = not db_note.is_pinned
        db.commit()
        db.refresh(db_note)
    return db_note

def archive_note(db: Session, note_id: int, user_id: int) -> Optional[Note]:
    db_note = get_note_by_id(db, note_id, user_id)
    if db_note:
        db_note.is_archived = not db_note.is_archived
        db.commit()
        db.refresh(db_note)
    return db_note