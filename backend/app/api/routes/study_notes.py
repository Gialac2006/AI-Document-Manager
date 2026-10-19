from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.document import Document
from app.models.study_note import StudyNote
from app.models.user import User
from app.schemas.study_note import (
    StudyNoteContent,
    StudyNoteCreate,
    StudyNoteRead,
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


@router.get("", response_model=list[StudyNoteRead])
def list_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.scalars(
        select(StudyNote)
        .where(StudyNote.user_id == user.id)
        .order_by(StudyNote.created_at.desc(), StudyNote.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()


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
    return note


@router.get("/{note_id}", response_model=StudyNoteRead)
def read_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_own_note(db, note_id, user.id)


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
    return note


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