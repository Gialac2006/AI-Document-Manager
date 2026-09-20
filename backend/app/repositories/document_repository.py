from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.permission import Permission


# Lấy tài liệu theo ID
def get_by_id(db: Session, document_id: int) -> Document | None:
    return db.get(Document, document_id)


# Lấy danh sách tài liệu theo tổ chức, người dùng hoặc thư mục (có phân trang)
def list_all(
    db: Session,
    *,
    organization_id: int | None = None,
    owner_id: int | None = None,
    user_id: int | None = None,
    folder_id: int | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Document], int]:
    """Trả về (danh sách tài liệu, tổng số bản ghi).

    - Manager/super_admin (user_id=None): thấy toàn bộ tài liệu trong phạm vi tổ chức.
    - Staff (user_id + organization_id): thấy tài liệu của tổ chức mà mình là chủ,
      được chia sẻ, hoặc đã duyệt — KHÔNG thấy tài liệu tổ chức khác.
    - Individual (user_id + owner_id): thấy tài liệu mình tạo và được chia sẻ —
      KHÔNG thấy tài liệu approved của người khác.
    """
    query = select(Document)

    if user_id is not None:
        query = query.outerjoin(
            Permission,
            (Permission.document_id == Document.id)
            & (Permission.user_id == user_id),
        )
        if organization_id is not None:
            # Staff trong tổ chức: trong org VÀ (mình tạo, được share, hoặc đã duyệt)
            query = query.where(
                and_(
                    Document.organization_id == organization_id,
                    or_(
                        Document.owner_id == user_id,
                        Permission.id.isnot(None),
                        Document.status == "approved",
                    ),
                )
            )
        else:
            # Individual: chỉ tài liệu mình tạo hoặc được share
            query = query.where(
                or_(
                    Document.owner_id == user_id,
                    Permission.id.isnot(None),
                )
            )
    elif organization_id is not None:
        # Manager: toàn bộ org
        query = query.where(Document.organization_id == organization_id)
    elif owner_id is not None:
        # Managerish by owner (fallback)
        query = query.where(Document.owner_id == owner_id)
    # else: super_admin — không filter

    if folder_id is not None:
        query = query.where(Document.folder_id == folder_id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    query = (
        query.order_by(Document.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(query).all()), total


# Tạo tài liệu mới
def create(
    db: Session,
    *,
    title: str,
    file_path: str,
    file_name: str,
    file_type: str | None,
    folder_id: int | None,
    organization_id: int | None,
    owner_id: int | None,
    status: str = "pending",
    processing_status: str = "uploaded",
) -> Document:
    document = Document(
        title=title,
        file_path=file_path,
        file_name=file_name,
        file_type=file_type,
        folder_id=folder_id,
        organization_id=organization_id,
        owner_id=owner_id,
        status=status,
        processing_status=processing_status,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


# Cập nhật tiêu đề và thư mục của tài liệu
def update(
    db: Session, document: Document, *, title: str | None, folder_id: int | None
) -> Document:
    if title is not None:
        document.title = title
    if folder_id is not None:
        document.folder_id = folder_id
    db.commit()
    db.refresh(document)
    return document


# Cập nhật file mới và số phiên bản của tài liệu
def update_file(
    db: Session,
    document: Document,
    *,
    file_path: str,
    file_name: str,
    file_type: str,
    current_version: int,
) -> Document:
    document.file_path = file_path
    document.file_name = file_name
    document.file_type = file_type
    document.current_version = current_version
    db.commit()
    db.refresh(document)
    return document


# Cập nhật loại tài liệu do AI gán
def update_category(db: Session, document: Document, *, category: str) -> Document:
    document.category = category
    db.commit()
    db.refresh(document)
    return document


# Xóa tài liệu
def delete(db: Session, document: Document) -> None:
    db.delete(document)
    db.commit()


# Lấy danh sách các phiên bản của tài liệu
def list_versions(db: Session, document_id: int) -> list[DocumentVersion]:
    query = (
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version.desc())
    )
    return list(db.scalars(query).all())


# Lấy một phiên bản cụ thể của tài liệu
def get_version(
    db: Session, document_id: int, version: int
) -> DocumentVersion | None:
    return db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version == version,
        )
    )


# Tính số phiên bản tiếp theo của tài liệu
def next_version(db: Session, document_id: int) -> int:
    current = db.scalar(
        select(func.max(DocumentVersion.version)).where(
            DocumentVersion.document_id == document_id
        )
    )
    return (current or 0) + 1


# Tạo phiên bản mới cho tài liệu
def create_version(
    db: Session,
    *,
    document_id: int,
    version: int,
    file_path: str,
    file_name: str,
    created_by: int,
) -> DocumentVersion:
    record = DocumentVersion(
        document_id=document_id,
        version=version,
        file_path=file_path,
        file_name=file_name,
        created_by=created_by,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

# Cập nhật trạng thái xử lý và kết quả trích xuất của tài liệu
def update_processing(
    db: Session,
    document: Document,
    *,
    processing_status: str,
    extracted_text: str | None = None,
    processing_error: str | None = None,
) -> Document:
    """
    Cập nhật trạng thái xử lý AI và kết quả trích xuất của một tài liệu.

    Chỉ ghi vào cột processing_status, không đụng tới status (phê duyệt).
    """

    # QUAN TRỌNG: Trạng thái hiện tại của quá trình xử lý
    document.processing_status = processing_status

    # QUAN TRỌNG: Toàn bộ văn bản lấy được từ PDF hoặc OCR
    document.extracted_text = extracted_text

    # Nếu thành công thì giá trị này là None; nếu thất bại thì chứa lý do
    document.processing_error = processing_error

    # QUAN TRỌNG: Ghi các thay đổi thật sự xuống PostgreSQL
    db.commit()

    # Đọc lại dữ liệu mới nhất từ PostgreSQL vào đối tượng document
    db.refresh(document)

    return document
