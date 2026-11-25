"""Thêm ảnh đính kèm cho tin nhắn chat."""

from alembic import op
import sqlalchemy as sa


revision = "f3b5d7e9a1c2"
down_revision = "f1a3c5e7b9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_attachments",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "filename",
            sa.String(180),
            nullable=False,
        ),
        sa.Column(
            "storage_key",
            sa.String(64),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "content_type",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "byte_size",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_chat_attachments_message_id",
        "chat_attachments",
        ["message_id"],
    )


def downgrade():
    op.drop_index(
        "ix_chat_attachments_message_id",
        table_name="chat_attachments",
    )
    op.drop_table("chat_attachments")