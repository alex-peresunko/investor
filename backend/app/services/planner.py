from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.errors import ValidationError
from app.engine import planner as engine
from app.engine.planner import Candidate, Inflow, LadderPeriod
from app.engine.portfolio import BondTerms
from app.engine.schedule import ScheduleItem, add_months
from app.schemas.common import Currency
from app.schemas.market import MarketBond
from app.schemas.planner import PlanAmount, PlannedPurchase, PurchasePlan
from app.services import market, securities
from app.services.portfolio_loader import load_portfolio
from app.services.reports import held_quantity

CENT = Decimal("0.01")
HUNDRED = Decimal(100)
MAX_YEARS = 10
PRICE_MAX_AGE = timedelta(days=30)


def _latest_yield(bond: MarketBond) -> Decimal | None:
    dated: list[tuple[date, Decimal]] = []
    if bond.last_trade and bond.last_trade.yield_avg is not None:
        dated.append((bond.last_trade.day, bond.last_trade.yield_avg))
    if bond.last_auction and bond.last_auction.yield_avg is not None:
        dated.append((bond.last_auction.day, bond.last_auction.yield_avg))
    return max(dated)[1] if dated else None


def _clean_price(bond: MarketBond, today: date) -> Decimal | None:
    """Per unit from a recent trade, or None when there is none."""
    trade = bond.last_trade
    if trade is None or trade.clean_price is None or trade.day < today - PRICE_MAX_AGE:
        return None
    return bond.face_value * trade.clean_price / HUNDRED


def _held_inflows(session: Session, currency: Currency, today: date) -> list[Inflow]:
    portfolio, instruments = load_portfolio(session)
    inflows: list[Inflow] = []
    for instrument in instruments.values():
        if instrument.currency != currency:
            continue
        held = held_quantity(portfolio, instrument.id, today)
        if held <= 0:
            continue
        inflows += [
            Inflow(
                item.pay_date,
                "redemption" if item.kind == "redemption" else "coupon",
                item.amount_per_unit * held,
            )
            for item in instrument.schedule
            if item.pay_date > today
        ]
    return inflows


def plan(
    session: Session,
    *,
    currency: Currency,
    years: int,
    period: LadderPeriod,
    extra_now: Decimal,
    extra_monthly: Decimal,
    min_yield: Decimal | None,
    min_purchase: Decimal,
    tracked: dict[str, int],
) -> PurchasePlan:
    if not 1 <= years <= MAX_YEARS:
        raise ValidationError("plan_years_out_of_range", max=MAX_YEARS)
    if min(extra_now, extra_monthly, min_purchase) < 0:
        raise ValidationError("plan_amount_negative")
    today = date.today()  # noqa: DTZ011
    start, end = engine.horizon(today, years)
    latest = add_months(end, years * 12)
    by_isin: dict[str, MarketBond] = {}
    candidates: list[Candidate] = []
    estimated: set[str] = set()
    for bond in market.bonds(today, tracked).bonds:
        if bond.currency != currency or not start <= bond.maturity_date <= latest:
            continue
        rate = _latest_yield(bond)
        if min_yield is not None and (rate is None or rate < min_yield):
            continue
        clean = _clean_price(bond, today)
        if clean is None:
            estimated.add(bond.isin)
            clean = bond.face_value
        security = securities.lookup(bond.isin)
        terms = BondTerms(
            instrument_id=0,
            face_value=security.face_value,
            issue_date=security.issue_date,
            maturity_date=security.maturity_date,
            schedule=tuple(
                ScheduleItem(s.kind, s.pay_date, s.amount_per_unit) for s in security.schedule
            ),
            currency=security.currency,
        )
        by_isin[bond.isin] = bond
        candidates.append(Candidate(bond.isin, terms, clean, rate))

    result = engine.plan(
        today=today,
        years=years,
        period=period,
        held=_held_inflows(session, currency, today),
        candidates=candidates,
        extra_now=extra_now,
        extra_monthly=extra_monthly,
        min_purchase=min_purchase,
    )

    def cents(value: Decimal) -> Decimal:
        return value.quantize(CENT, ROUND_HALF_UP)

    return PurchasePlan(
        currency=currency,
        period=period,
        start=start,
        end=end,
        coupons=[
            PlanAmount(
                start=month, current=cents(amount), with_plan=cents(result.coupons_after[month])
            )
            for month, amount in result.coupons_before.items()
        ],
        redemptions=[
            PlanAmount(
                start=first, current=cents(amount), with_plan=cents(result.redemptions_after[first])
            )
            for first, amount in result.redemptions_before.items()
        ],
        purchases=[
            PlannedPurchase(
                buy_date=p.day,
                isin=p.isin,
                name=by_isin[p.isin].name,
                maturity_date=by_isin[p.isin].maturity_date,
                quantity=p.quantity,
                price=p.price,
                cost=cents(p.cost),
                yield_rate=_latest_yield(by_isin[p.isin]),
                price_estimated=p.isin in estimated,
                variable_rate=by_isin[p.isin].variable_rate,
                instrument_id=by_isin[p.isin].instrument_id,
            )
            for p in result.purchases
        ],
        invested=cents(result.invested),
        cash_left=cents(result.cash_left),
        candidates=len(candidates),
    )
