from sqlalchemy.orm import Session
from app.models.verification_code import VerificationCode
from datetime import datetime, timedelta
import random
from app.core.config import settings
from app.models.refresh_token import RefreshToken


def store_refresh_token(db: Session, user_id: int, token: str):
    expires_at = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    rt = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(rt)
    db.commit()
    return rt


def get_valid_refresh_token(db: Session, token: str) -> RefreshToken | None:
    return db.query(RefreshToken).filter(
        RefreshToken.token == token,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()


def revoke_refresh_token(db: Session, token: str):
    db.query(RefreshToken).filter(RefreshToken.token == token).delete()
    db.commit()


def create_verification_code(db: Session, user_id: int, code: str = None):
    if not code:
        code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    vc = VerificationCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(vc)
    db.commit()
    return vc


def get_valid_code(db: Session, user_id: int, code: str) -> VerificationCode:
    return db.query(VerificationCode).filter(
        VerificationCode.user_id == user_id,
        VerificationCode.code == code,
        VerificationCode.expires_at > datetime.utcnow()
    ).first()


def delete_code(db: Session, vc_id: int):
    db.query(VerificationCode).filter(VerificationCode.id == vc_id).delete()
    db.commit()