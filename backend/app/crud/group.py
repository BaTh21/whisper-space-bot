# app/crud/group.py
import secrets
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.group import Group
from app.models.group_member import GroupMember
from app.crud.friend import is_friend
from typing import List
from datetime import datetime, timedelta
import uuid
from zoneinfo import ZoneInfo
import pytz

from app.models.diary import Diary
from app.models.user import User
from app.schemas.group import GroupCreate, GroupUpdate
from app.models.friend import Friend
from app.models.diary_group import DiaryGroup
from app.models.group_invite import GroupInvite, InviteStatus
import string
from sqlalchemy.orm import joinedload

from app.models.group_invite_link import GroupInviteLink


def generate_invite_token():
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

def get_or_create_invite_link(db: Session, group_id: int, user_id: int):
    # Check if user is in group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(403, "You are not a member of this group")

    # Check if link already exists
    existing = db.query(GroupInviteLink).filter(
        GroupInviteLink.group_id == group_id
    ).first()

    if existing:
        return existing.token

    # Create new
    token = generate_invite_token()
    link = GroupInviteLink(group_id=group_id, token=token)
    db.add(link)
    db.commit()
    return token

def get_user_groups(db: Session, user_id: int) -> List[Group]:
    """
    Get all groups the current user is a member of.
    """
    return (
        db.query(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .filter(GroupMember.user_id == user_id)
        .all()
    )
    
def get_group(db: Session, group_id: int):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Group not found")
        
    return group

def update_group(group_id: int, db: Session, group_data: GroupUpdate, current_user_id: int):
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Group not found")
        
    if group.creator_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only owner can update this group")
        
    group.updated_at = datetime.utcnow()
        
    update_data = group_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(group, key, value)

    db.commit()
    db.refresh(group)
    return group
    

def get_pending_invites(db: Session, user_id: int):
    from sqlalchemy.orm import joinedload
    
    return (
        db.query(GroupInvite)
        .filter(GroupInvite.invitee_id == user_id, GroupInvite.status == "pending")
        .options(joinedload(GroupInvite.group), joinedload(GroupInvite.inviter))
        .all()
    )

def accept_group_invite(db: Session, invite_id: int, user_id: int) -> Group:
    invite = db.query(GroupInvite).filter(
        GroupInvite.id == invite_id,
        GroupInvite.invitee_id == user_id,
        GroupInvite.status == "pending"
    ).first()
    if not invite:
        raise HTTPException(404, "Invite not found or already processed")

    # Add user to group
    member = GroupMember(user_id=user_id, group_id=invite.group_id)
    db.add(member)

    # Mark invite as accepted
    invite.status = "accepted"
    db.commit()
    db.refresh(invite.group)
    return invite.group
    
def get_group_members(db: Session, group_id: int, user_id: int) -> List[User]:
    # Verify user is in group
    member_check = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    if not member_check:
        return []

    return (
        db.query(User)
        .join(GroupMember, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id == group_id)
        .all()
    )

def get_group_diaries(db: Session, group_id: int, user_id: int) -> List[Diary]:
    # Optional: verify membership
    member_check = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    if not member_check:
        raise HTTPException(status_code=400, detail="You are not member of this group")

    return (
        db.query(Diary)
        .join(DiaryGroup, Diary.id == DiaryGroup.diary_id)
        .filter(DiaryGroup.group_id == group_id)
        .options(joinedload(Diary.groups)) 
        .order_by(Diary.created_at.desc())
        .all()
    )

def create_group(db: Session, name: str, creator_id: int, description: str = None) -> Group:
    group = Group(name=name, creator_id=creator_id, description=description)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

def add_member(db: Session, group_id: int, user_id: int, is_admin: bool = False):
    member = GroupMember(group_id=group_id, user_id=user_id, is_admin=is_admin)
    db.merge(member)
    db.commit()

def create_group_with_invites(
    db: Session,
    group_in: GroupCreate,
    creator_id: int,
) -> Group:
    # 1. Create the group
    db_group = Group(
        name=group_in.name,
        description=group_in.description,
        creator_id=creator_id,
        created_at=datetime.utcnow(),
    )
    db.add(db_group)
    db.flush()  # This gives us group.id

    # 2. Creator is automatically a member
    db_member = GroupMember(user_id=creator_id, group_id=db_group.id)
    db.add(db_member)

    # 3. Invite friends (if any) - FIXED: Actually create invitations
    if group_in.invite_user_ids:
        # Verify each ID is a friend of the creator
        friend_ids = (
            db.query(Friend.friend_id)
            .filter(Friend.user_id == creator_id, Friend.status == "accepted")
            .all()
        )
        friend_ids = {f[0] for f in friend_ids}

        for uid in group_in.invite_user_ids:
            if uid == creator_id:
                continue
            if uid not in friend_ids:
                continue  # Skip non-friends instead of raising error
                
            # Create invite record
            db_invite = GroupInvite(
                group_id=db_group.id,
                inviter_id=creator_id,
                invitee_id=uid,
                status=InviteStatus.pending,
                invite_token=secrets.token_urlsafe(16)
            )
            db.add(db_invite)

    db.commit()
    db.refresh(db_group)
    return db_group

def get_group_invites(db: Session, user_id: int):
    invites = db.query(GroupInvite).filter(
        GroupInvite.invitee_id == user_id,
        GroupInvite.status == InviteStatus.pending
    ).all()
    if not invites:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="You have no invite yet")
        
    return invites

def accept_group_invite(db: Session, invite_id: id, user_id: int):
    
    invite = db.query(GroupInvite).filter(GroupInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Invite not found")
        
    if invite.invitee_id != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You are not invited to this group")
        
    cambodia_tz = pytz.timezone("Asia/Phnom_Penh")
    now = datetime.now(cambodia_tz)
        
    if invite.expires_at < now:
        raise HTTPException(status_code=status.HTTP_410_GONE,
                            detail="Token is expired")
    
    if invite.status != InviteStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invite can be used only once")
        
    existing_member = db.query(GroupMember).filter(
        GroupMember.group_id == invite.group_id,
        GroupMember.user_id == user_id
    ).first()
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already join this group"
        )
        
    save_invite = GroupMember(
        group_id = invite.group_id,
        user_id = user_id,
    )
    
    db.add(save_invite)
    
    invite.status = InviteStatus.accepted
    db.commit()
    return {"datail": "You have joined the group successfully"}

def delete_group_invite(db: Session, invite_id: int):
    invite = db.query(GroupInvite).filter(GroupInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Invite not found")

    db.delete(invite)
    db.commit()
    return {"detail": "Invite has been deleted"}

def get_group_invite_link(db: Session, group_id: int, user_id: int):
    group = db.query(Group).filter(Group.id == group_id, Group.creator_id == user_id).first()
    if not group:
        raise HTTPException(403, "Not authorized")
    token = str(uuid.uuid4())
    invite = GroupInvite(
        group_id=group_id,
        inviter_id=user_id,
        invite_token=token,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(invite)
    db.commit()
    return f"http://localhost:3000/join-group?token={token}"

def create_group_with_invites(db: Session, group_in: GroupCreate, creator_id: int) -> Group:
    # Create group
    db_group = Group(
        name=group_in.name,
        description=group_in.description,
        creator_id=creator_id,
        created_at=datetime.utcnow()
    )
    db.add(db_group)
    db.flush()  # Get group.id

    # Add creator as member
    db_member = GroupMember(user_id=creator_id, group_id=db_group.id)
    db.add(db_member)

    db.commit()
    db.refresh(db_group)
    return db_group

def invite_user(group_id: int, user_id: int, db: Session, current_user_id: int):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Group not found")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="User not found")
        
    cambodia_tz = pytz.timezone("Asia/Phnom_Penh")
    now = datetime.now(tz=cambodia_tz)
        
    new_invite = GroupInvite(
        group_id=group_id,
        inviter_id=current_user_id,
        invitee_id=user_id,
        status=InviteStatus.pending,
        invite_token=secrets.token_urlsafe(16),
        created_at=now,
        expires_at=now + timedelta(minutes=5)
    )
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    
    return new_invite
def remove_member(
    group_id: int,
    member_id: int,
    db: Session,
    current_user_id: int
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Group not found")
        
    if group.creator_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only creator can remove members") 
        
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == member_id
    ).first()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Member not found")
        
    db.delete(member)
    db.commit()
    return None

def leave_group(group_id: int, db: Session, current_user_id: int):
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="You are not member of this group")
        
    db.delete(member)
    db.commit()
    return None