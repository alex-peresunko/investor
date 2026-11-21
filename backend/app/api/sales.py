from fastapi import APIRouter, status

from app.api.deps import SessionDep
from app.schemas.operations import SaleIn, SaleOut
from app.services import operations as service

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("")
def list_sales(session: SessionDep, lot_id: int | None = None) -> list[SaleOut]:
    return [SaleOut.model_validate(x) for x in service.list_sales(session, lot_id)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_sale(data: SaleIn, session: SessionDep) -> SaleOut:
    return SaleOut.model_validate(service.create_sale(session, data))


@router.get("/{sale_id}")
def get_sale(sale_id: int, session: SessionDep) -> SaleOut:
    return SaleOut.model_validate(service.get_sale(session, sale_id))


@router.put("/{sale_id}")
def update_sale(sale_id: int, data: SaleIn, session: SessionDep) -> SaleOut:
    return SaleOut.model_validate(service.update_sale(session, sale_id, data))


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(sale_id: int, session: SessionDep) -> None:
    service.delete_sale(session, sale_id)
