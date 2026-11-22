import logging
import threading
import time
from bisect import bisect_right
from collections import defaultdict
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from functools import partial

from app.core.config import get_settings
from app.core.errors import NotFoundError, UpstreamError, ValidationError
from app.engine.portfolio import BondTerms, accrued_coupon
from app.engine.schedule import ScheduleItem
from app.schemas.market import (
    AuctionOut,
    HolderGroupOut,
    HolderPoint,
    HolderSlice,
    HoldersReport,
    MarketBond,
    MarketBondDetail,
    MarketBonds,
    MarketQuote,
    Repayment,
)
from app.schemas.securities import SecurityOut
from app.services import securities
from app.services.market_data import (
    HOLDERS,
    Auction,
    HolderSnapshot,
    TradeDay,
    parse_auction,
    parse_holders,
    parse_trades,
)
from app.services.nbu_client import (
    NbuUnavailableError,
    fetch_auctions,
    fetch_file,
    fetch_rate_history,
)

logger = logging.getLogger(__name__)

CACHE_SECONDS = 6 * 3600
AUCTION_DAYS = 365
# Auction results can still be corrected for a few days; older days are cached for good.
AUCTION_SETTLED_DAYS = 7
AUCTION_WORKERS = 8
RATE_HISTORY_START = date(2010, 1, 1)
VOLUME_DAYS = 30
CENT = Decimal("0.01")
HUNDRED = Decimal(100)
GROUPS = ("all", "UAH", "USD", "EUR")


class _Cached[T]:
    """Loads once per CACHE_SECONDS; concurrent callers wait for one load."""

    def __init__(self, load: Callable[[], T]) -> None:
        self._load = load
        self._lock = threading.Lock()
        self._value: tuple[float, T] | None = None

    def get(self) -> T:
        with self._lock:
            if self._value is None or time.monotonic() - self._value[0] >= CACHE_SECONDS:
                self._value = (time.monotonic(), self._load())
            return self._value[1]

    def reset(self) -> None:
        with self._lock:
            self._value = None


def _download(url: str) -> bytes:
    try:
        return fetch_file(url)
    except NbuUnavailableError as exc:
        raise UpstreamError("market_unavailable") from exc


def _load_holders() -> list[HolderSnapshot]:
    return parse_holders(_download(get_settings().nbu_holders_url))


def _load_trades() -> dict[str, list[TradeDay]]:
    by_isin: dict[str, list[TradeDay]] = defaultdict(list)
    for trade in parse_trades(_download(get_settings().nbu_trades_url)):
        by_isin[trade.isin].append(trade)
    return dict(by_isin)


@dataclass(frozen=True)
class _Rates:
    days: list[date]
    values: list[Decimal]

    def on(self, day: date) -> Decimal | None:
        """Rate of `day`, or of the closest earlier published day."""
        index = bisect_right(self.days, day)
        return self.values[index - 1] if index else None

    def latest(self) -> Decimal | None:
        return self.values[-1] if self.values else None


def _load_rates(currency: str) -> _Rates:
    try:
        rates = fetch_rate_history(
            get_settings().nbu_rate_history_url,
            currency,
            RATE_HISTORY_START,
            date.today(),  # noqa: DTZ011
        )
    except NbuUnavailableError as exc:
        raise UpstreamError("market_unavailable") from exc
    days = sorted(rates)
    return _Rates(days, [rates[d] for d in days])


_holders = _Cached(_load_holders)
_trades = _Cached(_load_trades)
_rates = {currency: _Cached(partial(_load_rates, currency)) for currency in ("USD", "EUR")}
_auction_days: dict[date, tuple[float, list[Auction]]] = {}
_auction_lock = threading.Lock()


def reset_caches() -> None:
    _holders.reset()
    _trades.reset()
    for cached in _rates.values():
        cached.reset()
    with _auction_lock:
        _auction_days.clear()


def _rate(currency: str, day: date | None = None) -> Decimal:
    if currency == "UAH":
        return Decimal(1)
    rates = _rates[currency].get()
    found = rates.latest() if day is None else rates.on(day)
    if found is None:
        raise UpstreamError("market_unavailable")
    return found


def _auctions_on(day: date) -> list[Auction] | None:
    """None when NBU could not answer; such days are retried on the next request."""
    try:
        rows = fetch_auctions(get_settings().nbu_auctions_url, day)
    except NbuUnavailableError:
        return None
    found: list[Auction] = []
    for row in rows:
        try:
            found.append(parse_auction(row))
        except (KeyError, ValueError, TypeError, ArithmeticError):
            logger.warning("Skipping unreadable NBU auction row", extra={"day": str(day)})
    return found


def auctions(today: date) -> list[AuctionOut]:
    """Primary auctions of the last AUCTION_DAYS days, newest first."""
    weekdays = [
        today - timedelta(days=back)
        for back in range(AUCTION_DAYS)
        if (today - timedelta(days=back)).weekday() < 5
    ]
    now = time.monotonic()
    with _auction_lock:
        missing = [
            day
            for day in weekdays
            if day not in _auction_days
            or (
                (today - day).days < AUCTION_SETTLED_DAYS
                and now - _auction_days[day][0] >= CACHE_SECONDS
            )
        ]
        if missing:
            with ThreadPoolExecutor(AUCTION_WORKERS) as pool:
                fetched = list(zip(missing, pool.map(_auctions_on, missing), strict=True))
            if all(result is None for _, result in fetched) and len(missing) == len(weekdays):
                raise UpstreamError("market_unavailable")
            for day, result in fetched:
                if result is not None:
                    _auction_days[day] = (now, result)
        found = [a for day in weekdays for a in _auction_days.get(day, (0.0, []))[1]]
    found.sort(key=lambda a: (a.day, a.number), reverse=True)
    return [AuctionOut.model_validate(a, from_attributes=True) for a in found]


@dataclass(frozen=True)
class _Bond:
    security: SecurityOut
    outstanding_bonds: int


def _domestic_bonds(today: date) -> dict[str, _Bond]:
    """Domestic (UA ISIN) bonds that have not matured and have a published count."""
    found: dict[str, _Bond] = {}
    for isin, row in securities.raw_securities().items():
        if not isin.startswith("UA") or row.get("total_bonds") is None:
            continue
        try:
            security = securities.parse_security(row)
            count = int(row["total_bonds"])
        except (ValidationError, KeyError, TypeError, ValueError, ArithmeticError):
            continue
        if security.maturity_date >= today and count > 0:
            found[isin] = _Bond(security, count)
    return found


def _terms(security: SecurityOut) -> BondTerms:
    return BondTerms(
        instrument_id=0,
        face_value=security.face_value,
        issue_date=security.issue_date,
        maturity_date=security.maturity_date,
        schedule=tuple(
            ScheduleItem(s.kind, s.pay_date, s.amount_per_unit) for s in security.schedule
        ),
        currency=security.currency,
    )


def _quote(trade: TradeDay, security: SecurityOut, terms: BondTerms) -> MarketQuote:
    dirty = clean = None
    if trade.price_uah is not None:
        try:
            rate = _rate(security.currency, trade.day)
        except UpstreamError:
            rate = None
        if rate:
            per_unit = trade.price_uah / rate
            dirty = (per_unit / security.face_value * HUNDRED).quantize(Decimal("0.0001"))
            accrued = accrued_coupon(terms, trade.day)
            clean = ((per_unit - accrued) / security.face_value * HUNDRED).quantize(
                Decimal("0.0001")
            )
    return MarketQuote(
        day=trade.day,
        deals=trade.deals,
        volume_uah=trade.volume_uah,
        volume_free_uah=trade.volume_free_uah,
        price_uah=trade.price_uah,
        dirty_price=dirty,
        clean_price=clean,
        yield_avg=trade.yield_avg,
        yield_min=trade.yield_min,
        yield_max=trade.yield_max,
    )


def _market_bond(
    bond: _Bond,
    total_uah: Decimal,
    trades: list[TradeDay],
    last_auction: AuctionOut | None,
    instrument_id: int | None,
    today: date,
) -> MarketBond:
    security = bond.security
    outstanding = security.face_value * bond.outstanding_bonds
    outstanding_uah = (outstanding * _rate(security.currency)).quantize(CENT)
    priced = [t for t in trades if t.price_uah is not None]
    since = today - timedelta(days=VOLUME_DAYS)
    return MarketBond(
        isin=security.isin,
        name=security.name,
        currency=security.currency,
        face_value=security.face_value,
        coupon_rate=security.coupon_rate,
        coupon_frequency=security.coupon_frequency,
        variable_rate=security.variable_rate,
        issue_date=security.issue_date,
        maturity_date=security.maturity_date,
        outstanding_bonds=bond.outstanding_bonds,
        outstanding=outstanding,
        outstanding_uah=outstanding_uah,
        market_share=(outstanding_uah / total_uah).quantize(Decimal("0.000001"))
        if total_uah
        else Decimal(0),
        next_payment_date=min(
            (s.pay_date for s in security.schedule if s.pay_date >= today), default=None
        ),
        last_trade=_quote(priced[-1], security, _terms(security)) if priced else None,
        volume_30d_uah=sum(
            (t.volume_uah or Decimal(0) for t in trades if t.day > since), Decimal(0)
        ),
        last_auction=last_auction,
        instrument_id=instrument_id,
    )


def _total_uah(bonds: dict[str, _Bond]) -> Decimal:
    return sum(
        (
            b.security.face_value * b.outstanding_bonds * _rate(b.security.currency)
            for b in bonds.values()
        ),
        Decimal(0),
    )


def _all_auctions(today: date) -> list[AuctionOut]:
    """Auctions, or none when NBU's auction feed is down; the rest of the page still works."""
    try:
        return auctions(today)
    except UpstreamError:
        return []


def bonds(today: date, tracked: dict[str, int]) -> MarketBonds:
    """Every domestic bond outstanding, largest first."""
    domestic = _domestic_bonds(today)
    trades = _trades.get()
    last_auctions: dict[str, AuctionOut] = {}
    for auction in _all_auctions(today):
        last_auctions.setdefault(auction.isin, auction)
    total = _total_uah(domestic)
    rows = [
        _market_bond(
            bond,
            total,
            trades.get(isin, []),
            last_auctions.get(isin),
            tracked.get(isin),
            today,
        )
        for isin, bond in domestic.items()
    ]
    rows.sort(key=lambda b: (-b.outstanding_uah, b.isin))
    latest = max((t.day for days in trades.values() for t in days[-1:]), default=None)
    return MarketBonds(trades_as_of=latest, outstanding_uah=total.quantize(CENT), bonds=rows)


def bond_detail(isin: str, today: date, instrument_id: int | None) -> MarketBondDetail:
    isin = isin.upper()
    domestic = _domestic_bonds(today)
    bond = domestic.get(isin)
    if bond is None:
        raise NotFoundError("security_not_found", isin=isin)
    trades = _trades.get().get(isin, [])
    bond_auctions = [a for a in _all_auctions(today) if a.isin == isin]
    terms = _terms(bond.security)
    return MarketBondDetail(
        bond=_market_bond(
            bond,
            _total_uah(domestic),
            trades,
            bond_auctions[0] if bond_auctions else None,
            instrument_id,
            today,
        ),
        schedule=bond.security.schedule,
        trades=[_quote(t, bond.security, terms) for t in trades],
        auctions=bond_auctions,
    )


def repayments(today: date) -> list[Repayment]:
    """Remaining scheduled payments on every domestic bond, assuming today's amount outstanding."""
    found: list[Repayment] = []
    for bond in _domestic_bonds(today).values():
        security = bond.security
        rate = _rate(security.currency)
        for item in security.schedule:
            if item.pay_date < today:
                continue
            amount = (item.amount_per_unit * bond.outstanding_bonds).quantize(CENT)
            found.append(
                Repayment(
                    pay_date=item.pay_date,
                    isin=security.isin,
                    name=security.name,
                    currency=security.currency,
                    kind=item.kind,
                    amount=amount,
                    amount_uah=(amount * rate).quantize(CENT),
                )
            )
    found.sort(key=lambda r: (r.pay_date, r.isin, r.kind))
    return found


def _change(now: Decimal, base: Decimal | None) -> Decimal | None:
    return None if base is None else now - base


def holders() -> HoldersReport:
    snapshots = _holders.get()
    if not snapshots:
        raise UpstreamError("market_unavailable")
    by_key = {(s.day, s.group): s for s in snapshots}
    days = sorted({s.day for s in snapshots})
    latest = days[-1]
    month_base = max((d for d in days if d < latest.replace(day=1)), default=None)
    year_base = max((d for d in days if d < date(latest.year, 1, 1)), default=None)

    def amount(day: date | None, group: str, holder: str | None) -> Decimal | None:
        snapshot = by_key.get((day, group)) if day else None
        if snapshot is None:
            return None
        return snapshot.total if holder is None else snapshot.by_holder[holder]

    groups: list[HolderGroupOut] = []
    for group in GROUPS:
        current = by_key.get((latest, group))
        if current is None:
            continue
        groups.append(
            HolderGroupOut(
                group=group,
                total=current.total,
                change_month=_change(current.total, amount(month_base, group, None)),
                change_year=_change(current.total, amount(year_base, group, None)),
                holders=[
                    HolderSlice(
                        holder=holder,
                        amount=current.by_holder[holder],
                        share=(current.by_holder[holder] / current.total).quantize(
                            Decimal("0.000001")
                        )
                        if current.total
                        else Decimal(0),
                        change_month=_change(
                            current.by_holder[holder], amount(month_base, group, holder)
                        ),
                        change_year=_change(
                            current.by_holder[holder], amount(year_base, group, holder)
                        ),
                    )
                    for holder in HOLDERS
                ],
            )
        )
    month_ends: dict[tuple[int, int], date] = {}
    for day in days:
        month_ends[(day.year, day.month)] = day
    history = [
        HolderPoint(day=s.day, group=s.group, total=s.total, by_holder=s.by_holder)
        for day in sorted(month_ends.values())
        for group in GROUPS
        if (s := by_key.get((day, group))) is not None
    ]
    return HoldersReport(
        day=latest,
        month_base_day=month_base,
        year_base_day=year_base,
        groups=groups,
        history=history,
    )
