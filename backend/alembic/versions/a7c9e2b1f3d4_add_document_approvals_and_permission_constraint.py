"""add document_approvals and permission access_level constraint

Revision ID: a7c9e2b1f3d4
Revises: f8f6983d397d
Create Date: 2026-08-10 12:00:00.000000

"""
# Migration tạo bảng document_approvals và ràng buộc access_level cho permissions
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c9e2b1f3d4'
down_revision: Union[str, Sequence[str], None] = 'f8f6983d397d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('document_approvals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('document_id', sa.Integer(), nullable=False),
    sa.Column('reviewer_id', sa.Integer(), nullable=False),
    sa.Column('decision', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_document_approvals_id'), 'document_approvals', ['id'], unique=False)
    op.create_index(op.f('ix_document_approvals_document_id'), 'document_approvals', ['document_id'], unique=False)
    op.create_index(op.f('ix_document_approvals_reviewer_id'), 'document_approvals', ['reviewer_id'], unique=False)
    op.create_check_constraint(
        'ck_permissions_access_level',
        'permissions',
        "access_level IN ('view', 'edit', 'admin')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_permissions_access_level', 'permissions', type_='check')
    op.drop_index(op.f('ix_document_approvals_reviewer_id'), table_name='document_approvals')
    op.drop_index(op.f('ix_document_approvals_document_id'), table_name='document_approvals')
    op.drop_index(op.f('ix_document_approvals_id'), table_name='document_approvals')
    op.drop_table('document_approvals')