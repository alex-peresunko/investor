from fastapi import APIRouter, status

from app.api.deps import SessionDep
from app.schemas.operations import PaymentIn, PaymentOut
from app.services import operations as service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("")
def list_payments(session: SessionDep, instrument_id: int | None = None) -> list[PaymentOut]:
    return [PaymentOut.model_validate(x) for x in service.list_payments(session, instrument_id)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_payment(data: PaymentIn, session: SessionDep) -> PaymentOut:
    return PaymentOut.model_validate(service.create_payment(session, data))


@router.get("/{payment_id}")
def get_payment(payment_id: int, session: SessionDep) -> PaymentOut:
    return PaymentOut.model_validate(service.get_payment(session, payment_id))


@router.put("/{payment_id}")
def update_payment(payment_id: int, data: PaymentIn, session: SessionDep) -> PaymentOut:
    return PaymentOut.model_validate(service.update_payment(session, payment_id, data))


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, session: SessionDep) -> None:
    service.delete_payment(session, payment_id)
