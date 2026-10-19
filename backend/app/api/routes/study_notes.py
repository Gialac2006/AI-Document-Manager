from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
import unicodedata
import hashlib

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.document import Document
from app.models.study_note import StudyNote
from app.models.user import User
from app.schemas.study_note import (
    StudyNoteContent,
    StudyNoteCreate,
    StudyNoteRead,
    StudyNoteComparison,
    StudyNoteReview,
)
from app.services.document_service import get_document


router = APIRouter(prefix="/study-notes", tags=["study-notes"])



def get_own_note(db: Session, note_id: int, user_id: int):
    note = db.scalar(
        select(StudyNote).where(
            StudyNote.id == note_id,
            StudyNote.user_id == user_id,
        )
    )
    if note is None:
        raise HTTPException(404, "Không tìm thấy ghi chú")
    return note



def normalize_source(text: str) -> str:
    # Bỏ khác biệt về khoảng trắng và cách biểu diễn Unicode.
    # Vẫn giữ khác biệt về chữ, số, dấu câu và chữ hoa/thường.
    return " ".join(unicodedata.normalize("NFC", text).split())



def describe_note(db: Session, note: StudyNote, user: User):
    # Lấy các trường ghi chú theo schema hiện có.
    result = StudyNoteRead.model_validate(note).model_dump()

    # Mặc định chưa thể truy cập nguồn.
    # Chỉ trả ID nguồn khi kiểm tra quyền thành công.
    result["document_id"] = None
    result["current_version"] = None
    result["source_status"] = "source_unavailable"

    if note.document_id is None:
        return result

    try:
        # Dùng lại kiểm tra quyền của dự án.
        document = get_document(
            db,
            document_id=note.document_id,
            current_user=user,
        )
    except HTTPException as exc:
        if exc.status_code in (403, 404):
            return result
        # Không che các lỗi khác của hệ thống.
        raise

    result["document_id"] = document.id
    result["current_version"] = document.current_version

    current_text = document.extracted_text or ""

    if (
        document.processing_status not in ("text_extracted", "indexed")
        or not current_text.strip()
    ):
        result["source_status"] = "source_processing"
        return result

    # So sánh với nguồn ở lần xác nhận gần nhất.
    if normalize_source(note.reviewed_text) == normalize_source(current_text):
        result["source_status"] = "up_to_date"
    else:
        result["source_status"] = "needs_review"

    return result


@router.get("", response_model=list[StudyNoteRead])
def list_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notes = db.scalars(
        select(StudyNote)
        .where(StudyNote.user_id == user.id)
        .order_by(StudyNote.created_at.desc(), StudyNote.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return [describe_note(db, note, user) for note in notes]



@router.post("", response_model=StudyNoteRead, status_code=201)
def create_note(
    data: StudyNoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Giữ phiên bản nguồn ổn định trong lúc lưu.
    db.scalar(
        select(Document)
        .where(Document.id == data.document_id)
        .with_for_update()
    )

    document = get_document(
        db,
        document_id=data.document_id,
        current_user=user,
    )

    if document.current_version != data.source_version:
        raise HTTPException(
            409,
            "Tài liệu vừa thay đổi. Hãy tải lại trước khi lưu ghi chú.",
        )

    if document.processing_status not in ("text_extracted", "indexed"):
        raise HTTPException(400, "Tài liệu chưa xử lý xong")

    source_text = document.extracted_text or ""

    if not source_text.strip():
        raise HTTPException(400, "Tài liệu chưa có nội dung văn bản")

    if len(source_text) > 1_000_000:
        raise HTTPException(
            400,
            "Tài liệu quá dài. Bản đầu hỗ trợ tối đa 1 triệu ký tự.",
        )

    note = StudyNote(
        user_id=user.id,
        document_id=document.id,
        title=data.title,
        content=data.content,
        source_version=document.current_version,
        source_text=source_text,
        reviewed_version=document.current_version,
        reviewed_text=source_text,
    )

    db.add(note)
    db.commit()
    db.refresh(note)
    return describe_note(db, note, user)



@router.get("/{note_id}", response_model=StudyNoteRead)
def read_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = get_own_note(db, note_id, user.id)
    return describe_note(db, note, user)



@router.patch("/{note_id}", response_model=StudyNoteRead)
def update_note(
    note_id: int,
    data: StudyNoteContent,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = get_own_note(db, note_id, user.id)
    note.title = data.title
    note.content = data.content

    # Sửa ghi chú không đồng nghĩa đã xem lại nguồn mới.
    db.commit()
    db.refresh(note)
    return describe_note(db, note, user)




@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = get_own_note(db, note_id, user.id)
    db.delete(note)
    db.commit()
    return Response(status_code=204)



def get_reviewable_text(document: Document) -> str:
    if document.processing_status not in ("text_extracted", "indexed"):
        raise HTTPException(400, "Tài liệu chưa xử lý xong")

    text = document.extracted_text or ""

    if not text.strip():
        raise HTTPException(400, "Tài liệu chưa có nội dung văn bản")

    if len(text) > 1_000_000:
        raise HTTPException(
            400,
            "Bản đầu hỗ trợ đối chiếu tối đa 1 triệu ký tự.",
        )

    return text


def make_source_token(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@router.get(
    "/{note_id}/comparison",
    response_model=StudyNoteComparison,
)
def compare_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = get_own_note(db, note_id, user.id)

    if note.document_id is None:
        raise HTTPException(404, "Tài liệu nguồn đã bị xóa")

    # Kiểm tra quyền trước khi trả nội dung nguồn.
    document = get_document(
        db,
        document_id=note.document_id,
        current_user=user,
    )
    current_text = get_reviewable_text(document)

    return {
        "before_version": note.reviewed_version,
        "current_version": document.current_version,
        "before_text": note.reviewed_text,
        "after_text": current_text,
        "source_token": make_source_token(current_text),
    }


@router.post(
    "/{note_id}/review",
    response_model=StudyNoteRead,
)
def confirm_note_review(
    note_id: int,
    data: StudyNoteReview,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Khóa ghi chú trong lúc cập nhật mốc đã xem lại.
    note = db.scalar(
        select(StudyNote)
        .where(
            StudyNote.id == note_id,
            StudyNote.user_id == user.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if note is None:
        raise HTTPException(404, "Không tìm thấy ghi chú")

    if note.document_id is None:
        raise HTTPException(404, "Tài liệu nguồn đã bị xóa")

    # Giữ nguồn ổn định trong lúc kiểm tra và xác nhận.
    document = db.scalar(
        select(Document)
        .where(Document.id == note.document_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if document is None:
        raise HTTPException(404, "Tài liệu nguồn đã bị xóa")

    document = get_document(
        db,
        document_id=note.document_id,
        current_user=user,
    )
    current_text = get_reviewable_text(document)

    if (
        document.current_version != data.expected_version
        or make_source_token(current_text) != data.source_token
    ):
        raise HTTPException(
            409,
            "Nguồn vừa thay đổi. Hãy đóng phần đối chiếu rồi mở lại "
            "để xem nội dung mới nhất trước khi xác nhận.",
        )

    # Chỉ cập nhật mốc đã xem lại.
    # Giữ nguyên source_version, source_text và nội dung ghi chú.
    note.reviewed_version = document.current_version
    note.reviewed_text = current_text

    db.flush()

    # Chuẩn bị và kiểm tra kết quả trước khi commit.
    result = StudyNoteRead.model_validate(
        describe_note(db, note, user)
    )

    db.commit()
    return result