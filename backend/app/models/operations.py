from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# Amounts are in the bond's currency. fx_rate on every operation is UAH per 1 USD on that
# operation's date; currency_rate is UAH per 1 unit of the bond's currency, set only for EUR bonds.


class Lot(TimestampMixin, Base):
    """A purchase of one instrument; shown as a "package" in the UI."""

    __tablename__ = "lot"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("price_per_unit > 0", name="price_positive"),
        CheckConstraint("total_cost > 0", name="total_cost_positive"),
        CheckConstraint("accrued_paid >= 0", name="accrued_non_negative"),
        CheckConstraint("fee >= 0", name="fee_non_negative"),
        CheckConstraint("fx_rate > 0", name="fx_rate_positive"),
        CheckConstraint("currency_rate > 0", name="currency_rate_positive"),
        Index("ix_lot_instrument_trade_date", "instrument_id", "trade_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instrument.id", ondelete="RESTRICT"))
    trade_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    # Amount paid excluding fee; includes accrued coupon bought with the bond.
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    accrued_paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal(0))
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal(0))
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    currency_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    note: Mapped[str | None] = mapped_column(Text)


class Sale(TimestampMixin, Base):
    __tablename__ = "sale"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("total_proceeds > 0", name="proceeds_positive"),
        CheckConstraint("accrued_received >= 0", name="accrued_non_negative"),
        CheckConstraint("fee >= 0", name="fee_non_negative"),
        CheckConstraint("fx_rate > 0", name="fx_rate_positive"),
        CheckConstraint("currency_rate > 0", name="currency_rate_positive"),
        Index("ix_sale_lot_trade_date", "lot_id", "trade_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lot.id", ondelete="RESTRICT"))
    trade_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    # Amount received excluding fee; includes accrued coupon sold with the bond.
    total_proceeds: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    accrued_received: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal(0))
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal(0))
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    currency_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    note: Mapped[str | None] = mapped_column(Text)


class Payment(TimestampMixin, Base):
    """A coupon or redemption received for all lots of one instrument."""

    __tablename__ = "payment"
    __table_args__ = (
        CheckConstraint("kind IN ('coupon', 'redemption')", name="kind"),
        CheckConstraint("total_amount > 0", name="amount_positive"),
        CheckConstraint("fee >= 0", name="fee_non_negative"),
        CheckConstraint("fx_rate > 0", name="fx_rate_positive"),
        CheckConstraint("currency_rate > 0", name="currency_rate_positive"),
        Index("ix_payment_instrument_pay_date", "instrument_id", "pay_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instrument.id", ondelete="RESTRICT"))
    kind: Mapped[str] = mapped_column(String(16))
    pay_date: Mapped[date] = mapped_column(Date)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal(0))
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    currency_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    note: Mapped[str | None] = mapped_column(Text)


class FxRate(Base):
    """Cache of official NBU rates: `rate` units of `quote` per 1 `base`."""

    __tablename__ = "fx_rate"
    __table_args__ = (CheckConstraint("rate > 0", name="rate_positive"),)

    base: Mapped[str] = mapped_column(String(3), primary_key=True)
    quote: Mapped[str] = mapped_column(String(3), primary_key=True)
    rate_date: Mapped[date] = mapped_column(Date, primary_key=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 6))
