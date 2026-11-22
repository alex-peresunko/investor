from datetime import date

from fastapi import APIRouter

from app.schemas.securities import SecurityOut, SecuritySummary
from app.services import securities as service

router = APIRouter(prefix="/securities", tags=["securities"])


@router.get("")
def list_securities() -> list[SecuritySummary]:
    """Government bonds from the NBU depository list that have not matured yet."""
    return service.available(date.today())  # noqa: DTZ011


@router.get("/{isin}")
def get_security(isin: str) -> SecurityOut:
    """Terms and payment schedule of a government bond from the NBU depository list."""
    return service.lookup(isin)
