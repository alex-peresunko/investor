from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.engine.schedule import PaymentKind, ScheduleItem

CENT = Decimal("0.01")
ONE_DAY = timedelta(days=1)

FlowKind = Literal["buy", "sell", "coupon", "redemption", "fee"]
FxAt = Callable[[date], Decimal]


@dataclass(frozen=True)
class BondTerms:
    instrument_id: int
    face_value: Decimal
    issue_date: date
    maturity_date: date
    schedule: tuple[ScheduleItem, ...]


@dataclass(frozen=True)
class LotData:
    id: int
    instrument_id: int
    trade_date: date
    quantity: Decimal
    total_cost_uah: Decimal
    accrued_paid_uah: Decimal
    fee_uah: Decimal
    fx_rate: Decimal


@dataclass(frozen=True)
class SaleData:
    id: int
    lot_id: int
    trade_date: date
    quantity: Decimal
    total_proceeds_uah: Decimal
    fee_uah: Decimal
    fx_rate: Decimal


@dataclass(frozen=True)
class PaymentData:
    id: int
    instrument_id: int
    kind: PaymentKind
    pay_date: date
    total_amount_uah: Decimal
    fee_uah: Decimal
    fx_rate: Decimal


@dataclass(frozen=True)
class CashFlow:
    """Signed from the investor's view: inflows positive, outflows negative."""

    lot_id: int
    day: date
    kind: FlowKind
    amount_uah: Decimal
    fx_rate: Decimal

    @property
    def amount_usd(self) -> Decimal:
        return self.amount_uah / self.fx_rate


@dataclass(frozen=True)
class Amount:
    uah: Decimal
    usd: Decimal

    @staticmethod
    def zero() -> "Amount":
        return Amount(Decimal(0), Decimal(0))

    def __add__(self, other: "Amount") -> "Amount":
        return Amount(self.uah + other.uah, self.usd + other.usd)

    def __sub__(self, other: "Amount") -> "Amount":
        return Amount(self.uah - other.uah, self.usd - other.usd)

    def rounded(self) -> "Amount":
        return Amount(_cents(self.uah), _cents(self.usd))


@dataclass(frozen=True)
class PeriodPnl:
    """Valuations are at the end of the day before `start` and at the end of `end`.

    pnl = closing_value - opening_value + received - invested. All fields rounded to cents.
    """

    opening_value: Amount
    closing_value: Amount
    invested: Amount
    received: Amount
    pnl: Amount


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, ROUND_HALF_UP)


class Portfolio:
    """Derived state of all lots; build once per request from the stored operations."""

    def __init__(
        self,
        terms: Mapping[int, BondTerms],
        lots: Iterable[LotData],
        sales: Iterable[SaleData],
        payments: Iterable[PaymentData],
    ) -> None:
        self.terms = dict(terms)
        self.lots = {lot.id: lot for lot in lots}
        self.sales_by_lot: dict[int, list[SaleData]] = defaultdict(list)
        for sale in sorted(sales, key=lambda s: (s.trade_date, s.id)):
            self.sales_by_lot[sale.lot_id].append(sale)
        self.payments = sorted(payments, key=lambda p: (p.pay_date, p.id))
        self.redemption_date: dict[int, date] = {}
        for payment in self.payments:
            if payment.kind == "redemption":
                self.redemption_date.setdefault(payment.instrument_id, payment.pay_date)
        self.flows_by_lot: dict[int, list[CashFlow]] = {lot_id: [] for lot_id in self.lots}
        for lot in self.lots.values():
            self._add_trade_flows(lot)
        for payment in self.payments:
            self._add_payment_flows(payment)
        for flows in self.flows_by_lot.values():
            flows.sort(key=lambda f: f.day)

    # --- quantities and allocation ---

    def open_quantity(self, lot_id: int, day: date) -> Decimal:
        """Units held at the end of `day`."""
        lot = self.lots[lot_id]
        if lot.trade_date > day:
            return Decimal(0)
        redeemed_on = self.redemption_date.get(lot.instrument_id)
        if redeemed_on is not None and redeemed_on <= day:
            return Decimal(0)
        sold = sum(
            (s.quantity for s in self.sales_by_lot[lot_id] if s.trade_date <= day), Decimal(0)
        )
        return lot.quantity - sold

    def allocate(self, payment: PaymentData) -> dict[int, tuple[Decimal, Decimal]]:
        """Splits amount and fee pro rata to units held the day before the payment.

        Returns {lot_id: (amount_uah, fee_uah)}; each column sums exactly to the payment's value,
        rounding leftovers going to the largest holding (lowest id on ties).
        """
        record_day = payment.pay_date - ONE_DAY
        holdings = {
            lot.id: qty
            for lot in self.lots.values()
            if lot.instrument_id == payment.instrument_id
            and (qty := self.open_quantity(lot.id, record_day)) > 0
        }
        if not holdings:
            return {}
        amounts = _split(payment.total_amount_uah, holdings)
        fees = _split(payment.fee_uah, holdings)
        return {lot_id: (amounts[lot_id], fees[lot_id]) for lot_id in holdings}

    def _add_trade_flows(self, lot: LotData) -> None:
        flows = self.flows_by_lot[lot.id]
        flows.append(CashFlow(lot.id, lot.trade_date, "buy", -lot.total_cost_uah, lot.fx_rate))
        if lot.fee_uah:
            flows.append(CashFlow(lot.id, lot.trade_date, "fee", -lot.fee_uah, lot.fx_rate))
        for sale in self.sales_by_lot[lot.id]:
            flows.append(
                CashFlow(lot.id, sale.trade_date, "sell", sale.total_proceeds_uah, sale.fx_rate)
            )
            if sale.fee_uah:
                flows.append(CashFlow(lot.id, sale.trade_date, "fee", -sale.fee_uah, sale.fx_rate))

    def _add_payment_flows(self, payment: PaymentData) -> None:
        for lot_id, (amount, fee) in self.allocate(payment).items():
            flows = self.flows_by_lot[lot_id]
            flows.append(CashFlow(lot_id, payment.pay_date, payment.kind, amount, payment.fx_rate))
            if fee:
                flows.append(CashFlow(lot_id, payment.pay_date, "fee", -fee, payment.fx_rate))

    # --- valuation ---

    def unit_value(self, lot_id: int, day: date) -> Decimal:
        """Amortized clean price plus accrued coupon, per unit, at the end of `day`."""
        lot = self.lots[lot_id]
        terms = self.terms[lot.instrument_id]
        clean_cost = (lot.total_cost_uah - lot.accrued_paid_uah) / lot.quantity
        life = (terms.maturity_date - lot.trade_date).days
        elapsed = min((day - lot.trade_date).days, life)
        clean = clean_cost + (terms.face_value - clean_cost) * Decimal(elapsed) / Decimal(life)
        return clean + accrued_coupon(terms, day)

    def value_uah(self, lot_id: int, day: date) -> Decimal:
        qty = self.open_quantity(lot_id, day)
        return qty * self.unit_value(lot_id, day) if qty > 0 else Decimal(0)

    def _value(self, lot_ids: Iterable[int], day: date, fx_at: FxAt) -> Amount:
        uah = sum((self.value_uah(lot_id, day) for lot_id in lot_ids), Decimal(0))
        return Amount(uah, uah / fx_at(day)) if uah else Amount.zero()

    # --- reporting ---

    def flows(self, lot_ids: Iterable[int], start: date, end: date) -> list[CashFlow]:
        return sorted(
            (f for lot_id in lot_ids for f in self.flows_by_lot[lot_id] if start <= f.day <= end),
            key=lambda f: (f.day, f.lot_id),
        )

    def period_pnl(self, lot_ids: Iterable[int], start: date, end: date, fx_at: FxAt) -> PeriodPnl:
        ids = list(lot_ids)
        opening = self._value(ids, start - ONE_DAY, fx_at)
        closing = self._value(ids, end, fx_at)
        invested = received = Amount.zero()
        for flow in self.flows(ids, start, end):
            amount = Amount(flow.amount_uah, flow.amount_usd)
            if flow.amount_uah < 0:
                invested -= amount
            else:
                received += amount
        pnl = closing - opening + received - invested
        return PeriodPnl(
            opening.rounded(),
            closing.rounded(),
            invested.rounded(),
            received.rounded(),
            pnl.rounded(),
        )

    def xirr(
        self,
        lot_ids: Iterable[int],
        start: date,
        end: date,
        fx_at: FxAt,
        currency: Literal["UAH", "USD"],
    ) -> Decimal | None:
        """Annualized return over the period; None when it cannot be determined."""
        ids = list(lot_ids)
        usd = currency == "USD"
        dated: list[tuple[date, Decimal]] = []
        opening = self._value(ids, start - ONE_DAY, fx_at)
        if opening.uah:
            dated.append((start - ONE_DAY, -(opening.usd if usd else opening.uah)))
        for flow in self.flows(ids, start, end):
            dated.append((flow.day, flow.amount_usd if usd else flow.amount_uah))
        closing = self._value(ids, end, fx_at)
        if closing.uah:
            dated.append((end, closing.usd if usd else closing.uah))
        return xirr(dated)


def accrued_coupon(terms: BondTerms, day: date) -> Decimal:
    """Coupon accrued per unit at the end of `day`, linear between coupon dates."""
    coupons = [item for item in terms.schedule if item.kind == "coupon"]
    previous = max((c.pay_date for c in coupons if c.pay_date <= day), default=terms.issue_date)
    upcoming = next((c for c in coupons if c.pay_date > day), None)
    if upcoming is None or day < terms.issue_date:
        return Decimal(0)
    period = (upcoming.pay_date - previous).days
    return upcoming.amount_per_unit * Decimal((day - previous).days) / Decimal(period)


def _split(total: Decimal, weights: Mapping[int, Decimal]) -> dict[int, Decimal]:
    whole = sum(weights.values(), Decimal(0))
    shares = {key: _cents(total * weight / whole) for key, weight in weights.items()}
    leftover = total - sum(shares.values(), Decimal(0))
    if leftover:
        largest = min(weights, key=lambda key: (-weights[key], key))
        shares[largest] += leftover
    return shares


def xirr(flows: list[tuple[date, Decimal]]) -> Decimal | None:
    """Rate r with sum(cf / (1 + r) ** (days / 365)) == 0, found by bisection.

    None when all flows share one sign, span less than a day, or no root lies in (-99 %, +1000 %).
    """
    if not flows or all(cf >= 0 for _, cf in flows) or all(cf <= 0 for _, cf in flows):
        return None
    first = min(day for day, _ in flows)
    if all(day == first for day, _ in flows):
        return None
    points = [((day - first).days / 365.0, float(cf)) for day, cf in flows]

    def npv(rate: float) -> float:
        return float(sum(cf / (1.0 + rate) ** years for years, cf in points))

    low, high = -0.99, 10.0
    f_low, f_high = npv(low), npv(high)
    if f_low * f_high > 0:
        return None
    for _ in range(200):
        mid = (low + high) / 2
        f_mid = npv(mid)
        if f_low * f_mid <= 0:
            high = mid
        else:
            low, f_low = mid, f_mid
    return Decimal(str(round((low + high) / 2, 6)))
