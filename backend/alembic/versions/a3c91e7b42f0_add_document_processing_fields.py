"""Add document processing fields

Revision ID: a3c91e7b42f0
Revises: f8f6983d397d
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Mã định danh của migration hiện tại
revision: str = "a3c91e7b42f0"

# Migration này phải chạy sau phiên bản hiện tại của database
down_revision: Union[str, None] = "f8f6983d397d"

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Thêm hai cột phục vụ quá trình xử lý tài liệu."""

    # Lưu toàn bộ văn bản trích xuất từ PDF, DOCX hoặc OCR
    op.add_column(
        "documents",
        sa.Column("extracted_text", sa.Text(), nullable=True),
    )

    # Lưu nội dung lỗi nếu quá trình xử lý tài liệu thất bại
    op.add_column(
        "documents",
        sa.Column("processing_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Hoàn tác migration nếu cần quay lại phiên bản trước."""

    # Xoá theo thứ tự ngược lại với upgrade
    op.drop_column("documents", "processing_error")
    op.drop_column("documents", "extracted_text")