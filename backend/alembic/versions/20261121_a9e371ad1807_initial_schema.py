"""initial schema

Revision ID: a9e371ad1807
Revises:
Create Date: 2026-11-21 21:44:13.115995
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a9e371ad1807"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fx_rate",
        sa.Column("base", sa.String(length=3), nullable=False),
        sa.Column("quote", sa.String(length=3), nullable=False),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("rate", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.CheckConstraint("rate > 0", name=op.f("ck_fx_rate_rate_positive")),
        sa.PrimaryKeyConstraint("base", "quote", "rate_date", name=op.f("pk_fx_rate")),
    )
    op.create_table(
        "instrument",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("isin", sa.String(length=12), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("face_value", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("coupon_rate", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("coupon_frequency", sa.Integer(), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
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
        sa.CheckConstraint("kind IN ('bond')", name=op.f("ck_instrument_kind")),
        sa.CheckConstraint(
            "coupon_frequency IN (0, 1, 2, 4, 12)", name=op.f("ck_instrument_coupon_frequency")
        ),
        sa.CheckConstraint("coupon_rate >= 0", name=op.f("ck_instrument_coupon_rate_non_negative")),
        sa.CheckConstraint("face_value > 0", name=op.f("ck_instrument_face_value_positive")),
        sa.CheckConstraint(
            "maturity_date > issue_date", name=op.f("ck_instrument_maturity_after_issue")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_instrument")),
        sa.UniqueConstraint("isin", name=op.f("uq_instrument_isin")),
    )
    op.create_table(
        "lot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("price_per_unit", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("total_cost_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("accrued_paid_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fee_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fx_rate", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.CheckConstraint("accrued_paid_uah >= 0", name=op.f("ck_lot_accrued_non_negative")),
        sa.CheckConstraint("fee_uah >= 0", name=op.f("ck_lot_fee_non_negative")),
        sa.CheckConstraint("fx_rate > 0", name=op.f("ck_lot_fx_rate_positive")),
        sa.CheckConstraint("price_per_unit > 0", name=op.f("ck_lot_price_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_lot_quantity_positive")),
        sa.CheckConstraint("total_cost_uah > 0", name=op.f("ck_lot_total_cost_positive")),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instrument.id"],
            name=op.f("fk_lot_instrument_id_instrument"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lot")),
    )
    op.create_index(
        "ix_lot_instrument_trade_date", "lot", ["instrument_id", "trade_date"], unique=False
    )
    op.create_table(
        "payment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("pay_date", sa.Date(), nullable=False),
        sa.Column("total_amount_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fee_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fx_rate", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.CheckConstraint("kind IN ('coupon', 'redemption')", name=op.f("ck_payment_kind")),
        sa.CheckConstraint("fee_uah >= 0", name=op.f("ck_payment_fee_non_negative")),
        sa.CheckConstraint("fx_rate > 0", name=op.f("ck_payment_fx_rate_positive")),
        sa.CheckConstraint("total_amount_uah > 0", name=op.f("ck_payment_amount_positive")),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instrument.id"],
            name=op.f("fk_payment_instrument_id_instrument"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment")),
    )
    op.create_index(
        "ix_payment_instrument_pay_date", "payment", ["instrument_id", "pay_date"], unique=False
    )
    op.create_table(
        "scheduled_payment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("pay_date", sa.Date(), nullable=False),
        sa.Column("amount_per_unit", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.CheckConstraint(
            "kind IN ('coupon', 'redemption')", name=op.f("ck_scheduled_payment_kind")
        ),
        sa.CheckConstraint(
            "amount_per_unit > 0", name=op.f("ck_scheduled_payment_amount_positive")
        ),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instrument.id"],
            name=op.f("fk_scheduled_payment_instrument_id_instrument"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scheduled_payment")),
        sa.UniqueConstraint("instrument_id", "pay_date", "kind", name="uq_scheduled_payment_key"),
    )
    op.create_index(
        op.f("ix_scheduled_payment_instrument_id"),
        "scheduled_payment",
        ["instrument_id"],
        unique=False,
    )
    op.create_table(
        "sale",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lot_id", sa.Integer(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("total_proceeds_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("accrued_received_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fee_uah", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("fx_rate", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.CheckConstraint("accrued_received_uah >= 0", name=op.f("ck_sale_accrued_non_negative")),
        sa.CheckConstraint("fee_uah >= 0", name=op.f("ck_sale_fee_non_negative")),
        sa.CheckConstraint("fx_rate > 0", name=op.f("ck_sale_fx_rate_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_sale_quantity_positive")),
        sa.CheckConstraint("total_proceeds_uah > 0", name=op.f("ck_sale_proceeds_positive")),
        sa.ForeignKeyConstraint(
            ["lot_id"], ["lot.id"], name=op.f("fk_sale_lot_id_lot"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sale")),
    )
    op.create_index("ix_sale_lot_trade_date", "sale", ["lot_id", "trade_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sale_lot_trade_date", table_name="sale")
    op.drop_table("sale")
    op.drop_index(op.f("ix_scheduled_payment_instrument_id"), table_name="scheduled_payment")
    op.drop_table("scheduled_payment")
    op.drop_index("ix_payment_instrument_pay_date", table_name="payment")
    op.drop_table("payment")
    op.drop_index("ix_lot_instrument_trade_date", table_name="lot")
    op.drop_table("lot")
    op.drop_table("instrument")
    op.drop_table("fx_rate")
