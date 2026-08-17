from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document_approval import DocumentApproval


# Tạo bản ghi phê duyệt mới
def create(
    db: Session,
    *,
    document_id: int,
    reviewer_id: int,
    decision: str,
    reason: str | None = None,
) -> DocumentApproval:
    approval = DocumentApproval(
        document_id=document_id,
        reviewer_id=reviewer_id,
        decision=decision,
        reason=reason,
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


# Lấy danh sách phê duyệt của một tài liệu
def list_for_document(db: Session, document_id: int) -> list[DocumentApproval]:
    return list(
        db.scalars(
            select(DocumentApproval)
            .where(DocumentApproval.document_id == document_id)
            .order_by(DocumentApproval.created_at.desc())
        ).all()
    )