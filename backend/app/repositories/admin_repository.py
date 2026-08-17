from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.organization import Organization
from app.models.user import User


# Đếm tổng số người dùng
def count_users(db: Session) -> int:
    return db.scalar(select(func.count(User.id))) or 0


# Đếm tổng số tổ chức
def count_organizations(db: Session) -> int:
    return db.scalar(select(func.count(Organization.id))) or 0


# Đếm tổng số tài liệu
def count_documents(db: Session) -> int:
    return db.scalar(select(func.count(Document.id))) or 0


# Đếm tổng số nhật ký hoạt động
def count_audit_logs(db: Session) -> int:
    return db.scalar(select(func.count(AuditLog.id))) or 0


# Thống kê số lượng người dùng theo vai trò
def users_by_role(db: Session) -> list[dict]:
    rows = db.execute(
        select(User.role, func.count(User.id)).group_by(User.role).order_by(User.role)
    ).all()
    return [{"role": role, "count": count} for role, count in rows]


# Lấy danh sách tổ chức kèm số lượng thành viên
def organizations_with_member_counts(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Organization.id,
            Organization.name,
            Organization.created_at,
            func.count(User.id),
        )
        .outerjoin(User, User.organization_id == Organization.id)
        .group_by(Organization.id, Organization.name, Organization.created_at)
        .order_by(Organization.id)
    ).all()
    return [
        {
            "id": organization_id,
            "name": name,
            "created_at": created_at,
            "member_count": member_count,
        }
        for organization_id, name, created_at, member_count in rows
    ]


# Thống kê số lượng tài liệu theo trạng thái
def documents_by_status(db: Session) -> list[dict]:
    rows = db.execute(
        select(Document.status, func.count(Document.id))
        .group_by(Document.status)
        .order_by(Document.status)
    ).all()
    return [{"status": status, "count": count} for status, count in rows]


# Lấy danh sách tài liệu đang chờ xử lý
def list_pending_documents(db: Session, limit: int = 50) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .where(Document.status == "pending")
            .order_by(Document.created_at.desc())
            .limit(limit)
        ).all()
    )


# Lấy các nhật ký hoạt động gần đây
def recent_audit_logs(db: Session, limit: int = 12) -> list[AuditLog]:
    return list(
        db.scalars(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        ).all()
    )
