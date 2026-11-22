import json
import logging
from datetime import date
from decimal import Decimal
from typing import Any

import httpx

logger = logging.getLogger(__name__)

ATTEMPTS = 3
TIMEOUT_SECONDS = 5.0
# The securities list is several hundred kilobytes.
SECURITIES_TIMEOUT_SECONDS = 30.0


class NbuUnavailableError(Exception):
    pass


def fetch_rate(base_url: str, currency: str, day: date) -> Decimal | None:
    """Official UAH per 1 unit of `currency` for `day`, or None when NBU has not published it."""
    params = {"valcode": currency, "date": day.strftime("%Y%m%d"), "json": ""}
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


def fetch_securities(url: str) -> list[dict[str, Any]]:
    """Every government security NBU keeps in its depository, as published (JSON objects)."""
    try:
        response = httpx.get(url, timeout=SECURITIES_TIMEOUT_SECONDS)
        response.raise_for_status()
        rows = json.loads(response.text, parse_float=Decimal)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("NBU securities fetch failed")
        raise NbuUnavailableError(str(exc)) from exc
    if not isinstance(rows, list):
        raise NbuUnavailableError("unexpected securities payload")
    return rows


# The depositary spreadsheets are several megabytes.
FILE_TIMEOUT_SECONDS = 60.0


def fetch_file(url: str) -> bytes:
    try:
        response = httpx.get(url, timeout=FILE_TIMEOUT_SECONDS, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("NBU file fetch failed", extra={"url": url})
        raise NbuUnavailableError(str(exc)) from exc
    return response.content


def fetch_auctions(url: str, day: date) -> list[dict[str, Any]]:
    """Primary auctions held on `day`; empty when there were none."""
    params = {"json": "", "date": day.strftime("%d.%m.%Y")}
    try:
        response = httpx.get(url, params=params, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        rows = json.loads(response.text, parse_float=Decimal)
    except (httpx.HTTPError, ValueError) as exc:
        raise NbuUnavailableError(str(exc)) from exc
    if not isinstance(rows, list):
        raise NbuUnavailableError("unexpected auctions payload")
    return rows


def fetch_rate_history(url: str, currency: str, start: date, end: date) -> dict[date, Decimal]:
    """Official UAH per 1 unit of `currency` for every published day in [start, end]."""
    params = {
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "valcode": currency.lower(),
        "sort": "exchangedate",
        "order": "asc",
        "json": "",
    }
    try:
        response = httpx.get(url, params=params, timeout=SECURITIES_TIMEOUT_SECONDS)
        response.raise_for_status()
        rows = json.loads(response.text, parse_float=Decimal)
        return {
            date(*map(int, reversed(row["exchangedate"].split(".")))): Decimal(row["rate_per_unit"])
            for row in rows
        }
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.warning("NBU rate history fetch failed", extra={"currency": currency})
        raise NbuUnavailableError(str(exc)) from exc
