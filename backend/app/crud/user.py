from sqlalchemy.orm import Session
from app.schemas.auth import UserCreate
from app.models.user import User
from app.schemas.user import UserUpdate
from app.core.security import hash_password
from typing import List


def get_by_id(db: Session, user_id: int) -> User:
    return db.query(User).filter(User.id == user_id).first()


def get_by_email(db: Session, email: str) -> User:
    return db.query(User).filter(User.email == email).first()


def create(db: Session, user_in: UserCreate) -> User:
    hashed = hash_password(user_in.password)
    user = User(username=user_in.username, email=user_in.email, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update(db: Session, user: User, user_in: UserUpdate) -> User:
    update_data = user_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def search(db: Session, q: str) -> List[User]:
    q_clean = q.strip()
    if not q_clean:
        return []
    return db.query(User).filter(User.username.ilike(f"%{q_clean}%")).limit(10).all()


def verify(db: Session, user_id: int):
    user = get_by_id(db, user_id)
    if user:
        user.is_verified = True
        db.commit()