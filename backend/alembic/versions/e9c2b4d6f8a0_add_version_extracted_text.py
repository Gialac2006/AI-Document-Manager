"""Lưu văn bản trích xuất theo từng phiên bản tài liệu."""

from alembic import op
import sqlalchemy as sa


revision = "e9c2b4d6f8a0"
down_revision = "d4e6f8a0b2c4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "document_versions",
        sa.Column("extracted_text", sa.Text(), nullable=True),
    )

    # Chỉ bổ sung văn bản cho phiên bản hiện tại đã xử lý thành công.
    # Không gán nội dung hiện tại cho các phiên bản lịch sử.
    op.execute(
        """
        UPDATE document_versions AS version
        SET extracted_text = document.extracted_text
        FROM documents AS document
        WHERE version.document_id = document.id
          AND version.version = document.current_version
          AND version.file_path = document.file_path
          AND document.processing_status IN ('text_extracted', 'indexed')
          AND document.extracted_text IS NOT NULL
          AND btrim(document.extracted_text) <> ''
        """
    )


def downgrade():
    op.drop_column("document_versions", "extracted_text")