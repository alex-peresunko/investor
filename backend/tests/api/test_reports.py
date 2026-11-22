import io
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.services import portfolio_loader
from tests.factories import make_instrument, make_lot

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
    monkeypatch.setattr(
        portfolio_loader, "rate_for_valuation", lambda _session, _currency, _day: Decimal("43")
    )


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
            "total_cost": "100000",
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
            "total_amount": "5000",
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
            "total_amount": "100000",
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
    assert body["realized_xirr_uah"] == body["xirr_uah"]
    assert body["realized_xirr_usd"] == body["xirr_usd"]


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
    assert body["realized_xirr_uah"] is None


def test_received_payments_in_period(client: TestClient) -> None:
    lot_id = _interview_example(client)
    response = client.get("/api/v1/reports/received?start=2025-01-01&end=2026-01-31")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [(p["kind"], p["pay_date"]) for p in body] == [
        ("coupon", "2025-07-01"),
        ("redemption", "2026-01-01"),
    ]
    assert body[0]["amount_usd"] == "120.48"
    assert Decimal(body[0]["quantity"]) == 100
    assert body[0]["allocations"][0]["lot_id"] == lot_id
    assert body[0]["allocations"][0]["amount"] == "5000.00"
    later = client.get("/api/v1/reports/received?start=2025-08-01&end=2026-01-31").json()
    assert [p["kind"] for p in later] == ["redemption"]


def test_net_income_deducts_purchase_cost(client: TestClient) -> None:
    """Bought 100 at 1 020 incl. 20 accrued, 10 fee; net income must sum to the lot's P&L."""
    bond = _post(client, "/api/v1/instruments", BOND)
    lot = _post(
        client,
        "/api/v1/lots",
        {
            "instrument_id": bond["id"],
            "trade_date": "2025-02-01",
            "quantity": "100",
            "price_per_unit": "1020",
            "total_cost": "102000",
            "accrued_paid": "2000",
            "fee": "10",
            "fx_rate": "40",
        },
    )
    for kind, day, amount in (
        ("coupon", "2025-07-01", "5000"),
        ("coupon", "2026-01-01", "5000"),
        ("redemption", "2026-01-01", "100000"),
    ):
        _post(
            client,
            "/api/v1/payments",
            {
                "instrument_id": bond["id"],
                "kind": kind,
                "pay_date": day,
                "total_amount": amount,
                "fx_rate": "50",
            },
        )
    body = client.get("/api/v1/reports/received?start=2025-01-01&end=2026-01-31").json()
    assert [p["net_income_uah"] for p in body] == ["3000.00", "5000.00", "-10.00"]
    assert body[0]["net_income_usd"] == "50.00"  # 5000/50 - 2000/40
    assert body[2]["net_income_usd"] == "-500.25"  # 100000/50 - 100010/40
    pnl = client.get(f"/api/v1/reports/lots/{lot['id']}?end=2026-01-31").json()["summary"]["pnl"]
    assert sum(Decimal(p["net_income_uah"]) for p in body) == Decimal(pnl["pnl"]["uah"])
    assert sum(Decimal(p["net_income_usd"]) for p in body) == Decimal(pnl["pnl"]["usd"])


def test_exports_in_ukrainian(client: TestClient) -> None:
    _interview_example(client)

    csv_response = client.get("/api/v1/export/operations.csv?lang=uk")
    assert csv_response.text.splitlines()[0].startswith("Дата,Тип,ISIN")
    assert ",купівля," in csv_response.text

    pnl_response = client.get("/api/v1/export/portfolio.xlsx?lang=uk")
    pnl = load_workbook(io.BytesIO(pnl_response.content))["Прибуток і збиток"]
    assert pnl.cell(row=pnl.max_row, column=1).value == "РАЗОМ"

    assert client.get("/api/v1/export/operations.csv?lang=xx").status_code == 422


def test_missed_lists_due_coupons_without_a_record(client: TestClient) -> None:
    instrument = make_instrument(client)
    make_lot(client, instrument["id"], trade_date="2025-03-10", quantity="10")
    recorded = client.post(
        "/api/v1/payments",
        json={
            "instrument_id": instrument["id"],
            "kind": "coupon",
            "pay_date": "2025-09-02",
            "total_amount": "825",
            "fx_rate": "41.3",
        },
    )
    assert recorded.status_code == 201

    response = client.get("/api/v1/reports/missed")

    assert response.status_code == 200, response.text
    first = response.json()[0]
    assert (first["pay_date"], first["kind"], first["quantity"]) == (
        "2026-03-01",
        "coupon",
        "10.000000",
    )
    assert (first["expected"], first["currency"]) == ("825.00", "UAH")


def test_usd_bond_report_values_at_nbu_usd_rate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        portfolio_loader, "rate_for_valuation", lambda _session, _currency, _day: Decimal("43")
    )
    instrument = make_instrument(
        client,
        isin="UA4000236541",
        currency="USD",
        face_value="1000",
        coupon_rate="0.0417",
        issue_date="2025-07-29",
        maturity_date="2027-02-04",
    )
    make_lot(
        client,
        instrument["id"],
        trade_date="2026-01-10",
        quantity="10",
        price_per_unit="1000",
        total_cost="10000",
        accrued_paid="0",
        fx_rate="42",
    )

    report = client.get("/api/v1/reports/portfolio?start=2026-01-10&end=2026-01-10").json()

    assert report["lots"][0]["currency"] == "USD"
    assert report["totals"]["invested"] == {"uah": "420000.00", "usd": "10000.00"}
    closing = report["totals"]["closing_value"]
    assert Decimal(closing["usd"]) > 10000
    assert abs(Decimal(closing["uah"]) - Decimal(closing["usd"]) * 43) < 1

    upcoming = client.get("/api/v1/reports/upcoming?months=12").json()
    assert upcoming[0]["currency"] == "USD"
    assert upcoming[0]["expected"] == "208.50"
    assert upcoming[0]["expected_uah"] == "8965.50"
