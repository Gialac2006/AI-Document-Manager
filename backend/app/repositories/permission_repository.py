from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.permission import Permission


# Lấy quyền truy cập của một người dùng trên một tài liệu
def get(db: Session, document_id: int, user_id: int) -> Permission | None:
    return db.scalar(
        select(Permission).where(
            Permission.document_id == document_id,
            Permission.user_id == user_id,
        )
    )


# Lấy danh sách quyền truy cập của một tài liệu
def list_for_document(db: Session, document_id: int) -> list[Permission]:
    return list(
        db.scalars(
            select(Permission)
            .where(Permission.document_id == document_id)
            .order_by(Permission.user_id)
        ).all()
    )


# Cấp quyền truy cập tài liệu cho người dùng
def create(
    db: Session,
    *,
    document_id: int,
    user_id: int,
    access_level: str,
) -> Permission:
    permission = Permission(
        document_id=document_id,
        user_id=user_id,
        access_level=access_level,
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


# Xóa quyền truy cập của người dùng
def delete(db: Session, permission: Permission) -> None:
    db.delete(permission)
    db.commit()