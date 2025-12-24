from app.models.activity import Activity, ActivityType
from sqlalchemy.orm import Session

def create_activity(
    db: Session,
    *,
    actor_id: int,
    recipient_id: int,
    activity_type: ActivityType,
    post_id: int | None = None,
    comment_id: int | None = None,
    friend_request_id: int | None = None,
    group_id: int | None = None,
    extra_data : dict | None = None
):
    activity = Activity(
        actor_id=actor_id,
        recipient_id=recipient_id,
        type=activity_type,
        post_id=post_id,
        comment_id=comment_id,
        friend_request_id=friend_request_id,
        group_id=group_id,
        extra_data =extra_data  or {},
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return activity
