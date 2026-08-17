from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


# Tạo mới một bản ghi nhật ký hoạt động
def create(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity_type: str = "document",
    entity_id: int | None = None,
    details: str | None = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# Áp dụng các bộ lọc (người dùng, hành động, thời gian) cho truy vấn nhật ký
def _apply_filters(
    query,
    *,
    user_id: int | None,
    action: str | None,
    entity_type: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
):
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if date_from is not None:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.created_at <= date_to)
    return query


# Lấy nhật ký hoạt động của một tài liệu
def list_by_document(
    db: Session, document_id: int, limit: int = 200
) -> list[AuditLog]:
    return list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.entity_type == "document", AuditLog.entity_id == document_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        ).all()
    )


# Lấy nhật ký hoạt động của một người dùng
def list_by_user(
    db: Session,
    user_id: int,
    *,
    limit: int = 200,
) -> list[AuditLog]:
    return list_all(db, user_id=user_id, limit=limit)


# Lấy danh sách nhật ký hoạt động theo bộ lọc
def list_all(
    db: Session,
    *,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[AuditLog]:
    query = select(AuditLog)
    query = _apply_filters(
        query,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
    )
    query = (
        query.order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(query).all())


# Đếm số lượng nhật ký hoạt động theo bộ lọc
def count_all(
    db: Session,
    *,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> int:
    query = select(func.count(AuditLog.id))
    query = _apply_filters(
        query,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
    )
    return db.scalar(query) or 0
