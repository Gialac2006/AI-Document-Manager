"""merge approval/permission branch and document processing fields branch

Revision ID: df4a0b2c5e9f
Revises: a7c9e2b1f3d4, a3c91e7b42f0
Create Date: 2026-08-13 00:00:00.000000

"""
# Migration gộp hai nhánh approvals và document processing
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "df4a0b2c5e9f"
down_revision: Union[str, Sequence[str], None] = ("a7c9e2b1f3d4", "a3c91e7b42f0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
