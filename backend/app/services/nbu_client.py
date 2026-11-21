import json
import logging
from datetime import date
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)

ATTEMPTS = 3
TIMEOUT_SECONDS = 5.0


class NbuUnavailableError(Exception):
    pass


def fetch_usd_rate(base_url: str, day: date) -> Decimal | None:
    """Official UAH per 1 USD for `day`, or None when NBU has not published it."""
    params = {"valcode": "USD", "date": day.strftime("%Y%m%d"), "json": ""}
    last_error: Exception | None = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            response = httpx.get(base_url, params=params, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()
            # parse_float keeps the published rate exact instead of rounding through float.
            rows = json.loads(response.text, parse_float=Decimal)
            if not rows:
                return None
            return Decimal(rows[0]["rate"])
        except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning("NBU rate fetch failed", extra={"attempt": attempt, "day": str(day)})
    raise NbuUnavailableError(str(last_error))
