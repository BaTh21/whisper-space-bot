# app/crud/group.py
import secrets
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.group import Group
from app.models.group_member import GroupMember
from app.crud.friend import is_friend
from typing import List
from datetime import datetime, timedelta
import uuid

from app.models.diary import Diary
from app.models.user import User
from app.schemas.group import GroupCreate
from app.models.friend import Friend
from app.models.group_invite import GroupInvite, InviteStatus
import string

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
        return f"{BASE_URL}/join-group/{existing.token}"

    # Create new
    token = generate_invite_token()
    link = GroupInviteLink(group_id=group_id, token=token)
    db.add(link)
    db.commit()
    return f"{BASE_URL}/join-group/{token}"
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
        return []

    return (
        db.query(Diary)
        .filter(Diary.group_id == group_id)
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

def get_group_invites(db: Session, user_id: int) -> List[GroupInvite]:
    return db.query(GroupInvite).filter(
        GroupInvite.invitee_id == user_id,
        GroupInvite.status == InviteStatus.pending
    ).all()

def accept_group_invite(db: Session, token: str, user_id: int):
    invite = db.query(GroupInvite).filter(
        GroupInvite.invite_token == token,
        GroupInvite.invitee_id == user_id,
        GroupInvite.status == InviteStatus.pending
    ).first()
    if not invite:
        raise HTTPException(404, "Invalid or expired invite")
    add_member(db, invite.group_id, user_id)
    invite.status = InviteStatus.accepted
    db.commit()

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