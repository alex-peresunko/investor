from typing import Any

from fastapi.testclient import TestClient

BOND = {
    "isin": "UA4000227045",
    "name": "OVDP 16.5% 09/2027",
    "face_value": "1000",
    "coupon_rate": "0.165",
    "coupon_frequency": 2,
    "issue_date": "2025-03-05",
    "maturity_date": "2027-09-01",
}


def make_instrument(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post("/api/v1/instruments", json={**BOND, **overrides})
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def make_lot(client: TestClient, instrument_id: int, **overrides: Any) -> dict[str, Any]:
    body = {
        "instrument_id": instrument_id,
        "trade_date": "2026-01-10",
        "quantity": "100",
        "price_per_unit": "1010",
        "total_cost_uah": "101000",
        "accrued_paid_uah": "1500",
        "fee_uah": "0",
        "fx_rate": "42.1",
        **overrides,
    }
    response = client.post("/api/v1/lots", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def make_sale(client: TestClient, lot_id: int, **overrides: Any) -> dict[str, Any]:
    body = {
        "lot_id": lot_id,
        "trade_date": "2026-04-10",
        "quantity": "40",
        "total_proceeds_uah": "41000",
        "fx_rate": "41.8",
        **overrides,
    }
    response = client.post("/api/v1/sales", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result
