import logging
import time
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import UpstreamError, ValidationError
from app.repositories import fx as repo
from app.services.nbu_client import NbuUnavailableError, fetch_usd_rate

logger = logging.getLogger(__name__)

MAX_FALLBACK_DAYS = 7
# After a failed NBU call, skip the network for this long so pages don't wait on retries.
NBU_COOLDOWN_SECONDS = 300.0

_nbu_down_until = 0.0


def reset_nbu_cooldown() -> None:
    global _nbu_down_until
    _nbu_down_until = 0.0


def usd_rate(session: Session, day: date) -> Decimal:
    """Official UAH per 1 USD for `day`, from cache or NBU."""
    global _nbu_down_until
    if day > date.today():  # noqa: DTZ011
        raise ValidationError("fx_future_date")
    cached = repo.get_rate(session, "USD", "UAH", day)
    if cached is not None:
        return cached
    if time.monotonic() < _nbu_down_until:
        raise UpstreamError("fx_unavailable")
    base_url = get_settings().nbu_base_url
    try:
        for back in range(MAX_FALLBACK_DAYS + 1):
            rate = fetch_usd_rate(base_url, day - timedelta(days=back))
            if rate is not None:
                rate = rate.quantize(Decimal("0.000001"))
                repo.save_rate(session, "USD", "UAH", day, rate)
                return rate
    except NbuUnavailableError as exc:
        _nbu_down_until = time.monotonic() + NBU_COOLDOWN_SECONDS
        raise UpstreamError("fx_unavailable") from exc
    raise UpstreamError("fx_no_rate")


def usd_rate_for_valuation(session: Session, day: date) -> Decimal:
    """Like `usd_rate`, but when NBU has no answer uses the closest-dated rate already known
    (not cached as official). Raises only when no rate exists anywhere in the database."""
    try:
        return usd_rate(session, day)
    except UpstreamError:
        nearest = repo.nearest_usd_rate(session, day)
        if nearest is None:
            raise
        logger.warning(
            "NBU rate unavailable; using nearest known rate",
            extra={"day": str(day), "rate_date": str(nearest[0])},
        )
        return nearest[1]
