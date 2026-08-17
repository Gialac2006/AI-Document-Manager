from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_super_admin
from app.core.exceptions import DuplicateError, NotFoundError
from app.database.connection import get_db
from app.models.user import User
from app.repositories import (
    admin_repository,
    organization_repository,
    user_repository,
)
from app.schemas.admin import AdminStats, OrganizationStats
from app.schemas.document import DocumentRead
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationDetail,
    OrganizationRead,
)
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


# Lấy danh sách tổ chức và số lượng thành viên của từng tổ chức
@router.get("/organizations", response_model=list[OrganizationStats])
def list_organizations(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_repository.organizations_with_member_counts(db)


# Tạo tổ chức mới, báo lỗi nếu tên đã tồn tại
@router.post(
    "/organizations", response_model=OrganizationRead, status_code=201
)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    if organization_repository.get_by_name(db, data.name):
        raise DuplicateError("Tên tổ chức đã tồn tại")
    return organization_repository.create(db, name=data.name.strip())


# Xem chi tiết tổ chức kèm danh sách thành viên
@router.get(
    "/organizations/{organization_id}", response_model=OrganizationDetail
)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    organization = organization_repository.get_by_id(db, organization_id)
    if not organization:
        raise NotFoundError("Tổ chức không tồn tại")
    organization.members = user_repository.list_users(
        db, organization_id=organization_id
    )
    return organization


# Xoá một tổ chức theo id
@router.delete("/organizations/{organization_id}", status_code=204)
def delete_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    organization = organization_repository.get_by_id(db, organization_id)
    if not organization:
        raise NotFoundError("Tổ chức không tồn tại")
    db.delete(organization)
    db.commit()


# Lấy danh sách tất cả người dùng
@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return user_repository.list_users(db)


# Tổng hợp các số liệu thống kê của hệ thống
@router.get("/stats", response_model=AdminStats)
def admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return AdminStats(
        total_users=admin_repository.count_users(db),
        total_organizations=admin_repository.count_organizations(db),
        total_documents=admin_repository.count_documents(db),
        total_audit_logs=admin_repository.count_audit_logs(db),
        users_by_role=admin_repository.users_by_role(db),
        organizations=admin_repository.organizations_with_member_counts(db),
        documents_by_status=admin_repository.documents_by_status(db),
        recent_activity=admin_repository.recent_audit_logs(db),
    )


# Lấy danh sách tài liệu đang chờ phê duyệt
@router.get("/pending-approvals", response_model=list[DocumentRead])
def list_pending_approvals(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_repository.list_pending_documents(db)
