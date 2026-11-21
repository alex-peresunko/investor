from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response

from app.api.deps import SessionDep
from app.schemas.reports import LotReport, PortfolioReport, TimeseriesPoint, UpcomingPayment
from app.services import export
from app.services import reports as service

router = APIRouter(tags=["reports"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/reports/portfolio")
def portfolio(
    session: SessionDep, start: date | None = None, end: date | None = None
) -> PortfolioReport:
    return service.portfolio_report(session, start, end)


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


@router.get("/export/operations.csv")
def operations_csv(session: SessionDep) -> Response:
    return Response(
        export.operations_csv(session),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="operations.csv"'},
    )


@router.get("/export/operations.xlsx")
def operations_xlsx(session: SessionDep) -> Response:
    return Response(
        export.operations_xlsx(session),
        media_type=XLSX,
        headers={"Content-Disposition": 'attachment; filename="operations.xlsx"'},
    )


@router.get("/export/portfolio.xlsx")
def portfolio_xlsx(
    session: SessionDep, start: date | None = None, end: date | None = None
) -> Response:
    return Response(
        export.portfolio_xlsx(session, start, end),
        media_type=XLSX,
        headers={"Content-Disposition": 'attachment; filename="portfolio.xlsx"'},
    )
