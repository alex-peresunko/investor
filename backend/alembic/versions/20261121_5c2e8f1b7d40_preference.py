"""preference table

Revision ID: 5c2e8f1b7d40
Revises: a9e371ad1807
Create Date: 2026-11-21 23:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5c2e8f1b7d40"
down_revision: str | None = "a9e371ad1807"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "preference",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.String(length=200), nullable=False),
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
        sa.PrimaryKeyConstraint("key", name=op.f("pk_preference")),
    )


def downgrade() -> None:
    op.drop_table("preference")
