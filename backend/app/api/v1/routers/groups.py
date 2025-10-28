from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.group import GroupCreate, GroupInviteOut, GroupMessageCreate, GroupMessageOut, GroupOut
from app.services.websocket_manager import manager
from app.crud.group import accept_group_invite, add_member, create_group_with_invites, get_group_diaries, get_group_invite_link, get_group_invites, get_group_members, get_pending_invites, get_user_groups
from app.schemas.diary import DiaryOut
from app.schemas.user import UserOut
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.group_invite import GroupInvite

router = APIRouter()

# CREATE GROUP
@router.post("/", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return create_group_with_invites(db, group_in, current_user.id)


@router.get("/my", response_model=List[GroupOut])
def list_my_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    groups = get_user_groups(db, current_user.id)
    return groups



@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if(db, group_id, current_user.id):
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
    
    msg =(db, current_user.id, group_id, msg_in.content, msg_in.message_type)

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
    
@router.get("/invites", response_model=List[GroupOut])
def list_invites(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invites = get_group_invites(db, current_user.id)
    return [GroupOut.from_orm(i.group) for i in invites]

@router.post("/{token}/accept")
def accept_invite(token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accept_group_invite(db, token, current_user.id)
    return {"msg": "Joined group"}

@router.get("/{group_id}/invite-link")
def get_invite_link(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.crud.group import get_or_create_invite_link
    try:
        link = get_or_create_invite_link(db, group_id, current_user.id)
        return {"invite_link": link}
    except HTTPException as e:
        raise e
    except:
        raise HTTPException(500, "Failed to generate link")

@router.get("/{group_id}/members/", response_model=List[UserOut])
def get_group_members_endpoint(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = get_group_members(db, group_id, current_user.id)
    if not members:
        raise HTTPException(404, "Group not found or you're not a member")
    return members

@router.get("/{group_id}/diaries/", response_model=List[DiaryOut])
def get_group_diaries_endpoint(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diaries = get_group_diaries(db, group_id, current_user.id)
    return diaries

@router.get("/invites/pending")
def get_pending_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")

    invites = db.query(GroupInvite).filter(
        GroupInvite.invitee_id == current_user.id,
        GroupInvite.status == "pending"
    ).all()

    return [
        {
            "id": i.id,
            "group": {"id": i.group.id, "name": i.group.name},
            "inviter": {"id": i.inviter.id, "username": i.inviter.username}
        }
        for i in invites
    ]

@router.post("/invites/{invite_id}/accept")
def accept_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = accept_group_invite(db, invite_id, current_user.id)
    return {"detail": "Joined group", "group": GroupOut.from_orm(group)}