"""bond currency: amounts in the bond's currency, rate to UAH for EUR bonds

Revision ID: 7b3d9e2c4f10
Revises: 5c2e8f1b7d40
Create Date: 2026-11-22 13:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7b3d9e2c4f10"
down_revision: str | None = "5c2e8f1b7d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RENAMES = {
    "lot": {
        "total_cost_uah": "total_cost",
        "accrued_paid_uah": "accrued_paid",
        "fee_uah": "fee",
    },
    "sale": {
        "total_proceeds_uah": "total_proceeds",
        "accrued_received_uah": "accrued_received",
        "fee_uah": "fee",
    },
    "payment": {"total_amount_uah": "total_amount", "fee_uah": "fee"},
}


def upgrade() -> None:
    op.create_check_constraint(
        op.f("ck_instrument_currency"), "instrument", "currency IN ('UAH', 'USD', 'EUR')"
    )
    for table, columns in RENAMES.items():
        for old, new in columns.items():
            op.alter_column(table, old, new_column_name=new)
        op.add_column(table, sa.Column("currency_rate", sa.Numeric(12, 6), nullable=True))
        op.create_check_constraint(
            op.f(f"ck_{table}_currency_rate_positive"), table, "currency_rate > 0"
        )


def downgrade() -> None:
    for table, columns in RENAMES.items():
        op.drop_constraint(op.f(f"ck_{table}_currency_rate_positive"), table, type_="check")
        op.drop_column(table, "currency_rate")
        for old, new in columns.items():
            op.alter_column(table, new, new_column_name=old)
    op.drop_constraint(op.f("ck_instrument_currency"), "instrument", type_="check")
