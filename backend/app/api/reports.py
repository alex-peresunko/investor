from datetime import date
from decimal import Decimal

from fastapi import APIRouter
from fastapi.responses import Response

from app.api.deps import SessionDep
from app.core.i18n import DEFAULT_LANGUAGE, Language
from app.engine.planner import LadderPeriod
from app.repositories import instruments as instrument_repo
from app.schemas.common import Currency
from app.schemas.planner import PurchasePlan
from app.schemas.reports import (
    BenchmarkReport,
    LotReport,
    MissedPayment,
    PortfolioReport,
    ReceivedPayment,
    TimeseriesPoint,
    UpcomingPayment,
)
from app.services import export, planner
from app.services import reports as service

router = APIRouter(tags=["reports"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/reports/portfolio")
def portfolio(
    session: SessionDep, start: date | None = None, end: date | None = None
) -> PortfolioReport:
    return service.portfolio_report(session, start, end)


@router.get("/reports/benchmark")
def benchmark(
    session: SessionDep,
    deposit_rate: Decimal,
    start: date | None = None,
    end: date | None = None,
) -> BenchmarkReport:
    """deposit_rate is a fraction a year, e.g. 0.12 for 12 %."""
    return service.benchmark(session, start, end, deposit_rate)


@router.get("/reports/lots/{lot_id}")
def lot(
    lot_id: int, session: SessionDep, start: date | None = None, end: date | None = None
) -> LotReport:
    return service.lot_report(session, lot_id, start, end)


@router.get("/reports/timeseries")
def timeseries(
    session: SessionDep,
    start: date | None = None,
    end: date | None = None,
    lot_id: int | None = None,
) -> list[TimeseriesPoint]:
    return service.timeseries(session, start, end, lot_id)


@router.get("/reports/upcoming")
def upcoming(session: SessionDep, months: int = 12) -> list[UpcomingPayment]:
    return service.upcoming(session, months)


@router.get("/reports/plan")
def plan(
    session: SessionDep,
    currency: Currency = "UAH",
    years: int = 3,
    period: LadderPeriod = "year",
    extra_now: Decimal = Decimal(0),
    extra_monthly: Decimal = Decimal(0),
    min_yield: Decimal | None = None,
    min_purchase: Decimal = Decimal(0),
) -> PurchasePlan:
    """Bonds to buy, and when, so coupons come evenly each month and redemptions evenly each
    period. Amounts are in `currency`; min_yield is a fraction a year, e.g. 0.15."""
    tracked = {i.isin: i.id for i in instrument_repo.list_all(session)}
    return planner.plan(
        session,
        currency=currency,
        years=years,
        period=period,
        extra_now=extra_now,
        extra_monthly=extra_monthly,
        min_yield=min_yield,
        min_purchase=min_purchase,
        tracked=tracked,
    )


@router.get("/reports/missed")
def missed(session: SessionDep) -> list[MissedPayment]:
    """Scheduled payments already due on bonds held at the time, with no payment recorded."""
    return service.missed(session)


@router.get("/reports/received")
def received(
    session: SessionDep, start: date | None = None, end: date | None = None
) -> list[ReceivedPayment]:
    return service.received(session, start, end)


@router.get("/export/operations.csv")
def operations_csv(session: SessionDep, lang: Language = DEFAULT_LANGUAGE) -> Response:
    return Response(
        export.operations_csv(session, lang),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="operations.csv"'},
    )


@router.get("/export/operations.xlsx")
def operations_xlsx(session: SessionDep, lang: Language = DEFAULT_LANGUAGE) -> Response:
    return Response(
        export.operations_xlsx(session, lang),
        media_type=XLSX,
        headers={"Content-Disposition": 'attachment; filename="operations.xlsx"'},
    )


@router.get("/export/portfolio.xlsx")
def portfolio_xlsx(
    session: SessionDep,
    start: date | None = None,
    end: date | None = None,
    lang: Language = DEFAULT_LANGUAGE,
) -> Response:
    return Response(
        export.portfolio_xlsx(session, start, end, lang),
        media_type=XLSX,
        headers={"Content-Disposition": 'attachment; filename="portfolio.xlsx"'},
    )
