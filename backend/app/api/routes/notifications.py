import hashlib
import json

from pydantic import BaseModel, Field

from app.models.document_version import DocumentVersion
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.document import Document
from app.models.document_notification import DocumentNotification
from app.models.permission import Permission
from app.models.user import User
from app.services.document_service import get_document


router = APIRouter(prefix="/notifications", tags=["notifications"])


def own_notifications(user_id: int):
    return (
        select(
            DocumentNotification,
            Permission.document_id,
            Document.title,
        )
        .join(
            Permission,
            Permission.id == DocumentNotification.permission_id,
        )
        .join(Document, Document.id == Permission.document_id)
        .where(
            Permission.user_id == user_id,
            Permission.access_level.in_(["view", "edit", "admin"]),
        )
    )


@router.get("")
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_id: int | None = Query(None, ge=1),
    unreviewed_only: bool = False,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = own_notifications(user.id)
    if document_id is not None:
        query = query.where(Permission.document_id == document_id)

    if unreviewed_only:
        query = query.where(
            DocumentNotification.reviewed_at.is_(None)
        )

    if unread_only:
        query = query.where(DocumentNotification.read_at.is_(None))

    rows = db.execute(
        query
        .order_by(
            DocumentNotification.created_at.desc(),
            DocumentNotification.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return [
        {
            "id": notification.id,
            "document_id": document_id,
            "document_title": title,
            "before_version": notification.before_version,
            "after_version": notification.after_version,
            "created_at": notification.created_at,
            "read_at": notification.read_at,
            "reviewed_at": notification.reviewed_at,
        }
        for notification, document_id, title in rows
    ]


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.execute(
        own_notifications(user.id).where(
            DocumentNotification.id == notification_id
        )
    ).first()

    if row is None:
        raise HTTPException(404, "Không tìm thấy thông báo")

    notification, document_id, _ = row

    get_document(
        db,
        document_id=document_id,
        current_user=user,
    )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Giữ thời điểm đọc lần đầu khi bấm nhiều lần.
    result = db.execute(
        update(DocumentNotification)
        .where(DocumentNotification.id == notification.id)
        .values(
            read_at=func.coalesce(DocumentNotification.read_at, now)
        )
        .returning(
            DocumentNotification.id,
            DocumentNotification.read_at,
            DocumentNotification.reviewed_at,
        )
    ).mappings().first()

    if result is None:
        raise HTTPException(404, "Thông báo không còn tồn tại")

    response = dict(result)
    db.commit()
    return response
class NotificationReviewRequest(BaseModel):
    expected_after_version: int = Field(ge=1)
    comparison_token: str = Field(
        min_length=64,
        max_length=64,
    )


def get_notification_comparison(
    db: Session,
    *,
    notification_id: int,
    user: User,
    lock: bool = False,
):
    query = own_notifications(user.id).where(
        DocumentNotification.id == notification_id
    )

    if lock:
        # Giữ quyền chia sẻ và thông báo ổn định khi xác nhận.
        query = query.with_for_update(
            of=[Permission, DocumentNotification]
        ).execution_options(populate_existing=True)

    row = db.execute(query).first()

    if row is None:
        raise HTTPException(404, "Không tìm thấy thông báo")

    notification, document_id, title = row

    document = get_document(
        db,
        document_id=document_id,
        current_user=user,
    )

    versions = db.scalars(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version.in_(
                [
                    notification.before_version,
                    notification.after_version,
                ]
            ),
        )
    ).all()

    by_version = {version.version: version for version in versions}

    before = by_version.get(notification.before_version)
    after = by_version.get(notification.after_version)

    if before is None or after is None:
        raise HTTPException(
            404,
            "Không tìm thấy phiên bản cần đối chiếu",
        )

    if before.extracted_text is None or after.extracted_text is None:
        raise HTTPException(
            409,
            "Một trong hai phiên bản chưa có văn bản được lưu "
            "nên chưa thể đối chiếu.",
        )

    before_text = before.extracted_text
    after_text = after.extracted_text

    if max(len(before_text), len(after_text)) > 1_000_000:
        raise HTTPException(
            400,
            "Bản đầu hỗ trợ tối đa 1 triệu ký tự mỗi phiên bản.",
        )

    # Token gắn với thông báo, hai phiên bản và cả hai nội dung.
    token_data = json.dumps(
        [
            notification.id,
            document_id,
            before.version,
            after.version,
            before_text,
            after_text,
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )

    token = hashlib.sha256(
        token_data.encode("utf-8")
    ).hexdigest()

    comparison = {
        "notification_id": notification.id,
        "document_id": document_id,
        "document_title": title,
        "before_version": before.version,
        "after_version": after.version,
        "current_version": document.current_version,
        "before_text": before_text,
        "after_text": after_text,
        "comparison_token": token,
        "read_at": notification.read_at,
        "reviewed_at": notification.reviewed_at,
    }

    return notification, comparison


@router.get("/{notification_id}/comparison")
def compare_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _, comparison = get_notification_comparison(
        db,
        notification_id=notification_id,
        user=user,
    )

    return comparison


@router.post("/{notification_id}/review")
def confirm_notification_review(
    notification_id: int,
    data: NotificationReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification, comparison = get_notification_comparison(
        db,
        notification_id=notification_id,
        user=user,
        lock=True,
    )

    if (
        data.expected_after_version != comparison["after_version"]
        or data.comparison_token != comparison["comparison_token"]
    ):
        raise HTTPException(
            409,
            "Dữ liệu đối chiếu không khớp. "
            "Hãy mở lại phần đối chiếu trước khi xác nhận.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Giữ thời điểm xác nhận lần đầu nếu bấm lại.
    if notification.read_at is None:
        notification.read_at = now

    if notification.reviewed_at is None:
        notification.reviewed_at = now

    db.flush()

    result = {
        "id": notification.id,
        "after_version": notification.after_version,
        "read_at": notification.read_at,
        "reviewed_at": notification.reviewed_at,
    }

    db.commit()
    return result


@router.get("/document-changes")
def document_change_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(
            Permission.document_id,
            func.count(DocumentNotification.id).label("total_count"),
            func.count(DocumentNotification.id)
            .filter(DocumentNotification.reviewed_at.is_(None))
            .label("pending_count"),
        )
        .select_from(DocumentNotification)
        .join(
            Permission,
            Permission.id == DocumentNotification.permission_id,
        )
        .join(Document, Document.id == Permission.document_id)
        .where(
            Permission.user_id == user.id,
            Permission.access_level.in_(["view", "edit", "admin"]),
        )
        .group_by(Permission.document_id)
    ).mappings().all()

    return [dict(row) for row in rows]