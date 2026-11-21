from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import FxRate


def get_rate(session: Session, base: str, quote: str, day: date) -> Decimal | None:
    row = session.get(FxRate, (base, quote, day))
    return row.rate if row is not None else None


def save_rate(session: Session, base: str, quote: str, day: date, rate: Decimal) -> None:
    session.merge(FxRate(base=base, quote=quote, rate_date=day, rate=rate))
    session.flush()
