"""user sessions revoked at

Revision ID: 03b22d7ec43c
Revises: dd5219925bd0
Create Date: 2026-10-14 02:57:20.936227

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "03b22d7ec43c"
down_revision: str | Sequence[str] | None = "dd5219925bd0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("sessions_revoked_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "sessions_revoked_at")
