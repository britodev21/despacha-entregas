"""deliverer locations

Revision ID: 131c64ec310e
Revises: 99004509bbe0
Create Date: 2026-10-14 02:26:55.312252

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "131c64ec310e"
down_revision: str | Sequence[str] | None = "99004509bbe0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deliverer_locations",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("accuracy_m", sa.Numeric(precision=8, scale=1), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_deliverer_locations_company_id_companies"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_deliverer_locations_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deliverer_locations")),
    )
    op.create_index(
        "ix_deliverer_locations_company_received",
        "deliverer_locations",
        ["company_id", "received_at"],
        unique=False,
    )
    op.create_index(
        "ix_deliverer_locations_user_recorded",
        "deliverer_locations",
        ["user_id", "recorded_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_deliverer_locations_user_recorded", table_name="deliverer_locations")
    op.drop_index("ix_deliverer_locations_company_received", table_name="deliverer_locations")
    op.drop_table("deliverer_locations")
