from collections.abc import Sequence

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import Instrument, Lot, Payment


def list_all(session: Session) -> Sequence[Instrument]:
    return session.scalars(
        select(Instrument).order_by(Instrument.maturity_date, Instrument.isin)
    ).all()


def get(session: Session, instrument_id: int) -> Instrument | None:
    return session.get(Instrument, instrument_id)


def get_by_isin(session: Session, isin: str) -> Instrument | None:
    return session.scalars(select(Instrument).where(Instrument.isin == isin)).first()


def has_operations(session: Session, instrument_id: int) -> bool:
    return bool(
        session.scalar(
            select(
                exists().where(Lot.instrument_id == instrument_id)
                | exists().where(Payment.instrument_id == instrument_id)
            )
        )
    )
