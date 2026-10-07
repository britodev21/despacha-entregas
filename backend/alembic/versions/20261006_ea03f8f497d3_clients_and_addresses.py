"""clients and addresses

Revision ID: ea03f8f497d3
Revises: 755050cd29e4
Create Date: 2026-10-06 20:24:40.383906

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "ea03f8f497d3"
down_revision: str | Sequence[str] | None = "755050cd29e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("document", sa.String(length=14), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_clients_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clients")),
    )
    op.create_index(op.f("ix_clients_company_id"), "clients", ["company_id"], unique=False)
    op.create_index(op.f("ix_clients_phone"), "clients", ["phone"], unique=False)
    op.create_table(
        "client_addresses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=True),
        sa.Column("zip_code", sa.String(length=8), nullable=True),
        sa.Column("street", sa.String(length=160), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("complement", sa.String(length=80), nullable=True),
        sa.Column("neighborhood", sa.String(length=80), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name=op.f("fk_client_addresses_client_id_clients"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_client_addresses_company_id_companies"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_addresses")),
    )
    op.create_index(
        op.f("ix_client_addresses_client_id"), "client_addresses", ["client_id"], unique=False
    )
    op.create_index(
        op.f("ix_client_addresses_company_id"), "client_addresses", ["company_id"], unique=False
    )
    op.create_index(
        "uq_client_addresses_one_default",
        "client_addresses",
        ["client_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_client_addresses_one_default",
        table_name="client_addresses",
        postgresql_where=sa.text("is_default"),
    )
    op.drop_index(op.f("ix_client_addresses_company_id"), table_name="client_addresses")
    op.drop_index(op.f("ix_client_addresses_client_id"), table_name="client_addresses")
    op.drop_table("client_addresses")
    op.drop_index(op.f("ix_clients_phone"), table_name="clients")
    op.drop_index(op.f("ix_clients_company_id"), table_name="clients")
    op.drop_table("clients")
