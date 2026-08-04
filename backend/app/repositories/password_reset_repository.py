from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.password_reset_token import PasswordResetToken


def create(
    db: Session, *, token: str, user_id: int, expires_at: datetime
) -> PasswordResetToken:
    record = PasswordResetToken(
        token=token, user_id=user_id, expires_at=expires_at
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_valid_by_token(db: Session, token: str) -> PasswordResetToken | None:
    return db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token == token,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )


def mark_used(db: Session, record: PasswordResetToken) -> None:
    record.used = True
    db.commit()
