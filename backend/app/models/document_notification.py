from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DocumentNotification(Base):
    __tablename__ = "document_notifications"
    __table_args__ = (
        UniqueConstraint(
            "permission_id",
            "after_version",
            name="uq_notification_permission_version",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Quyền chia sẻ xác định cả tài liệu và người nhận.
    # Thu hồi quyền sẽ xóa các thông báo gắn với quyền đó.
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    before_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    after_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    # Mở thông báo không đồng nghĩa đã đối chiếu.
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )