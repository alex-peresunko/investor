from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Instrument(TimestampMixin, Base):
    __tablename__ = "instrument"
    __table_args__ = (
        CheckConstraint("kind IN ('bond')", name="kind"),
        CheckConstraint("face_value > 0", name="face_value_positive"),
        CheckConstraint("coupon_rate >= 0", name="coupon_rate_non_negative"),
        CheckConstraint("coupon_frequency IN (0, 1, 2, 4, 12)", name="coupon_frequency"),
        CheckConstraint("maturity_date > issue_date", name="maturity_after_issue"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), default="bond")
    isin: Mapped[str] = mapped_column(String(12), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(String(3), default="UAH")
    face_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    # Annual rate as a fraction: 0.165 means 16.5 %.
    coupon_rate: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    # Coupon payments per year; 0 means a zero-coupon bond.
    coupon_frequency: Mapped[int]
    issue_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date)

    schedule: Mapped[list["ScheduledPayment"]] = relationship(
        back_populates="instrument",
        cascade="all, delete-orphan",
        order_by="ScheduledPayment.pay_date",
    )


class ScheduledPayment(Base):
    __tablename__ = "scheduled_payment"
    __table_args__ = (
        UniqueConstraint("instrument_id", "pay_date", "kind", name="uq_scheduled_payment_key"),
        CheckConstraint("kind IN ('coupon', 'redemption')", name="kind"),
        CheckConstraint("amount_per_unit > 0", name="amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instrument.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16))
    pay_date: Mapped[date] = mapped_column(Date)
    amount_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 6))

    instrument: Mapped[Instrument] = relationship(back_populates="schedule")
