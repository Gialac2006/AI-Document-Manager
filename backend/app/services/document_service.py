from fastapi import UploadFile

from app.core.exceptions import BadRequestError, ForbiddenError
from app.models.document import Document
from app.models.user import User
from app.repositories import document_repository, folder_repository
from app.services import storage_service
from app.services.audit_service import AuditAction, log_document
from app.services.extraction_service import TextExtractionError, extract_text
from app.services.scope_service import AccessLevel, Scope, check_folder_scope
from app.utils.file_utils import (
    get_file_extension,
    is_allowed_extension,
    validate_file_header,
)


# Xác định quyền truy cập hiệu lực của user với tài liệu
def _resolve_access_for(db, document: Document, current_user: User) -> str:
    """Trả về access_level hiệu lực (view/edit/manage) của user với document."""
    from app.repositories.permission_repository import get as get_permission

    if current_user.role == "super_admin":
        return "manage"
    if current_user.id == document.owner_id:
        return "manage"
    if current_user.role == "manager" and document.organization_id == current_user.organization_id:
        return "manage"
    if (
        current_user.role in ("staff", "manager")
        and document.organization_id == current_user.organization_id
    ):
        return "edit"
    perm = get_permission(db, document.id, current_user.id)
    if perm and perm.access_level == "admin":
        return "manage"
    return perm.access_level if perm else "view"


# Kiểm tra định dạng và nội dung file tải lên
def _validated_file(file: UploadFile):
    ext = get_file_extension(file.filename or "")
    if not is_allowed_extension(ext):
        raise BadRequestError("Định dạng file không được hỗ trợ")
    header = file.file.read(8)
    file.file.seek(0)
    if not validate_file_header(ext, header):
        raise BadRequestError("File không khớp với phần mở rộng (kiểm tra nội dung)")


# Tạo tài liệu mới, lưu file và trích xuất nội dung văn bản
def create_document(
    db,
    *,
    file: UploadFile,
    title: str,
    folder_id: int | None,
    current_user: User,
) -> Document:
    _validated_file(file)
    ext = get_file_extension(file.filename or "")

    scope = Scope(current_user)
    organization_id = scope.organization_id
    owner_id = scope.owner_id

    if folder_id is not None:
        folder = check_folder_scope(
            folder_repository.get_by_id(db, folder_id),
            current_user,
            required=AccessLevel.EDIT,
            db=db,
        )
        if organization_id is not None and folder.organization_id != organization_id:
            raise BadRequestError("Thư mục không thuộc tổ chức của bạn")

    title = title.strip()
    if not title:
        title = file.filename.rsplit(".", 1)[0] or "Chưa có tiêu đề"

    file_path = storage_service.save_file(file, owner_id=current_user.id)
    initial_status = (
        "pending"
        if current_user.role == "staff"
        else "approved"
    )
    document = document_repository.create(
        db,
        title=title,
        file_path=file_path,
        file_name=file.filename or "untitled",
        file_type=ext,
        folder_id=folder_id,
        organization_id=organization_id,
        owner_id=owner_id,
        status=initial_status,
    )
    document_repository.create_version(
        db,
        document_id=document.id,
        version=1,
        file_path=file_path,
        file_name=document.file_name,
        created_by=current_user.id,
    )

    # Đánh dấu tài liệu đang được xử lý
    document = document_repository.update_processing(
        db,
        document,
        status="processing",
    )

    try:
        # Chuyển đường dẫn tương đối thành đường dẫn thật trong File Storage
        full_path = storage_service.get_full_path(file_path)

        # Đọc nội dung văn bản từ PDF
        extracted_text = extract_text(full_path)

        # Lưu văn bản vào PostgreSQL
        document = document_repository.update_processing(
            db,
            document,
            status="text_extracted",
            extracted_text=extracted_text,
        )

    except TextExtractionError as error:
        # File vẫn được upload nhưng đánh dấu quá trình đọc nội dung thất bại
        document = document_repository.update_processing(
            db,
            document,
            status="failed",
            processing_error=str(error),
        )

    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.CREATE,
        document_id=document.id,
        details=document.title,
    )
    document.access_level = "manage"
    return document


# Tải lên phiên bản mới cho tài liệu
def upload_new_version(
    db, *, document: Document, file: UploadFile, current_user: User
) -> Document:
    _validated_file(file)
    ext = get_file_extension(file.filename or "")

    file_path = storage_service.save_file(file, owner_id=current_user.id)
    version = document_repository.next_version(db, document.id)
    document_repository.create_version(
        db,
        document_id=document.id,
        version=version,
        file_path=file_path,
        file_name=file.filename or document.file_name,
        created_by=current_user.id,
    )
    document = document_repository.update_file(
        db,
        document,
        file_path=file_path,
        file_name=file.filename or document.file_name,
        file_type=ext,
        current_version=version,
    )
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.UPLOAD_VERSION,
        document_id=document.id,
        details=f"v{version}: {file.filename or document.file_name}",
    )
    document.access_level = _resolve_access_for(db, document, current_user)
    return document


# Lấy tài liệu theo id và kiểm tra quyền truy cập
def get_document(
    db, *, document_id: int, current_user: User, required: str = AccessLevel.VIEW
) -> Document:
    from app.services.scope_service import check_document_scope

    document = document_repository.get_by_id(db, document_id)
    document = check_document_scope(document, current_user, required=required, db=db)
    if current_user.role == "staff" and document.status == "pending":
        if document.owner_id != current_user.id:
            scope = Scope(current_user, db=db)
            if not scope.has_explicit(document.id):
                raise ForbiddenError("Tài liệu đang chờ duyệt, bạn chưa được xem")
    if not hasattr(document, "access_level"):
        document.access_level = _resolve_access_for(db, document, current_user)
    if required == AccessLevel.VIEW:
        log_document(
            db,
            user_id=current_user.id,
            action=AuditAction.VIEW,
            document_id=document.id,
            details=document.title,
        )
    return document


# Lấy danh sách tài liệu trong phạm vi quyền của user
def list_documents(
    db, *, current_user: User, folder_id: int | None = None
) -> list[Document]:
    from app.models.permission import Permission

    scope = Scope(current_user)
    documents = document_repository.list_all(
        db,
        organization_id=scope.organization_id,
        owner_id=scope.owner_id,
        user_id=current_user.id if not scope.is_super_admin else None,
        folder_id=folder_id,
    )
    can_admin_see_pending = current_user.role in ("super_admin", "manager")
    if not can_admin_see_pending:
        visible = []
        for doc in documents:
            if doc.owner_id == current_user.id:
                visible.append(doc)
                continue
            perms = db.query(Permission.id).filter(
                Permission.document_id == doc.id,
                Permission.user_id == current_user.id,
            )
            shared = perms.first() is not None
            if shared or doc.status == "approved":
                visible.append(doc)
        documents = visible
    for doc in documents:
        doc.access_level = _resolve_access_for(db, doc, current_user)
    return documents


# Cập nhật tiêu đề và thư mục của tài liệu
def update_document(
    db, *, document: Document, title: str, folder_id: int | None, current_user: User
) -> Document:
    if folder_id is not None:
        check_folder_scope(
            folder_repository.get_by_id(db, folder_id),
            current_user,
            required=AccessLevel.EDIT,
            db=db,
        )
    document = document_repository.update(
        db, document, title=title, folder_id=folder_id
    )
    if not hasattr(document, "access_level"):
        document.access_level = _resolve_access_for(db, document, current_user)
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.EDIT,
        document_id=document.id,
        details=document.title,
    )
    return document


# Xóa tài liệu và file lưu trữ
def delete_document(db, *, document: Document, current_user: User) -> None:
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.DELETE,
        document_id=document.id,
        details=document.title,
    )
    storage_service.delete_file(document.file_path)
    document_repository.delete(db, document)


# Phê duyệt hoặc từ chối tài liệu đang chờ duyệt
def approve_document(
    db, *, document: Document, decision: str, reason: str | None, current_user: User
) -> Document:
    from app.repositories import approval_repository

    approval = approval_repository.create(
        db,
        document_id=document.id,
        reviewer_id=current_user.id,
        decision=decision,
        reason=reason,
    )
    document.status = decision
    db.commit()
    db.refresh(document)
    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.APPROVE if decision == "approved" else AuditAction.REJECT,
        document_id=document.id,
        details=f"{decision}: {reason or ''}",
    )
    return document
