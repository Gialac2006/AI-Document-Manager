"""Create study notes."""

from alembic import op
import sqlalchemy as sa


revision = "d4e6f8a0b2c4"
down_revision = "7e60b5f3ae5a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "study_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("reviewed_version", sa.Integer(), nullable=False),
        sa.Column("reviewed_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_study_notes_user_id", "study_notes", ["user_id"]
    )
    op.create_index(
        "ix_study_notes_document_id", "study_notes", ["document_id"]
    )


def downgrade():
    op.drop_table("study_notes")