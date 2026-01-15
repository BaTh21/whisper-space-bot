from app.models.private_message import MessageType, PrivateMessage
from app.models.group_message import GroupMessage
from sqlalchemy.orm import Session
from typing import Union

def create_forwarded_private_message(
    db,
    forwarder_id: int,
    receiver_id: int,
    original: PrivateMessage | GroupMessage,
    is_from_group: bool = False
) -> PrivateMessage:
    original_sender = original.sender
    msg = PrivateMessage(
        sender_id=forwarder_id,
        receiver_id=receiver_id,
        content=original.content,
        message_type=original.message_type,
        voice_duration=getattr(original, "voice_duration", None),
        file_size=getattr(original, "file_size", None),
        is_forwarded=True,
        forwarded_from_id=original_sender.id if original_sender else None,
        original_sender=original_sender.username if original_sender else "Deleted",
        original_sender_avatar=original_sender.avatar_url if original_sender else None,
        forwarded_from_group_id=original.group_id if is_from_group else None,
        # optional: forwarded_from_message_id=original.id
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def create_forwarded_group_message(
    db: Session,
    forwarder_id: int,
    group_id: int,
    original_msg: Union[PrivateMessage, GroupMessage],
    original_is_private: bool = False
) -> GroupMessage:
    orig_sender = original_msg.sender

    msg = GroupMessage(
        group_id=group_id,
        sender_id=forwarder_id,
        content=original_msg.content,
        message_type=original_msg.message_type,
        file_url=getattr(original_msg, "file_url", None),
        voice_url=getattr(original_msg, "voice_url", None),
        call_content=getattr(original_msg, "call_content", None),
        is_forwarded=True,
        forwarded_from_id=orig_sender.id if orig_sender else None,
        original_sender=orig_sender.username if orig_sender else "Deleted User",
        original_sender_avatar=orig_sender.avatar_url if orig_sender else None,
        # Optional: forwarded_from_private_sender_id = original_msg.sender_id if original_is_private
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg