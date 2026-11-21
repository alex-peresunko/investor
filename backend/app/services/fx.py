from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import UpstreamError, ValidationError
from app.repositories import fx as repo
from app.services.nbu_client import NbuUnavailableError, fetch_usd_rate

MAX_FALLBACK_DAYS = 7


def usd_rate(session: Session, day: date) -> Decimal:
    """Official UAH per 1 USD for `day`, from cache or NBU."""
    if day > date.today():  # noqa: DTZ011
        raise ValidationError("fx_future_date")
    cached = repo.get_rate(session, "USD", "UAH", day)
    if cached is not None:
        return cached
    base_url = get_settings().nbu_base_url
    try:
        for back in range(MAX_FALLBACK_DAYS + 1):
            rate = fetch_usd_rate(base_url, day - timedelta(days=back))
            if rate is not None:
                rate = rate.quantize(Decimal("0.000001"))
                repo.save_rate(session, "USD", "UAH", day, rate)
                return rate
    except NbuUnavailableError as exc:
        raise UpstreamError("fx_unavailable") from exc
    raise UpstreamError("fx_no_rate")
