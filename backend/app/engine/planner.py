"""Purchase planner: which bonds to buy, and when, so coupons arrive evenly every month and
redemptions are spread evenly across periods (a ladder).

All amounts are in one currency. Cash comes from scheduled payments of bonds already held, an
optional amount available today and an optional amount on the first of every month; bonds the
plan buys pay into later cash dates, so the plan reinvests them.
"""

import heapq
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from typing import Literal

from app.engine.portfolio import BondTerms, accrued_coupon
from app.engine.schedule import PaymentKind, add_months

CENT = Decimal("0.01")
LadderPeriod = Literal["quarter", "year"]
PERIOD_MONTHS: dict[LadderPeriod, int] = {"quarter": 3, "year": 12}
# Cash available on a date is spent in up to this many purchases, so one bond does not take it all.
CHUNKS = 4


@dataclass(frozen=True)
class Candidate:
    isin: str
    terms: BondTerms
    # Per unit in the bond's currency, without accrued coupon; assumed to stay the same.
    clean_price: Decimal
    yield_rate: Decimal | None = None


@dataclass(frozen=True)
class Inflow:
    day: date
    kind: PaymentKind
    amount: Decimal


@dataclass(frozen=True)
class Purchase:
    day: date
    isin: str
    quantity: int
    # Per unit, clean price plus coupon accrued on `day`.
    price: Decimal
    cost: Decimal


@dataclass(frozen=True)
class Plan:
    # First day of each month of the horizon -> coupons received that month.
    coupons_before: dict[date, Decimal]
    coupons_after: dict[date, Decimal]
    # First day of each ladder period -> redemptions received in it.
    redemptions_before: dict[date, Decimal]
    redemptions_after: dict[date, Decimal]
    purchases: list[Purchase]
    invested: Decimal
    cash_left: Decimal


def horizon(today: date, years: int) -> tuple[date, date]:
    """First and last day of the planned months: whole calendar months from next month."""
    start = add_months(today.replace(day=1), 1)
    return start, add_months(start, years * 12) - timedelta(days=1)


def _month_index(start: date, day: date) -> int:
    return (day.year - start.year) * 12 + day.month - start.month


class _Calendar:
    """Coupons per month and redemptions per period from `start` for `months` months, scored
    for evenness over a window of `window` months."""

    def __init__(self, start: date, months: int, window: int, period: LadderPeriod) -> None:
        self.start = start
        self.step = PERIOD_MONTHS[period]
        self.months = months
        self.window = window
        self.coupons = [Decimal(0)] * months
        self.redemptions = [Decimal(0)] * (months // self.step)
        # Float copies for scoring only; no amount is derived from them.
        self._floats: dict[PaymentKind, list[float]] = {
            "coupon": [0.0] * len(self.coupons),
            "redemption": [0.0] * len(self.redemptions),
        }

    def slot(self, kind: PaymentKind, day: date) -> int | None:
        index = _month_index(self.start, day)
        if not 0 <= index < self.months:
            return None
        return index if kind == "coupon" else index // self.step

    def add(self, kind: PaymentKind, day: date, amount: Decimal) -> None:
        index = self.slot(kind, day)
        if index is not None:
            (self.coupons if kind == "coupon" else self.redemptions)[index] += amount
            self._floats[kind][index] += float(amount)

    def score_with(self, day: date, extra: dict[tuple[PaymentKind, int], Decimal]) -> float:
        """Sum of the squared coefficients of variation of coupons and redemptions in the window
        that starts in the month of `day`; lower is more even."""
        first = max(0, _month_index(self.start, day))
        bounds: dict[PaymentKind, tuple[int, int]] = {
            "coupon": (first, first + self.window),
            "redemption": (first // self.step, -(-(first + self.window) // self.step)),
        }
        total = 0.0
        for kind, (low, high) in bounds.items():
            series = self._floats[kind][low:high]
            for (k, index), amount in extra.items():
                if k == kind and low <= index < high:
                    series[index - low] += float(amount)
            mean = sum(series) / len(series) if series else 0.0
            if mean > 0:
                total += sum((v - mean) ** 2 for v in series) / len(series) / mean**2
        return total

    def by_month(self, months: int) -> dict[date, Decimal]:
        return {add_months(self.start, i): v for i, v in enumerate(self.coupons[:months])}

    def by_period(self, periods: int) -> dict[date, Decimal]:
        return {
            add_months(self.start, i * self.step): v
            for i, v in enumerate(self.redemptions[:periods])
        }


def _future(candidate: Candidate, day: date) -> list[tuple[PaymentKind, date, Decimal]]:
    return [
        (item.kind, item.pay_date, item.amount_per_unit)
        for item in candidate.terms.schedule
        if item.pay_date > day
    ]


def plan(
    *,
    today: date,
    years: int,
    period: LadderPeriod,
    held: list[Inflow],
    candidates: list[Candidate],
    extra_now: Decimal = Decimal(0),
    extra_monthly: Decimal = Decimal(0),
    min_purchase: Decimal = Decimal(0),
) -> Plan:
    """Greedy plan: on every date cash arrives within the horizon, buy the candidates that leave
    coupons and redemptions most even over the next `years`, ties going to the higher yield.
    A purchase on day D only considers bonds maturing by D + `years`, so redemptions roll over
    to the far end like a ladder. Cash below a bond's price carries to the next cash date.

    Coupons are reported for the horizon; redemptions also for the later periods that the
    plan's purchases mature in.
    """
    start, end = horizon(today, years)
    window = years * 12
    before = _Calendar(start, 2 * window, window, period)
    after = _Calendar(start, 2 * window, window, period)
    cash_events: list[tuple[date, int, Decimal]] = []
    order = 0

    def receive(day: date, amount: Decimal) -> None:
        nonlocal order
        if amount > 0 and day <= end:
            heapq.heappush(cash_events, (day, order, amount))
            order += 1

    for flow in held:
        if flow.day > today:
            before.add(flow.kind, flow.day, flow.amount)
            after.add(flow.kind, flow.day, flow.amount)
            receive(flow.day, flow.amount)
    receive(today, extra_now)
    for month in range(window):
        receive(add_months(start, month), extra_monthly)

    bought: dict[tuple[date, str], tuple[int, Decimal]] = {}
    cash = Decimal(0)
    while cash_events:
        day = cash_events[0][0]
        while cash_events and cash_events[0][0] == day:
            cash += heapq.heappop(cash_events)[2]
        if cash < min_purchase:
            continue
        latest = add_months(day, window)
        eligible = [c for c in candidates if day < c.terms.maturity_date <= latest]
        share = cash / CHUNKS
        for _ in range(CHUNKS):
            best: tuple[float, Decimal, Candidate, int, Decimal] | None = None
            for candidate in eligible:
                price = (candidate.clean_price + accrued_coupon(candidate.terms, day)).quantize(
                    CENT, ROUND_HALF_UP
                )
                if price <= 0 or price > cash:
                    continue
                quantity = max(1, int((min(share, cash) / price).to_integral_value(ROUND_DOWN)))
                extra: dict[tuple[PaymentKind, int], Decimal] = defaultdict(Decimal)
                for kind, pay_date, per_unit in _future(candidate, day):
                    index = after.slot(kind, pay_date)
                    if index is not None:
                        extra[(kind, index)] += per_unit * quantity
                score = after.score_with(day, extra)
                rate = candidate.yield_rate if candidate.yield_rate is not None else Decimal(-1)
                if best is None or (score, -rate) < (best[0], -best[1]):
                    best = (score, rate, candidate, quantity, price)
            if best is None:
                break
            _, _, candidate, quantity, price = best
            cash -= price * quantity
            key = (day, candidate.isin)
            held_qty, held_price = bought.get(key, (0, price))
            bought[key] = (held_qty + quantity, held_price)
            for kind, pay_date, per_unit in _future(candidate, day):
                amount = per_unit * quantity
                after.add(kind, pay_date, amount)
                receive(pay_date, amount)

    purchases = [
        Purchase(day=day, isin=isin, quantity=qty, price=price, cost=price * qty)
        for (day, isin), (qty, price) in sorted(bought.items())
    ]
    periods = window // after.step
    last_redemption = max(
        (i + 1 for i, v in enumerate(after.redemptions) if v > 0), default=periods
    )
    return Plan(
        coupons_before=before.by_month(window),
        coupons_after=after.by_month(window),
        redemptions_before=before.by_period(max(periods, last_redemption)),
        redemptions_after=after.by_period(max(periods, last_redemption)),
        purchases=purchases,
        invested=sum((p.cost for p in purchases), Decimal(0)),
        cash_left=cash,
    )
