from datetime import date
from decimal import Decimal

import httpx
import respx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.demo import has_data, isin, seed
from app.models import Lot, Payment, Sale
from app.services.preferences import get_preferences
from app.services.reports import portfolio_report, upcoming

NBU = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange"


def test_isin_check_digit_matches_a_real_isin() -> None:
    assert isin("2704") == "UA4000227045"


@respx.mock
def test_seed_builds_a_consistent_portfolio(session: Session) -> None:
    respx.get(NBU).mock(
        return_value=httpx.Response(200, text='[{"r030":840,"rate":41.5,"cc":"USD"}]')
    )
    today = date.today()  # noqa: DTZ011
    assert not has_data(session)
    seed(session, today)
    assert has_data(session)
    assert get_preferences(session).demo

    assert session.scalar(select(func.count()).select_from(Lot)) == 12
    assert session.scalar(select(func.count()).select_from(Sale)) == 3
    kinds = dict(session.execute(select(Payment.kind, func.count()).group_by(Payment.kind)).all())
    assert kinds["redemption"] == 2
    assert kinds["coupon"] >= 10

    report = portfolio_report(session, None, today)
    assert report.totals.pnl.uah > Decimal(0)
    assert report.realized.uah > Decimal(0)
    assert report.unrealized.uah > Decimal(0)
    assert report.xirr_uah is not None and Decimal("0.10") < report.xirr_uah < Decimal("0.25")
    assert upcoming(session, 12)
