from datetime import date

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.repositories import instruments as instrument_repo
from app.schemas.market import (
    AuctionOut,
    HoldersReport,
    MarketBondDetail,
    MarketBonds,
    Repayment,
)
from app.services import market as service

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/bonds")
def bonds(session: SessionDep) -> MarketBonds:
    """Domestic government bonds outstanding, with the latest NBU trading and auction data."""
    tracked = {i.isin: i.id for i in instrument_repo.list_all(session)}
    return service.bonds(date.today(), tracked)  # noqa: DTZ011


@router.get("/bonds/{isin}")
def bond(isin: str, session: SessionDep) -> MarketBondDetail:
    instrument = instrument_repo.get_by_isin(session, isin.upper())
    return service.bond_detail(isin, date.today(), instrument.id if instrument else None)  # noqa: DTZ011


@router.get("/holders")
def holders() -> HoldersReport:
    """Principal outstanding by holder group, from the NBU depositary."""
    return service.holders()


@router.get("/auctions")
def auctions() -> list[AuctionOut]:
    """Primary auctions of the last year, newest first."""
    return service.auctions(date.today())  # noqa: DTZ011


@router.get("/repayments")
def repayments() -> list[Repayment]:
    """Remaining coupons and redemptions of every domestic bond on today's amount outstanding."""
    return service.repayments(date.today())  # noqa: DTZ011
