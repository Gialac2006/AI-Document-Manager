from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import ForbiddenError
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.repositories import audit_log_repository, user_repository
from app.schemas.audit import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


# Lấy danh sách lịch sử hoạt động với các bộ lọc, chỉ quản lý/xem được trong tổ chức của mình
@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    user_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        return audit_log_repository.list_all(
            db,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )

    # Mặc định xem lịch sử của chính mình nếu không chỉ định user
    if user_id is None:
        user_id = current_user.id
        user_id = current_user.id

    # Kiểm tra quyền khi xem lịch sử của người khác
    if user_id != current_user.id:
        if current_user.role != UserRole.MANAGER:
            raise ForbiddenError("Bạn không thể xem lịch sử của người khác")
        target = user_repository.get_by_id(db, user_id)
        if not target or target.organization_id != current_user.organization_id:
            raise ForbiddenError("Chỉ được xem lịch sử của thành viên trong tổ chức")

    return audit_log_repository.list_all(
        db,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
