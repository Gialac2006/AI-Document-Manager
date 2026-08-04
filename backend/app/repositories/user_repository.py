from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create(
    db: Session,
    *,
    full_name: str,
    email: str,
    hashed_password: str,
    role: str,
    organization_id: int | None = None,
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        hashed_password=hashed_password,
        role=role,
        organization_id=organization_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(
    db: Session, organization_id: int | None = None
) -> list[User]:
    query = select(User).order_by(User.id)
    if organization_id is not None:
        query = query.where(User.organization_id == organization_id)
    return list(db.scalars(query).all())
