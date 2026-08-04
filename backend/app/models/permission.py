from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_permission_doc_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    access_level: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="view"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    document: Mapped["Document"] = relationship(
        "Document", back_populates="permissions"
    )
