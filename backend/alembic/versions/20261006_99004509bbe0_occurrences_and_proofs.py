"""occurrences and proofs

Revision ID: 99004509bbe0
Revises: bad6cc5137b4
Create Date: 2026-10-06 21:06:47.770834

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "99004509bbe0"
down_revision: str | Sequence[str] | None = "bad6cc5137b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "delivery_occurrences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("reported_by", sa.Uuid(), nullable=True),
        sa.Column(
            "type",
            sa.Enum(
                "CUSTOMER_ABSENT",
                "WRONG_ADDRESS",
                "REFUSED",
                "ACCESS_PROBLEM",
                "DAMAGED_PRODUCT",
                "DELIVERY_PROBLEM",
                "OTHER",
                name="occurrencetype",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "type IN ('CUSTOMER_ABSENT', 'WRONG_ADDRESS', 'REFUSED', 'ACCESS_PROBLEM', 'DAMAGED_PRODUCT', 'DELIVERY_PROBLEM', 'OTHER')",
            name=op.f("ck_delivery_occurrences_type"),
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_delivery_occurrences_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["delivery_id"],
            ["deliveries.id"],
            name=op.f("fk_delivery_occurrences_delivery_id_deliveries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reported_by"],
            ["users.id"],
            name=op.f("fk_delivery_occurrences_reported_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_delivery_occurrences")),
    )
    op.create_index(
        op.f("ix_delivery_occurrences_company_id"),
        "delivery_occurrences",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_delivery_occurrences_delivery_id"),
        "delivery_occurrences",
        ["delivery_id"],
        unique=False,
    )
    op.create_table(
        "delivery_proofs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("received_by_name", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_delivery_proofs_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_delivery_proofs_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["delivery_id"],
            ["deliveries.id"],
            name=op.f("fk_delivery_proofs_delivery_id_deliveries"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_delivery_proofs")),
        sa.UniqueConstraint("delivery_id", name=op.f("uq_delivery_proofs_delivery_id")),
    )
    op.create_index(
        op.f("ix_delivery_proofs_company_id"), "delivery_proofs", ["company_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_delivery_proofs_company_id"), table_name="delivery_proofs")
    op.drop_table("delivery_proofs")
    op.drop_index(op.f("ix_delivery_occurrences_delivery_id"), table_name="delivery_occurrences")
    op.drop_index(op.f("ix_delivery_occurrences_company_id"), table_name="delivery_occurrences")
    op.drop_table("delivery_occurrences")
