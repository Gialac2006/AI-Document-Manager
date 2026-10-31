from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models.document_notification import DocumentNotification
from app.models.document_version import DocumentVersion
from app.models.permission import Permission


def create_version_notifications(db, *, version: DocumentVersion):
    # Phiên bản đầu tiên chưa có bản trước để đối chiếu.
    if version.version <= 1:
        return

    if not (version.extracted_text or "").strip():
        return

    query = (
        select(Permission)
        .where(
            Permission.document_id == version.document_id,
            Permission.access_level.in_(["view", "edit", "admin"]),
            # Chỉ gửi cho người đã được chia sẻ khi phiên bản được tạo.
            Permission.created_at <= version.created_at,
        )
        .order_by(Permission.id)
        .with_for_update(read=True, key_share=True)
    )

    permissions = db.scalars(query).all()

    rows = [
        {
            "permission_id": permission.id,
            "before_version": version.version - 1,
            "after_version": version.version,
        }
        for permission in permissions
        if permission.user_id != version.created_by
    ]

    if not rows:
        return

    # Chạy lại cũng không tạo thông báo trùng.
    db.execute(
        insert(DocumentNotification)
        .values(rows)
        .on_conflict_do_nothing(
            constraint="uq_notification_permission_version"
        )
    )

    # Không commit ở đây.
    # Nội dung phiên bản và thông báo sẽ được lưu cùng giao dịch.