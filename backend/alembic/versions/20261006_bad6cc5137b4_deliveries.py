"""deliveries

Revision ID: bad6cc5137b4
Revises: ea03f8f497d3
Create Date: 2026-10-06 20:38:24.257864

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "bad6cc5137b4"
down_revision: str | Sequence[str] | None = "ea03f8f497d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("client_address_id", sa.Uuid(), nullable=True),
        sa.Column("recipient_name", sa.String(length=120), nullable=False),
        sa.Column("recipient_phone", sa.String(length=15), nullable=True),
        sa.Column("zip_code", sa.String(length=8), nullable=True),
        sa.Column("street", sa.String(length=160), nullable=False),
        sa.Column("address_number", sa.String(length=20), nullable=False),
        sa.Column("complement", sa.String(length=80), nullable=True),
        sa.Column("neighborhood", sa.String(length=80), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("order_amount", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "payment_method",
            sa.Enum(
                "CASH",
                "PIX",
                "CREDIT_CARD",
                "DEBIT_CARD",
                "PREPAID",
                "OTHER",
                name="payment_method",
                native_enum=False,
                create_constraint=False,  # constraint declarada abaixo, uma única vez
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("change_for", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("delivery_fee", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("expected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ASSIGNED",
                "IN_ROUTE",
                "DELIVERED",
                "CANCELED",
                "ISSUE",
                name="status",
                native_enum=False,
                create_constraint=False,  # constraint declarada abaixo, uma única vez
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("deliverer_id", sa.Uuid(), nullable=True),
        sa.Column("cancel_reason", sa.String(length=300), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "payment_method IN ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'PREPAID', 'OTHER')",
            name=op.f("ck_deliveries_payment_method"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'ASSIGNED', 'IN_ROUTE', 'DELIVERED', 'CANCELED', 'ISSUE')",
            name=op.f("ck_deliveries_status"),
        ),
        sa.ForeignKeyConstraint(
            ["client_address_id"],
            ["client_addresses.id"],
            name=op.f("fk_deliveries_client_address_id_client_addresses"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name=op.f("fk_deliveries_client_id_clients"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_deliveries_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_deliveries_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["deliverer_id"],
            ["users.id"],
            name=op.f("fk_deliveries_deliverer_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deliveries")),
        sa.UniqueConstraint("company_id", "number", name="uq_deliveries_company_number"),
    )
    op.create_index(op.f("ix_deliveries_client_id"), "deliveries", ["client_id"], unique=False)
    op.create_index(
        "ix_deliveries_company_created_at", "deliveries", ["company_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_deliveries_company_status", "deliveries", ["company_id", "status"], unique=False
    )
    op.create_index(
        "ix_deliveries_deliverer_status", "deliveries", ["deliverer_id", "status"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_deliveries_deliverer_status", table_name="deliveries")
    op.drop_index("ix_deliveries_company_status", table_name="deliveries")
    op.drop_index("ix_deliveries_company_created_at", table_name="deliveries")
    op.drop_index(op.f("ix_deliveries_client_id"), table_name="deliveries")
    op.drop_table("deliveries")
