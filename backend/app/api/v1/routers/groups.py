from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.crud.group import create_group, get_user_groups, add_member, exists_member
from app.crud.chat import create_group_message
from app.models.user import User
from app.schemas.group import GroupCreate, GroupMessageCreate, GroupMessageOut, GroupOut
from app.services.websocket_manager import manager

router = APIRouter()


@router.post("/", response_model=GroupOut)
def create_group_endpoint(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    group = create_group(db, group_in.name, current_user.id, group_in.description)
    add_member(db, group.id, current_user.id)  # creator auto-joins
    return GroupOut.from_orm(group)


@router.get("/", response_model=List[GroupOut])
def list_my_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    groups = get_user_groups(db, current_user.id)
    return [GroupOut.from_orm(g) for g in groups]


@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if exists_member(db, group_id, current_user.id):
        raise HTTPException(400, "Already a member")
    add_member(db, group_id, current_user.id)
    return {"msg": "Joined group"}


@router.post("/{group_id}/message", response_model=GroupMessageOut)
async def send_group_message(
    group_id: int,
    msg_in: GroupMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not exists_member(db, group_id, current_user.id):
        raise HTTPException(403, "Not a member")
    
    msg = create_group_message(db, current_user.id, group_id, msg_in.content, msg_in.message_type)

    groupid = f"private_{min(current_user.id, group_id)}_{max(current_user.id, group_id)}"
    await manager.broadcast(
        groupid, 
        {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "group_id": msg.group_id,
            "content": msg.content,
            "message_type": msg.message_type.value,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
    )

    return GroupMessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        group_id=msg.group_id,
        content=msg.content,
        message_type=msg.message_type.value,
        created_at=msg.created_at
    )