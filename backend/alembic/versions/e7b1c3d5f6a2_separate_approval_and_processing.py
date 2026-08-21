"""Separate approval status from processing status

Revision ID: e7b1c3d5f6a2
Revises: df4a0b2c5e9f
Create Date: 2026-08-19 00:00:00.000000

"""
# Tách trạng thái phê duyệt và trạng thái xử lý AI thành hai cột riêng
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7b1c3d5f6a2"
down_revision: Union[str, Sequence[str], None] = "df4a0b2c5e9f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Thêm cột processing_status lưu trạng thái xử lý AI
    op.add_column(
        "documents",
        sa.Column(
            "processing_status",
            sa.String(length=50),
            nullable=False,
            server_default="uploaded",
        ),
    )

    # Di chuyển dữ liệu cũ: trạng thái xử lý chuyển sang processing_status,
    # cột status chỉ còn giữ trạng thái phê duyệt (mặc định approved cho dữ liệu cũ)
    op.execute(
        "UPDATE documents SET processing_status = status "
        "WHERE status IN ('uploaded', 'processing', 'text_extracted', 'failed', 'completed', 'indexed')"
    )
    op.execute(
        "UPDATE documents SET status = 'approved' "
        "WHERE status IN ('uploaded', 'processing', 'text_extracted', 'failed', 'completed', 'indexed')"
    )


def downgrade() -> None:
    # Ghép lại trạng thái cũ cho dữ liệu chưa được phê duyệt xử lý
    op.execute(
        "UPDATE documents SET status = processing_status "
        "WHERE status = 'approved' AND processing_status <> 'uploaded'"
    )
    op.drop_column("documents", "processing_status")