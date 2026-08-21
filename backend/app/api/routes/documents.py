from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.database.connection import get_db
from app.models.user import User
from app.repositories import (
    approval_repository,
    audit_log_repository,
    document_repository,
    permission_repository,
    user_repository,
)
from app.schemas.audit import ApprovalRead, ApprovalRequest, AuditLogRead
from app.schemas.document import (
    DocumentRead,
    DocumentUpdate,
    DocumentVersionRead,
)
from app.schemas.permission import PermissionCreate, PermissionRead
from app.services import document_service, storage_service
from app.services.audit_service import AuditAction, log_document
from app.services.scope_service import AccessLevel

router = APIRouter(prefix="/documents", tags=["documents"])


# Lấy danh sách tài liệu mà người dùng có quyền xem (có phân trang)
@router.get("", response_model=list[DocumentRead])
def list_documents(
    folder_id: int | None = None,
    response: Response = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    documents, total = document_service.list_documents(
        db,
        current_user=current_user,
        folder_id=folder_id,
        page=page,
        page_size=page_size,
    )
    response.headers["X-Total-Count"] = str(total)
    return documents


# Tải lên tài liệu mới kèm tên và thư mục tuỳ chọn
@router.post("", response_model=DocumentRead, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    folder_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.create_document(
        db,
        file=file,
        title=title,
        folder_id=folder_id,
        current_user=current_user,
    )


# Xem chi tiết một tài liệu
@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )


# Lấy nội dung văn bản đã trích xuất của tài liệu
@router.get("/{document_id}/text")
def get_document_text(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return {"extracted_text": document.extracted_text or ""}


# Tải lên phiên bản mới cho tài liệu (yêu cầu quyền chỉnh sửa)
@router.post("/{document_id}/upload", response_model=DocumentRead)
def upload_document_version(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.EDIT,
    )
    return document_service.upload_new_version(
        db, document=document, file=file, current_user=current_user
    )


# Cập nhật tiêu đề/thư mục của tài liệu (yêu cầu quyền chỉnh sửa)
@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: int,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.EDIT,
    )
    return document_service.update_document(
        db,
        document=document,
        title=data.title,
        folder_id=data.folder_id,
        current_user=current_user,
    )


# Xoá tài liệu (yêu cầu quyền quản trị)
@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.ADMIN,
    )
    document_service.delete_document(
        db, document=document, current_user=current_user
    )


# Tải file tài liệu xuống máy
@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    full_path = storage_service.get_full_path(document.file_path)
    if not full_path.exists():
        raise NotFoundError("File không còn tồn tại trên máy chủ")
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    }
    return FileResponse(str(full_path), filename=document.file_name, headers=headers)


# Lấy danh sách các phiên bản của tài liệu
@router.get("/{document_id}/versions", response_model=list[DocumentVersionRead])
def list_versions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return document_repository.list_versions(db, document_id)


# Tải xuống một phiên bản cụ thể của tài liệu
@router.get("/{document_id}/versions/{version}/download")
def download_version(
    document_id: int,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    record = document_repository.get_version(db, document_id, version)
    if not record:
        raise NotFoundError("Phiên bản không tồn tại")
    full_path = storage_service.get_full_path(record.file_path)
    if not full_path.exists():
        raise NotFoundError("File không còn tồn tại trên máy chủ")
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    }
    return FileResponse(str(full_path), filename=record.file_name, headers=headers)


# Lấy danh sách quyền chia sẻ của tài liệu kèm thông tin người dùng
@router.get("/{document_id}/permissions", response_model=list[PermissionRead])
def list_permissions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    permissions = permission_repository.list_for_document(db, document_id)
    users = {u.id: u for u in user_repository.list_users(db)}
    result = []
    for p in permissions:
        item = PermissionRead.model_validate(p)
        user = users.get(p.user_id)
        if user:
            item.user_full_name = user.full_name
            item.user_email = user.email
        result.append(item)
    return result


# Chia sẻ/cập nhật quyền truy cập tài liệu cho người dùng
@router.post("/{document_id}/permissions", response_model=PermissionRead, status_code=201)
def grant_permission(
    document_id: int,
    data: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.ADMIN,
    )
    # Tài liệu đang chờ duyệt chưa thể chia sẻ
    if document.status == "pending":
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("Tài liệu đang chờ duyệt, chưa thể chia sẻ")
    target = user_repository.get_by_id(db, data.user_id)
    if not target:
        raise NotFoundError("Người dùng không tồn tại")
    existing = permission_repository.get(db, document.id, data.user_id)
    if existing:
        existing.access_level = data.access_level
        db.commit()
        db.refresh(existing)
        permission = existing
    else:
        permission = permission_repository.create(
            db,
            document_id=document.id,
            user_id=data.user_id,
            access_level=data.access_level,
        )
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.SHARE_GRANT,
        document_id=document.id,
        details=f"user {data.user_id}: {data.access_level}",
    )
    return permission


# Thu hồi quyền truy cập tài liệu của một người dùng
@router.delete("/{document_id}/permissions/{user_id}", status_code=204)
def revoke_permission(
    document_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.ADMIN,
    )
    permission = permission_repository.get(db, document.id, user_id)
    if not permission:
        raise NotFoundError("Chưa chia sẻ cho người dùng này")
    permission_repository.delete(db, permission)
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.SHARE_REVOKE,
        document_id=document.id,
        details=f"user {user_id}",
    )


# Lấy danh sách yêu cầu phê duyệt của tài liệu
@router.get("/{document_id}/approvals", response_model=list[ApprovalRead])
def list_approvals(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return approval_repository.list_for_document(db, document_id)


# Gửi yêu cầu phê duyệt/từ chối cho tài liệu
@router.post("/{document_id}/approval", response_model=DocumentRead)
def submit_approval(
    document_id: int,
    data: ApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db,
        document_id=document_id,
        current_user=current_user,
        required=AccessLevel.ADMIN,
    )
    return document_service.approve_document(
        db,
        document=document,
        decision=data.decision,
        reason=data.reason,
        current_user=current_user,
    )


# Lấy lịch sử hoạt động của một tài liệu
@router.get("/{document_id}/audit-logs", response_model=list[AuditLogRead])
def document_audit_logs(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return audit_log_repository.list_by_document(db, document_id)