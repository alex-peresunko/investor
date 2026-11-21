from datetime import date

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.fx import FxRateOut
from app.services import fx as service

router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/usd/{day}")
def get_usd_rate(day: date, session: SessionDep) -> FxRateOut:
    return FxRateOut(rate_date=day, rate=service.usd_rate(session, day))
