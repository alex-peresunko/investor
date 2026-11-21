from fastapi import APIRouter, status

from app.api.deps import SessionDep
from app.schemas.instruments import (
    InstrumentIn,
    InstrumentOut,
    ScheduledPaymentIn,
    ScheduledPaymentOut,
)
from app.services import instruments as service

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("")
def list_instruments(session: SessionDep) -> list[InstrumentOut]:
    return [InstrumentOut.model_validate(i) for i in service.list_instruments(session)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_instrument(data: InstrumentIn, session: SessionDep) -> InstrumentOut:
    return InstrumentOut.model_validate(service.create_instrument(session, data))


@router.get("/{instrument_id}")
def get_instrument(instrument_id: int, session: SessionDep) -> InstrumentOut:
    return InstrumentOut.model_validate(service.get_instrument(session, instrument_id))


@router.put("/{instrument_id}")
def update_instrument(instrument_id: int, data: InstrumentIn, session: SessionDep) -> InstrumentOut:
    return InstrumentOut.model_validate(service.update_instrument(session, instrument_id, data))


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instrument(instrument_id: int, session: SessionDep) -> None:
    service.delete_instrument(session, instrument_id)


@router.get("/{instrument_id}/schedule")
def get_schedule(instrument_id: int, session: SessionDep) -> list[ScheduledPaymentOut]:
    return [
        ScheduledPaymentOut.model_validate(p) for p in service.get_schedule(session, instrument_id)
    ]


@router.put("/{instrument_id}/schedule")
def replace_schedule(
    instrument_id: int, items: list[ScheduledPaymentIn], session: SessionDep
) -> list[ScheduledPaymentOut]:
    return [
        ScheduledPaymentOut.model_validate(p)
        for p in service.replace_schedule(session, instrument_id, items)
    ]


@router.post("/{instrument_id}/schedule/generate")
def regenerate_schedule(instrument_id: int, session: SessionDep) -> list[ScheduledPaymentOut]:
    return [
        ScheduledPaymentOut.model_validate(p)
        for p in service.regenerate_schedule(session, instrument_id)
    ]
