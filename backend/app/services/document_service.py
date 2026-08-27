from fastapi import UploadFile

from app.core.exceptions import BadRequestError, ForbiddenError
from app.models.document import Document
from app.models.user import User
from app.repositories import document_repository, folder_repository
from app.services import storage_service
from app.services.audit_service import AuditAction, log_document
from app.services.extraction_service import extract_text
from app.services.scope_service import AccessLevel, Scope, check_folder_scope
from app.services.vector_service import index_document
from app.utils.file_utils import (
    get_file_extension,
    is_allowed_extension,
    validate_file_header,
)


# Xác định quyền truy cập hiệu lực của user với tài liệu
_MISSING = object()


def _resolve_access_for(
    db, document: Document, current_user: User, perm: object = _MISSING
) -> str:
    """Trả về access_level hiệu lực (view/edit/manage) của user với document."""
    from app.models.user import UserRole
    from app.repositories.permission_repository import get as get_permission

    if current_user.role == UserRole.SUPER_ADMIN:
        return "manage"
    same_org = (
        current_user.organization_id is not None
        and current_user.organization_id == document.organization_id
    )
    if current_user.role == UserRole.MANAGER and same_org:
        return "manage"
    if (
        current_user.role == UserRole.INDIVIDUAL
        and current_user.id == document.owner_id
    ):
        return "manage"
    # Cho phép truyền sẵn permission đã load hàng loạt để tránh truy vấn N+1
    if perm is _MISSING:
        perm = get_permission(db, document.id, current_user.id)
    if perm:
        return "manage" if perm.access_level == "admin" else perm.access_level
    if current_user.role == UserRole.STAFF and same_org:
        return "edit"
    return "view"


# Kiểm tra định dạng và nội dung file tải lên
def _validated_file(file: UploadFile):
    ext = get_file_extension(file.filename or "")
    if not is_allowed_extension(ext):
        raise BadRequestError("Định dạng file không được hỗ trợ")
    header = file.file.read(8)
    file.file.seek(0)
    if not validate_file_header(ext, header):
        raise BadRequestError("File không khớp với phần mở rộng (kiểm tra nội dung)")


# Trích xuất văn bản từ file đã lưu và cập nhật trạng thái xử lý
def _run_text_extraction(db, document: Document, file_path: str) -> Document:
    """
    Trích xuất text rồi tự động index tài liệu vào Qdrant.
    """
    document = document_repository.update_processing(
        db,
        document,
        processing_status="processing",
    )

    try:
        # Lấy đường dẫn đầy đủ của file
        full_path = storage_service.get_full_path(file_path)

        # Bước 1: Extract text / OCR
        extracted_text = extract_text(full_path)

        # Lưu text vào PostgreSQL
        document = document_repository.update_processing(
            db,
            document,
            processing_status="text_extracted",
            extracted_text=extracted_text,
        )

        # Bước 2 + 3 + 4:
        # chunk → embedding → lưu Qdrant
        index_document(document)

        # Đánh dấu toàn bộ pipeline đã chạy xong
        document = document_repository.update_processing(
            db,
            document,
            processing_status="indexed",
            extracted_text=document.extracted_text,
        )

    except Exception as error:
        # Nếu một bước bị lỗi thì giữ lại text đã extract được
        document = document_repository.update_processing(
            db,
            document,
            processing_status="failed",
            extracted_text=document.extracted_text,
            processing_error=str(error),
        )

    return document


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
            required=AccessLevel.VIEW,
            db=db,
        )
        if organization_id is not None and folder.organization_id != organization_id:
            raise BadRequestError("Thư mục không thuộc tổ chức của bạn")

    title = title.strip()
    if not title:
        title = file.filename.rsplit(".", 1)[0] or "Chưa có tiêu đề"

    file_path = storage_service.save_file(file, owner_id=current_user.id)
    # Staff upload → chờ duyệt; manager/super_admin/individual → đã duyệt ngay
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
        processing_status="uploaded",
    )
    document_repository.create_version(
        db,
        document_id=document.id,
        version=1,
        file_path=file_path,
        file_name=document.file_name,
        created_by=current_user.id,
    )

    # Xử lý AI: trích xuất text, không đè trạng thái phê duyệt
    document = _run_text_extraction(db, document, file_path)

    log_document(
        db,
        user_id=current_user.id,
        action=AuditAction.CREATE,
        document_id=document.id,
        details=document.title,
    )
    document.access_level = _resolve_access_for(db, document, current_user)
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
    # Nội dung mới do staff đưa lên phải được duyệt lại
    if current_user.role == "staff" and document.status != "pending":
        document.status = "pending"
        db.commit()
        db.refresh(document)
    # Phiên bản mới có nội dung khác → trích xuất lại văn bản
    document = _run_text_extraction(db, document, file_path)
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
    return document


# Lấy danh sách tài liệu trong phạm vi quyền của user (có phân trang)
def list_documents(
    db,
    *,
    current_user: User,
    folder_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Document], int]:
    from app.models.user import UserRole
    from app.repositories.permission_repository import list_for_user_documents

    scope = Scope(current_user)
    # Chỉ staff/individual cần lọc theo quyền chia sẻ; manager xem mọi thứ trong tổ chức
    needs_visibility_filter = current_user.role in (
        UserRole.STAFF,
        UserRole.INDIVIDUAL,
    )
    documents, total = document_repository.list_all(
        db,
        organization_id=scope.organization_id,
        owner_id=scope.owner_id,
        user_id=current_user.id if needs_visibility_filter else None,
        folder_id=folder_id,
        offset=(page - 1) * page_size,
        limit=page_size,
    )
    # Load permission hàng loạt để tránh truy vấn N+1
    perm_map = (
        list_for_user_documents(db, current_user.id, [d.id for d in documents])
        if documents
        else {}
    )
    for doc in documents:
        doc.access_level = _resolve_access_for(
            db, doc, current_user, perm_map.get(doc.id)
        )
    return documents, total


# Cập nhật tiêu đề và thư mục của tài liệu
def update_document(
    db, *, document: Document, title: str, folder_id: int | None, current_user: User
) -> Document:
    if folder_id is not None:
        check_folder_scope(
            folder_repository.get_by_id(db, folder_id),
            current_user,
            required=AccessLevel.VIEW,
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

    # Chỉ phê duyệt được tài liệu đang ở trạng thái chờ duyệt
    if document.status != "pending":
        raise BadRequestError(
            "Chỉ tài liệu đang chờ duyệt mới có thể phê duyệt hoặc từ chối"
        )

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
    document.access_level = _resolve_access_for(db, document, current_user)
    return document

