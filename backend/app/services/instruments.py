from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.engine.schedule import generate_schedule
from app.models import Instrument, ScheduledPayment
from app.repositories import instruments as repo
from app.schemas.instruments import InstrumentIn, ScheduledPaymentIn


def list_instruments(session: Session) -> Sequence[Instrument]:
    return repo.list_all(session)


def get_instrument(session: Session, instrument_id: int) -> Instrument:
    instrument = repo.get(session, instrument_id)
    if instrument is None:
        raise NotFoundError("bond_not_found", id=instrument_id)
    return instrument


def create_instrument(session: Session, data: InstrumentIn) -> Instrument:
    if repo.get_by_isin(session, data.isin) is not None:
        raise ConflictError("bond_exists", isin=data.isin)
    instrument = Instrument(kind="bond", **data.model_dump())
    session.add(instrument)
    session.flush()
    regenerate_schedule(session, instrument.id)
    session.refresh(instrument)
    return instrument


def update_instrument(session: Session, instrument_id: int, data: InstrumentIn) -> Instrument:
    instrument = get_instrument(session, instrument_id)
    other = repo.get_by_isin(session, data.isin)
    if other is not None and other.id != instrument_id:
        raise ConflictError("bond_exists", isin=data.isin)
    for field, value in data.model_dump().items():
        setattr(instrument, field, value)
    session.flush()
    session.refresh(instrument)
    return instrument


def delete_instrument(session: Session, instrument_id: int) -> None:
    instrument = get_instrument(session, instrument_id)
    if repo.has_operations(session, instrument_id):
        raise ConflictError("bond_has_operations")
    session.delete(instrument)
    session.flush()


def get_schedule(session: Session, instrument_id: int) -> list[ScheduledPayment]:
    return list(get_instrument(session, instrument_id).schedule)


def replace_schedule(
    session: Session, instrument_id: int, items: Sequence[ScheduledPaymentIn]
) -> list[ScheduledPayment]:
    instrument = get_instrument(session, instrument_id)
    keys = [(item.pay_date, item.kind) for item in items]
    if len(keys) != len(set(keys)):
        raise ValidationError("schedule_duplicate_date")
    if sum(1 for item in items if item.kind == "redemption") > 1:
        raise ValidationError("schedule_multiple_redemptions")
    instrument.schedule.clear()
    session.flush()
    instrument.schedule.extend(
        ScheduledPayment(**item.model_dump())
        for item in sorted(items, key=lambda i: (i.pay_date, i.kind))
    )
    session.flush()
    for item in instrument.schedule:
        session.refresh(item)
    return list(instrument.schedule)


def regenerate_schedule(session: Session, instrument_id: int) -> list[ScheduledPayment]:
    instrument = get_instrument(session, instrument_id)
    generated = generate_schedule(
        instrument.face_value,
        instrument.coupon_rate,
        instrument.coupon_frequency,
        instrument.issue_date,
        instrument.maturity_date,
    )
    return replace_schedule(
        session,
        instrument_id,
        [
            ScheduledPaymentIn(
                kind=item.kind, pay_date=item.pay_date, amount_per_unit=item.amount_per_unit
            )
            for item in generated
        ],
    )
