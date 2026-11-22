from collections.abc import Callable
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.engine.portfolio import BondTerms, LotData, PaymentData, Portfolio, SaleData
from app.engine.schedule import ScheduleItem
from app.models import Instrument, Lot, Payment, Sale
from app.services.fx import rate_for_valuation


def uah_rate(currency: str, fx_rate: Decimal, currency_rate: Decimal | None) -> Decimal:
    """UAH per 1 unit of the bond's currency for one operation."""
    if currency == "UAH":
        return Decimal(1)
    if currency == "USD":
        return fx_rate
    if currency_rate is None:
        raise ValueError(f"{currency} operation without currency_rate")
    return currency_rate


def load_portfolio(session: Session) -> tuple[Portfolio, dict[int, Instrument]]:
    instruments = {
        i.id: i
        for i in session.scalars(select(Instrument).options(selectinload(Instrument.schedule)))
    }
    terms = {
        i.id: BondTerms(
            instrument_id=i.id,
            face_value=i.face_value,
            issue_date=i.issue_date,
            maturity_date=i.maturity_date,
            currency=i.currency,
            schedule=tuple(
                ScheduleItem(
                    "redemption" if s.kind == "redemption" else "coupon",
                    s.pay_date,
                    s.amount_per_unit,
                )
                for s in i.schedule
            ),
        )
        for i in instruments.values()
    }
    lot_rows = list(session.scalars(select(Lot)))
    lots = [
        LotData(
            lot.id,
            lot.instrument_id,
            lot.trade_date,
            lot.quantity,
            lot.total_cost,
            lot.accrued_paid,
            lot.fee,
            lot.fx_rate,
            uah_rate(instruments[lot.instrument_id].currency, lot.fx_rate, lot.currency_rate),
        )
        for lot in lot_rows
    ]
    lot_currency = {lot.id: instruments[lot.instrument_id].currency for lot in lot_rows}
    sales = [
        SaleData(
            s.id,
            s.lot_id,
            s.trade_date,
            s.quantity,
            s.total_proceeds,
            s.fee,
            s.fx_rate,
            uah_rate(lot_currency[s.lot_id], s.fx_rate, s.currency_rate),
        )
        for s in session.scalars(select(Sale))
    ]
    payments = [
        PaymentData(
            p.id,
            p.instrument_id,
            "redemption" if p.kind == "redemption" else "coupon",
            p.pay_date,
            p.total_amount,
            p.fee,
            p.fx_rate,
            uah_rate(instruments[p.instrument_id].currency, p.fx_rate, p.currency_rate),
        )
        for p in session.scalars(select(Payment))
    ]
    return Portfolio(terms, lots, sales, payments), instruments


def fx_lookup(session: Session) -> Callable[[str, date], Decimal]:
    """NBU UAH rate per currency and day, memoized for one request; future days use today's."""
    cache: dict[tuple[str, date], Decimal] = {}

    def fx_at(currency: str, day: date) -> Decimal:
        if currency == "UAH":
            return Decimal(1)
        key = (currency, min(day, date.today()))  # noqa: DTZ011
        if key not in cache:
            cache[key] = rate_for_valuation(session, *key)
        return cache[key]

    return fx_at
