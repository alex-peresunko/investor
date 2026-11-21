from fastapi import APIRouter, status

from app.api.deps import SessionDep
from app.schemas.operations import LotIn, LotOut
from app.services import operations as service

router = APIRouter(prefix="/lots", tags=["lots"])


@router.get("")
def list_lots(session: SessionDep, instrument_id: int | None = None) -> list[LotOut]:
    return [LotOut.model_validate(x) for x in service.list_lots(session, instrument_id)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lot(data: LotIn, session: SessionDep) -> LotOut:
    return LotOut.model_validate(service.create_lot(session, data))


@router.get("/{lot_id}")
def get_lot(lot_id: int, session: SessionDep) -> LotOut:
    return LotOut.model_validate(service.get_lot(session, lot_id))


@router.put("/{lot_id}")
def update_lot(lot_id: int, data: LotIn, session: SessionDep) -> LotOut:
    return LotOut.model_validate(service.update_lot(session, lot_id, data))


@router.delete("/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot(lot_id: int, session: SessionDep) -> None:
    service.delete_lot(session, lot_id)
