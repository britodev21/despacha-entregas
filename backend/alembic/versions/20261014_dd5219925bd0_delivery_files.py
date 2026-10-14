"""delivery files

Revision ID: dd5219925bd0
Revises: 131c64ec310e
Create Date: 2026-10-14 02:37:40.387262

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "dd5219925bd0"
down_revision: str | Sequence[str] | None = "131c64ec310e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "delivery_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("occurrence_id", sa.Uuid(), nullable=True),
        sa.Column(
            "kind",
            sa.Enum(
                "PROOF_PHOTO",
                "PROOF_SIGNATURE",
                "OCCURRENCE_PHOTO",
                name="filekind",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('PROOF_PHOTO', 'PROOF_SIGNATURE', 'OCCURRENCE_PHOTO')",
            name=op.f("ck_delivery_files_kind"),
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_delivery_files_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["delivery_id"],
            ["deliveries.id"],
            name=op.f("fk_delivery_files_delivery_id_deliveries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["occurrence_id"],
            ["delivery_occurrences.id"],
            name=op.f("fk_delivery_files_occurrence_id_delivery_occurrences"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            name=op.f("fk_delivery_files_uploaded_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_delivery_files")),
    )
    op.create_index(
        op.f("ix_delivery_files_company_id"), "delivery_files", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_delivery_files_delivery_id"), "delivery_files", ["delivery_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_delivery_files_delivery_id"), table_name="delivery_files")
    op.drop_index(op.f("ix_delivery_files_company_id"), table_name="delivery_files")
    op.drop_table("delivery_files")
