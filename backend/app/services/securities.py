import time
from collections import Counter
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from itertools import pairwise
from typing import Any, get_args

from app.core.config import get_settings
from app.core.errors import NotFoundError, UpstreamError, ValidationError
from app.schemas.common import Currency
from app.schemas.securities import SecurityOut, SecurityPayment, SecuritySummary
from app.services.nbu_client import NbuUnavailableError, fetch_securities

CACHE_SECONDS = 6 * 3600
FREQUENCIES = (1, 2, 4, 12)
# pay_type in NBU's payment rows.
COUPON, REDEMPTION = "1", "2"

_cache: tuple[float, dict[str, dict[str, Any]]] | None = None


def reset_cache() -> None:
    global _cache
    _cache = None


def raw_securities() -> dict[str, dict[str, Any]]:
    """NBU depository records by ISIN, as published."""
    global _cache
    if _cache is not None and time.monotonic() - _cache[0] < CACHE_SECONDS:
        return _cache[1]
    try:
        rows = fetch_securities(get_settings().nbu_securities_url)
    except NbuUnavailableError as exc:
        raise UpstreamError("securities_unavailable") from exc
    by_isin = {str(row["cpcode"]): row for row in rows if "cpcode" in row}
    _cache = (time.monotonic(), by_isin)
    return by_isin


def lookup(isin: str) -> SecurityOut:
    row = raw_securities().get(isin.upper())
    if row is None:
        raise NotFoundError("security_not_found", isin=isin)
    return parse_security(row)


def available(today: date) -> list[SecuritySummary]:
    """Bonds in a supported currency that have not matured, soonest maturity first."""
    found: list[SecuritySummary] = []
    for row in raw_securities().values():
        try:
            security = parse_security(row)
        except (ValidationError, KeyError, TypeError, ValueError, ArithmeticError):
            continue
        if security.maturity_date >= today:
            found.append(SecuritySummary.model_validate(security, from_attributes=True))
    return sorted(found, key=lambda s: (s.maturity_date, s.isin))


def _frequency(row: dict[str, Any], coupon_dates: list[date]) -> int:
    """Coupons per year from NBU's pay_period (days), else from the gaps between coupon dates."""
    period = row.get("pay_period")
    if not period and len(coupon_dates) > 1:
        gaps = [(b - a).days for a, b in pairwise(coupon_dates)]
        period = sorted(gaps)[len(gaps) // 2]
    if not period:
        return 1
    per_year = 365 / float(period)
    return min(FREQUENCIES, key=lambda f: abs(f - per_year))


def parse_security(row: dict[str, Any]) -> SecurityOut:
    """Maps one NBU depository record; the coupon rate comes from the most common coupon amount,
    since auk_proc is the auction yield for discount bonds."""
    isin = str(row["cpcode"])
    currency = str(row.get("val_code", ""))
    if currency not in get_args(Currency):
        raise ValidationError("security_unsupported", isin=isin, currency=currency or "?")
    face_value = Decimal(str(row["nominal"]))
    maturity = date.fromisoformat(row["pgs_date"])
    seen: set[tuple[date, str]] = set()
    schedule: list[SecurityPayment] = []
    for payment in row.get("payments", []):
        kind = {COUPON: "coupon", REDEMPTION: "redemption"}.get(str(payment.get("pay_type")))
        amount = Decimal(str(payment.get("pay_val", 0)))
        if kind is None or amount <= 0:
            continue
        pay_date = date.fromisoformat(payment["pay_date"])
        if (pay_date, kind) in seen:
            continue
        seen.add((pay_date, kind))
        schedule.append(SecurityPayment(kind=kind, pay_date=pay_date, amount_per_unit=amount))
    schedule.sort(key=lambda s: (s.pay_date, s.kind))
    if not any(s.kind == "redemption" for s in schedule):
        schedule.append(
            SecurityPayment(kind="redemption", pay_date=maturity, amount_per_unit=face_value)
        )
    coupons = [s for s in schedule if s.kind == "coupon"]
    if coupons:
        frequency = _frequency(row, [c.pay_date for c in coupons])
        typical = Counter(c.amount_per_unit for c in coupons).most_common(1)[0][0]
        rate = (typical * frequency / face_value).quantize(Decimal("0.000001"), ROUND_HALF_UP)
    else:
        frequency, rate = 0, Decimal(0)
    prefix = "OVDP" if currency == "UAH" else f"OVDP {currency}"
    name = (
        f"{prefix} {rate * 100:.2f}% {maturity:%m/%Y}"
        if rate
        else f"{prefix} discount {maturity:%m/%Y}"
    )
    return SecurityOut(
        isin=isin,
        name=name,
        currency=currency,
        face_value=face_value,
        coupon_rate=rate,
        coupon_frequency=frequency,
        issue_date=date.fromisoformat(row["razm_date"]),
        maturity_date=maturity,
        schedule=schedule,
        variable_rate=str(row.get("cpcode_cfi", ""))[2:3] == "V",
    )
