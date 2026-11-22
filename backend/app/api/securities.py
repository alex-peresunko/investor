from fastapi import APIRouter

from app.schemas.securities import SecurityOut
from app.services import securities as service

router = APIRouter(prefix="/securities", tags=["securities"])


@router.get("/{isin}")
def get_security(isin: str) -> SecurityOut:
    """Terms and payment schedule of a government bond from the NBU depository list."""
    return service.lookup(isin)
