from fastapi import UploadFile

from app.core.exceptions import BadRequestError
from app.models.document import Document
from app.models.user import User
from app.repositories import document_repository, folder_repository
from app.services import storage_service
from app.services.extraction_service import TextExtractionError, extract_text
from app.services.scope_service import Scope, check_folder_scope
from app.utils.file_utils import get_file_extension, is_allowed_extension


def create_document(
    db,
    *,
    file: UploadFile,
    title: str,
    folder_id: int | None,
    current_user: User,
) -> Document:
    ext = get_file_extension(file.filename or "")
    if not is_allowed_extension(ext):
        raise BadRequestError("Định dạng file không được hỗ trợ")

    scope = Scope(current_user)
    organization_id = scope.organization_id
    owner_id = scope.owner_id

    if folder_id is not None:
        folder = check_folder_scope(
            folder_repository.get_by_id(db, folder_id), current_user
        )
        if organization_id is not None and folder.organization_id != organization_id:
            raise BadRequestError("Thư mục không thuộc tổ chức của bạn")

    title = title.strip()
    if not title:
        title = file.filename.rsplit(".", 1)[0] or "Chưa có tiêu đề"

    file_path = storage_service.save_file(file, owner_id=current_user.id)
    document = document_repository.create(
        db,
        title=title,
        file_path=file_path,
        file_name=file.filename or "untitled",
        file_type=ext,
        folder_id=folder_id,
        organization_id=organization_id,
        owner_id=owner_id,
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

    return document



def get_document(db, *, document_id: int, current_user: User) -> Document:
    from app.services.scope_service import check_document_scope

    document = document_repository.get_by_id(db, document_id)
    return check_document_scope(document, current_user)


def list_documents(
    db, *, current_user: User, folder_id: int | None = None
) -> list[Document]:
    scope = Scope(current_user)
    return document_repository.list_all(
        db,
        organization_id=scope.organization_id,
        owner_id=scope.owner_id,
        folder_id=folder_id,
    )


def update_document(
    db, *, document: Document, title: str, folder_id: int | None, current_user: User
) -> Document:
    if folder_id is not None:
        check_folder_scope(folder_repository.get_by_id(db, folder_id), current_user)
    return document_repository.update(
        db, document, title=title, folder_id=folder_id
    )


def delete_document(db, *, document: Document) -> None:
    storage_service.delete_file(document.file_path)
    document_repository.delete(db, document)