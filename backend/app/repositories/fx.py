from datetime import date
from decimal import Decimal

from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.models import FxRate, Lot, Payment, Sale


def get_rate(session: Session, base: str, quote: str, day: date) -> Decimal | None:
    row = session.get(FxRate, (base, quote, day))
    return row.rate if row is not None else None


def save_rate(session: Session, base: str, quote: str, day: date, rate: Decimal) -> None:
    session.merge(FxRate(base=base, quote=quote, rate_date=day, rate=rate))
    session.flush()


def nearest_usd_rate(session: Session, day: date) -> tuple[date, Decimal] | None:
    """Closest-dated known UAH per USD: cached NBU rates first, then operations' own rates."""
    cached = select(FxRate.rate_date.label("day"), FxRate.rate).where(
        FxRate.base == "USD", FxRate.quote == "UAH"
    )
    operations = union_all(
        select(Lot.trade_date.label("day"), Lot.fx_rate.label("rate")),
        select(Sale.trade_date, Sale.fx_rate),
        select(Payment.pay_date, Payment.fx_rate),
    ).subquery()
    for source in (cached.subquery(), operations):
        row = session.execute(
            select(source.c.day, source.c.rate)
            .order_by(func.abs(source.c.day - day), source.c.day.desc())
            .limit(1)
        ).first()
        if row is not None:
            return row.day, row.rate
    return None
