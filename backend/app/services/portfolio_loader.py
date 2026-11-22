from collections.abc import Callable
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.engine.portfolio import BondTerms, LotData, PaymentData, Portfolio, SaleData
from app.engine.schedule import ScheduleItem
from app.models import Instrument, Lot, Payment, Sale
from app.services.fx import usd_rate_for_valuation


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
    lots = [
        LotData(
            lot.id,
            lot.instrument_id,
            lot.trade_date,
            lot.quantity,
            lot.total_cost_uah,
            lot.accrued_paid_uah,
            lot.fee_uah,
            lot.fx_rate,
        )
        for lot in session.scalars(select(Lot))
    ]
    sales = [
        SaleData(
            s.id, s.lot_id, s.trade_date, s.quantity, s.total_proceeds_uah, s.fee_uah, s.fx_rate
        )
        for s in session.scalars(select(Sale))
    ]
    payments = [
        PaymentData(
            p.id,
            p.instrument_id,
            "redemption" if p.kind == "redemption" else "coupon",
            p.pay_date,
            p.total_amount_uah,
            p.fee_uah,
            p.fx_rate,
        )
        for p in session.scalars(select(Payment))
    ]
    return Portfolio(terms, lots, sales, payments), instruments


def fx_lookup(session: Session) -> Callable[[date], Decimal]:
    """NBU rate per day, memoized for one request; future days use today's rate."""
    cache: dict[date, Decimal] = {}

    def fx_at(day: date) -> Decimal:
        day = min(day, date.today())  # noqa: DTZ011
        if day not in cache:
            cache[day] = usd_rate_for_valuation(session, day)
        return cache[day]

    return fx_at
