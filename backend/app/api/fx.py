from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.fx import FxRateOut
from app.services import fx as service

router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/{currency}/{day}")
def get_rate(currency: Literal["usd", "eur"], day: date, session: SessionDep) -> FxRateOut:
    """Official NBU rate: UAH per 1 unit of `currency`."""
    return FxRateOut(rate_date=day, rate=service.rate(session, currency.upper(), day))
