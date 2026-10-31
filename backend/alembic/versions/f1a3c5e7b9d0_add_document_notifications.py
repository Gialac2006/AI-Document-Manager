"""Thêm thông báo cập nhật tài liệu được chia sẻ."""

from alembic import op
import sqlalchemy as sa


revision = "f1a3c5e7b9d0"
down_revision = "e9c2b4d6f8a0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "document_notifications",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "permission_id",
            sa.Integer(),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "before_version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "after_version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint(
            "permission_id",
            "after_version",
            name="uq_notification_permission_version",
        ),
    )

    op.create_index(
        "ix_document_notifications_permission_id",
        "document_notifications",
        ["permission_id"],
    )


def downgrade():
    op.drop_index(
        "ix_document_notifications_permission_id",
        table_name="document_notifications",
    )
    op.drop_table("document_notifications")