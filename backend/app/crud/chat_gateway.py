from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from sqlalchemy.orm import Session
from app.crud.chat import create_private_message
from app.models.user import User

async def forward_message(
    db: Session,
    current_user: User,
    source: str,
    message_id: int,
    target_user_ids: list[int],
    target_group_ids: list[int],
):
    forwarded = {"users": [], "groups": []}

    original = (
        db.query(PrivateMessage).filter(PrivateMessage.id == message_id).first()
        if source == "private"
        else db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
    )

    if not original:
        raise Exception("Original message not found")

    original_sender = db.query(User).filter(
        User.id == original.sender_id
    ).first()

    # ---------- USERS ----------
    for uid in target_user_ids:
        if uid == current_user.id:
            continue
        if not is_friend(db, current_user.id, uid):
            continue

        msg = create_private_message(
            db=db,
            sender_id=current_user.id,
            receiver_id=uid,
            content=original.content,
            message_type=original.message_type.value,
            is_forwarded=True,
            forwarded_from_id=original.sender_id,
            original_sender=original_sender.username,
            original_sender_avatar=original_sender.avatar_url,
        )

        forwarded["users"].append((
            uid,
            {
                "action": "new_message",
                "id": msg.id,
                "content": msg.content,
                "message_type": msg.message_type.value,
                "sender": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "avatar_url": current_user.avatar_url,
                },
                "is_forwarded": True,
                "forwarded_by": {
                    "id": original_sender.id,
                    "username": original_sender.username,
                    "avatar_url": original_sender.avatar_url,
                },
                "created_at": msg.created_at.isoformat(),
            }
        ))

    # ---------- GROUPS ----------
    for gid in target_group_ids:
        if not is_group_member(db, gid, current_user.id):
            continue

        new_msg = GroupMessage(
            group_id=gid,
            sender_id=current_user.id,
            forwarded_by_id=original_sender.id,
            forwarded_at=datetime.utcnow(),
            content=original.content,
            message_type=original.message_type,
        )

        db.add(new_msg)
        db.commit()
        db.refresh(new_msg)

        forwarded["groups"].append((
            gid,
            {
                "action": "new_message",
                "id": new_msg.id,
                "group_id": gid,
                "content": new_msg.content,
                "sender": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "avatar_url": current_user.avatar_url,
                },
                "forwarded_by": {
                    "id": original_sender.id,
                    "username": original_sender.username,
                    "avatar_url": original_sender.avatar_url,
                },
                "created_at": to_local_iso(new_msg.created_at, 7),
            }
        ))

    return forwarded

