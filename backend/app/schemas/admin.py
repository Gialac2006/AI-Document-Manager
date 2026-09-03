from datetime import datetime

from pydantic import BaseModel

from app.schemas.audit import AuditLogRead


# Schema thống kê số lượng người dùng theo vai trò
class RoleCount(BaseModel):
    role: str
    count: int


# Schema thống kê thông tin tổ chức và số thành viên
class OrganizationStats(BaseModel):
    id: int
    name: str
    created_at: datetime
    member_count: int


# Schema thống kê số lượng tài liệu theo trạng thái
class DocumentStatusCount(BaseModel):
    status: str
    count: int


# Schema tổng hợp dữ liệu thống kê cho trang quản trị
class AdminStats(BaseModel):
    total_users: int
    total_organizations: int
    total_documents: int
    total_audit_logs: int
    users_by_role: list[RoleCount]
    organizations: list[OrganizationStats]
    documents_by_status: list[DocumentStatusCount]
    recent_activity: list[AuditLogRead]
