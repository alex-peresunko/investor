import calendar
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationError
from app.engine.portfolio import FxAt, PaymentData, Portfolio, missed_payments
from app.models import Instrument
from app.schemas.reports import (
    AmountOut,
    FlowOut,
    LotReport,
    LotSummary,
    MissedPayment,
    PaymentAllocation,
    PnlOut,
    PortfolioReport,
    ReceivedPayment,
    TimeseriesPoint,
    UpcomingPayment,
)
from app.services.portfolio_loader import fx_lookup, load_portfolio

CENT = Decimal("0.01")


def _period(portfolio: Portfolio, start: date | None, end: date | None) -> tuple[date, date]:
    today = date.today()  # noqa: DTZ011
    first_trade = min((lot.trade_date for lot in portfolio.lots.values()), default=today)
    start = start or first_trade
    end = end or today
    if end < start:
        raise ValidationError("period_end_before_start")
    return start, end


def _summary(
    portfolio: Portfolio,
    instruments: dict[int, Instrument],
    lot_id: int,
    start: date,
    end: date,
    fx_at: FxAt,
) -> LotSummary:
    lot = portfolio.lots[lot_id]
    instrument = instruments[lot.instrument_id]
    return LotSummary(
        lot_id=lot.id,
        instrument_id=lot.instrument_id,
        isin=instrument.isin,
        name=instrument.name,
        trade_date=lot.trade_date,
        maturity_date=instrument.maturity_date,
        quantity=lot.quantity,
        open_quantity=portfolio.open_quantity(lot.id, end),
        pnl=PnlOut.of(portfolio.period_pnl([lot.id], start, end, fx_at)),
        xirr_uah=portfolio.xirr([lot.id], start, end, fx_at, "UAH"),
        xirr_usd=portfolio.xirr([lot.id], start, end, fx_at, "USD"),
    )


def _active_lot_ids(portfolio: Portfolio, start: date, end: date) -> list[int]:
    """Lots bought on or before `end` that were not fully closed before `start`."""
    return [
        lot.id
        for lot in sorted(portfolio.lots.values(), key=lambda x: (x.trade_date, x.id))
        if lot.trade_date <= end
        and (
            portfolio.open_quantity(lot.id, start - timedelta(days=1)) > 0
            or lot.trade_date >= start
            or portfolio.flows([lot.id], start, end)
        )
    ]


def portfolio_report(session: Session, start: date | None, end: date | None) -> PortfolioReport:
    portfolio, instruments = load_portfolio(session)
    start, end = _period(portfolio, start, end)
    fx_at = fx_lookup(session)
    ids = _active_lot_ids(portfolio, start, end)
    totals = portfolio.period_pnl(ids, start, end, fx_at)
    closed = [i for i in ids if portfolio.open_quantity(i, end) == 0]
    realized = portfolio.period_pnl(closed, start, end, fx_at).pnl
    return PortfolioReport(
        start=start,
        end=end,
        totals=PnlOut.of(totals),
        realized=AmountOut.of(realized),
        # Derived from the total so the two parts always sum to it despite per-part rounding.
        unrealized=AmountOut.of(totals.pnl - realized),
        realized_xirr_uah=portfolio.xirr(closed, start, end, fx_at, "UAH"),
        realized_xirr_usd=portfolio.xirr(closed, start, end, fx_at, "USD"),
        xirr_uah=portfolio.xirr(ids, start, end, fx_at, "UAH"),
        xirr_usd=portfolio.xirr(ids, start, end, fx_at, "USD"),
        lots=[_summary(portfolio, instruments, i, start, end, fx_at) for i in ids],
    )


def lot_report(session: Session, lot_id: int, start: date | None, end: date | None) -> LotReport:
    portfolio, instruments = load_portfolio(session)
    if lot_id not in portfolio.lots:
        raise NotFoundError("package_not_found", id=lot_id)
    if start is None:
        start = portfolio.lots[lot_id].trade_date
    start, end = _period(portfolio, start, end)
    fx_at = fx_lookup(session)
    return LotReport(
        start=start,
        end=end,
        summary=_summary(portfolio, instruments, lot_id, start, end, fx_at),
        flows=[
            FlowOut(
                day=f.day,
                kind=f.kind,
                amount_uah=f.amount_uah,
                fx_rate=f.fx_rate,
                amount_usd=f.amount_usd.quantize(CENT, ROUND_HALF_UP),
            )
            for f in portfolio.flows([lot_id], start, end)
        ],
    )


def _month_ends(start: date, end: date) -> list[date]:
    days = {start, end}
    year, month = start.year, start.month
    while True:
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        if month_end > end:
            break
        if month_end >= start:
            days.add(month_end)
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return sorted(days)


def timeseries(
    session: Session, start: date | None, end: date | None, lot_id: int | None
) -> list[TimeseriesPoint]:
    portfolio, _ = load_portfolio(session)
    if lot_id is not None and lot_id not in portfolio.lots:
        raise NotFoundError("package_not_found", id=lot_id)
    start, end = _period(portfolio, start, end)
    fx_at = fx_lookup(session)
    ids = [lot_id] if lot_id is not None else _active_lot_ids(portfolio, start, end)
    points = []
    for day in _month_ends(start, end):
        pnl = portfolio.period_pnl(ids, start, day, fx_at)
        points.append(
            TimeseriesPoint(
                day=day,
                value=AmountOut.of(pnl.closing_value),
                cumulative_pnl=AmountOut.of(pnl.pnl),
            )
        )
    return points


def upcoming(session: Session, months: int) -> list[UpcomingPayment]:
    if not 1 <= months <= 120:
        raise ValidationError("months_out_of_range")
    portfolio, instruments = load_portfolio(session)
    today = date.today()  # noqa: DTZ011
    horizon = today + timedelta(days=round(months * 30.44))
    fx_today = fx_lookup(session)(today)
    result = []
    for instrument in instruments.values():
        held = sum(
            (
                portfolio.open_quantity(lot.id, today)
                for lot in portfolio.lots.values()
                if lot.instrument_id == instrument.id
            ),
            Decimal(0),
        )
        if held <= 0:
            continue
        for item in instrument.schedule:
            if today < item.pay_date <= horizon:
                expected = (item.amount_per_unit * held).quantize(CENT, ROUND_HALF_UP)
                result.append(
                    UpcomingPayment(
                        pay_date=item.pay_date,
                        instrument_id=instrument.id,
                        isin=instrument.isin,
                        name=instrument.name,
                        kind="redemption" if item.kind == "redemption" else "coupon",
                        amount_per_unit=item.amount_per_unit,
                        quantity=held,
                        expected_uah=expected,
                        expected_usd_estimate=(expected / fx_today).quantize(CENT, ROUND_HALF_UP),
                    )
                )
    return sorted(result, key=lambda p: (p.pay_date, p.isin, p.kind))


def missed(session: Session) -> list[MissedPayment]:
    portfolio, instruments = load_portfolio(session)
    return [
        MissedPayment(
            pay_date=m.item.pay_date,
            instrument_id=m.instrument_id,
            isin=instruments[m.instrument_id].isin,
            name=instruments[m.instrument_id].name,
            kind=m.item.kind,
            amount_per_unit=m.item.amount_per_unit,
            quantity=m.quantity,
            expected_uah=(m.item.amount_per_unit * m.quantity).quantize(CENT, ROUND_HALF_UP),
        )
        for m in missed_payments(portfolio, date.today())  # noqa: DTZ011
    ]


def _attributed_cost(
    portfolio: Portfolio, payment: PaymentData, lot_id: int, units: Decimal
) -> Decimal:
    """Purchase cost that `payment` pays back for `units` of the lot; see ReceivedPayment."""
    lot = portfolio.lots[lot_id]
    if payment.kind == "redemption":
        return (lot.total_cost_uah - lot.accrued_paid_uah + lot.fee_uah) / lot.quantity * units
    first_coupon = min(
        (
            p.pay_date
            for p in portfolio.payments
            if p.instrument_id == lot.instrument_id
            and p.kind == "coupon"
            and p.pay_date > lot.trade_date
        ),
        default=None,
    )
    if payment.pay_date != first_coupon:
        return Decimal(0)
    return lot.accrued_paid_uah / lot.quantity * units


def received(session: Session, start: date | None, end: date | None) -> list[ReceivedPayment]:
    portfolio, instruments = load_portfolio(session)
    start, end = _period(portfolio, start, end)
    result = []
    for payment in portfolio.payments:
        if not start <= payment.pay_date <= end:
            continue
        shares = portfolio.allocate(payment)
        record_day = payment.pay_date - timedelta(days=1)
        instrument = instruments[payment.instrument_id]
        allocations = []
        for lot_id, (amount, fee) in sorted(shares.items()):
            units = portfolio.open_quantity(lot_id, record_day)
            cost = _attributed_cost(portfolio, payment, lot_id, units)
            allocations.append(
                PaymentAllocation(
                    lot_id=lot_id,
                    amount_uah=amount,
                    net_income_uah=(amount - fee - cost).quantize(CENT, ROUND_HALF_UP),
                    net_income_usd=(
                        (amount - fee) / payment.fx_rate - cost / portfolio.lots[lot_id].fx_rate
                    ).quantize(CENT, ROUND_HALF_UP),
                )
            )
        result.append(
            ReceivedPayment(
                payment_id=payment.id,
                pay_date=payment.pay_date,
                instrument_id=payment.instrument_id,
                isin=instrument.isin,
                name=instrument.name,
                kind=payment.kind,
                quantity=sum(
                    (portfolio.open_quantity(lot_id, record_day) for lot_id in shares), Decimal(0)
                ),
                total_amount_uah=payment.total_amount_uah,
                fee_uah=payment.fee_uah,
                fx_rate=payment.fx_rate,
                amount_usd=(payment.total_amount_uah / payment.fx_rate).quantize(
                    CENT, ROUND_HALF_UP
                ),
                net_income_uah=sum((a.net_income_uah for a in allocations), Decimal(0)),
                net_income_usd=sum((a.net_income_usd for a in allocations), Decimal(0)),
                allocations=allocations,
            )
        )
    return result
