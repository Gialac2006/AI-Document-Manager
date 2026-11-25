from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ChatAttachment(Base):
    __tablename__ = "chat_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    message_id: Mapped[int] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename: Mapped[str] = mapped_column(String(180), nullable=False)

    storage_key: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
    )

    content_type: Mapped[str] = mapped_column(String(50), nullable=False)

    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )

    message: Mapped["ChatMessage"] = relationship(
        "ChatMessage",
        back_populates="attachments",
    )