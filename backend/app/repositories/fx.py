from datetime import date
from decimal import Decimal

from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.models import FxRate, Instrument, Lot, Payment, Sale


def get_rate(session: Session, base: str, quote: str, day: date) -> Decimal | None:
    row = session.get(FxRate, (base, quote, day))
    return row.rate if row is not None else None


def save_rate(session: Session, base: str, quote: str, day: date, rate: Decimal) -> None:
    session.merge(FxRate(base=base, quote=quote, rate_date=day, rate=rate))
    session.flush()


def nearest_rate(session: Session, currency: str, day: date) -> tuple[date, Decimal] | None:
    """Closest-dated known UAH per unit of `currency`: cached NBU rates first, then the rates
    stored on operations (`fx_rate` for USD, `currency_rate` of that currency's bonds otherwise)."""
    cached = select(FxRate.rate_date.label("day"), FxRate.rate).where(
        FxRate.base == currency, FxRate.quote == "UAH"
    )
    if currency == "USD":
        operations = union_all(
            select(Lot.trade_date.label("day"), Lot.fx_rate.label("rate")),
            select(Sale.trade_date, Sale.fx_rate),
            select(Payment.pay_date, Payment.fx_rate),
        ).subquery()
    else:
        operations = union_all(
            select(Lot.trade_date.label("day"), Lot.currency_rate.label("rate"))
            .join(Instrument, Lot.instrument_id == Instrument.id)
            .where(Instrument.currency == currency),
            select(Sale.trade_date, Sale.currency_rate)
            .join(Lot, Sale.lot_id == Lot.id)
            .join(Instrument, Lot.instrument_id == Instrument.id)
            .where(Instrument.currency == currency),
            select(Payment.pay_date, Payment.currency_rate)
            .join(Instrument, Payment.instrument_id == Instrument.id)
            .where(Instrument.currency == currency),
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
