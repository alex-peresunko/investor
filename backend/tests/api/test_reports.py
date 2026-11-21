import io
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.services import portfolio_loader

BOND = {
    "isin": "UA4000200000",
    "name": "Test bond",
    "face_value": "1000",
    "coupon_rate": "0.1",
    "coupon_frequency": 2,
    "issue_date": "2025-01-01",
    "maturity_date": "2026-01-01",
}


@pytest.fixture(autouse=True)
def constant_rate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(portfolio_loader, "usd_rate", lambda _session, _day: Decimal("43"))


def _post(client: TestClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post(path, json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def _interview_example(client: TestClient) -> int:
    """Buy 100 000 UAH at 41, coupon 5 000 at 41.5, redemption 100 000 at 42. Returns lot id."""
    bond = _post(client, "/api/v1/instruments", BOND)
    lot = _post(
        client,
        "/api/v1/lots",
        {
            "instrument_id": bond["id"],
            "trade_date": "2025-01-02",
            "quantity": "100",
            "price_per_unit": "1000",
            "total_cost_uah": "100000",
            "fx_rate": "41",
        },
    )
    _post(
        client,
        "/api/v1/payments",
        {
            "instrument_id": bond["id"],
            "kind": "coupon",
            "pay_date": "2025-07-01",
            "total_amount_uah": "5000",
            "fx_rate": "41.5",
        },
    )
    _post(
        client,
        "/api/v1/payments",
        {
            "instrument_id": bond["id"],
            "kind": "redemption",
            "pay_date": "2026-01-01",
            "total_amount_uah": "100000",
            "fx_rate": "42",
        },
    )
    return int(lot["id"])


def test_portfolio_report_interview_example(client: TestClient) -> None:
    _interview_example(client)
    response = client.get("/api/v1/reports/portfolio?start=2025-01-01&end=2026-01-31")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["totals"]["pnl"]["uah"] == "5000.00"
    assert body["totals"]["pnl"]["usd"] == "62.41"
    assert body["totals"]["closing_value"]["uah"] == "0.00"
    assert len(body["lots"]) == 1
    assert Decimal(body["lots"][0]["open_quantity"]) == 0
    assert body["lots"][0]["isin"] == "UA4000200000"
    assert body["realized"] == {"uah": "5000.00", "usd": "62.41"}
    assert body["unrealized"] == {"uah": "0.00", "usd": "0.00"}


def test_lot_report_lists_flows(client: TestClient) -> None:
    lot_id = _interview_example(client)
    response = client.get(f"/api/v1/reports/lots/{lot_id}?end=2026-01-31")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["start"] == "2025-01-02"
    assert [f["kind"] for f in body["flows"]] == ["buy", "coupon", "redemption"]
    assert body["flows"][0]["amount_uah"] == "-100000.00"
    assert body["flows"][1]["amount_usd"] == "120.48"


def test_lot_report_unknown_lot_404(client: TestClient) -> None:
    response = client.get("/api/v1/reports/lots/999")
    assert response.status_code == 404


def test_end_before_start_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/reports/portfolio?start=2025-02-01&end=2025-01-01")
    assert response.status_code == 422


def test_empty_portfolio(client: TestClient) -> None:
    response = client.get("/api/v1/reports/portfolio")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["lots"] == []
    assert body["totals"]["pnl"]["uah"] == "0.00"
    assert body["xirr_uah"] is None


def test_timeseries_month_ends(client: TestClient) -> None:
    _interview_example(client)
    response = client.get("/api/v1/reports/timeseries?start=2025-01-01&end=2025-03-15")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [p["day"] for p in body] == ["2025-01-01", "2025-01-31", "2025-02-28", "2025-03-15"]
    assert body[0]["value"]["uah"] == "0.00"
    assert Decimal(body[1]["value"]["uah"]) > 0


def test_upcoming_empty_without_holdings(client: TestClient) -> None:
    _interview_example(client)
    response = client.get("/api/v1/reports/upcoming")
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_exports(client: TestClient) -> None:
    _interview_example(client)

    csv_response = client.get("/api/v1/export/operations.csv")
    assert csv_response.status_code == 200
    lines = [line for line in csv_response.text.splitlines() if line]
    assert lines[0].startswith("date,type,isin")
    assert len(lines) == 4

    xlsx_response = client.get("/api/v1/export/operations.xlsx")
    assert xlsx_response.status_code == 200
    operations = load_workbook(io.BytesIO(xlsx_response.content))["Operations"]
    assert operations.max_row == 4

    pnl_response = client.get("/api/v1/export/portfolio.xlsx?start=2025-01-01&end=2026-01-31")
    assert pnl_response.status_code == 200
    pnl = load_workbook(io.BytesIO(pnl_response.content))["P&L"]
    assert pnl.cell(row=pnl.max_row, column=1).value == "TOTAL"


def test_open_package_pnl_is_unrealized(client: TestClient) -> None:
    _interview_example(client)
    response = client.get("/api/v1/reports/portfolio?start=2025-01-01&end=2025-03-31")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["realized"] == {"uah": "0.00", "usd": "0.00"}
    assert body["unrealized"] == body["totals"]["pnl"]
    assert Decimal(body["unrealized"]["uah"]) != 0
