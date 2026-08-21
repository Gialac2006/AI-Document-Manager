"""Fix document status column default to pending

Revision ID: f2a4b6c8d0e1
Revises: e7b1c3d5f6a2
Create Date: 2026-08-19 01:00:00.000000

"""
# Sửa default của cột status: status giờ là trạng thái phê duyệt (pending/approved/rejected)
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a4b6c8d0e1"
down_revision: Union[str, Sequence[str], None] = "e7b1c3d5f6a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bất kỳ dòng nào còn giữ giá trị cũ (uploaded/processing/...) được coi là
    # tài liệu trước quy trình duyệt -> chuyển về approved để giữ nguyên khả năng xem
    op.execute(
        "UPDATE documents SET status = 'approved' "
        "WHERE status NOT IN ('pending', 'approved', 'rejected')"
    )
    op.alter_column(
        "documents",
        "status",
        server_default="pending",
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "documents",
        "status",
        server_default="uploaded",
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )