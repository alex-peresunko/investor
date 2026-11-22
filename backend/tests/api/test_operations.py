from fastapi.testclient import TestClient
from httpx import Response

from tests.factories import make_instrument, make_lot, make_sale


def test_lot_crud(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"])

    listed = client.get(f"/api/v1/lots?instrument_id={instrument['id']}")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated_body = {**lot, "quantity": "120"}
    del updated_body["id"]
    response = client.put(f"/api/v1/lots/{lot['id']}", json=updated_body)
    assert response.status_code == 200
    assert response.json()["quantity"] == "120.000000"

    assert client.delete(f"/api/v1/lots/{lot['id']}").status_code == 204
    assert client.get(f"/api/v1/lots/{lot['id']}").status_code == 404


def test_lot_date_outside_bond_life_rejected(client: TestClient) -> None:
    instrument = make_instrument(client)
    body = {
        "instrument_id": instrument["id"],
        "trade_date": "2030-01-01",
        "quantity": "100",
        "price_per_unit": "1010",
        "total_cost": "101000",
        "accrued_paid": "1500",
        "fee": "0",
        "fx_rate": "42.1",
    }

    response = client.post("/api/v1/lots", json=body)

    assert response.status_code == 422
    assert "between" in response.json()["detail"]


def test_sale_cannot_exceed_available(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"], quantity="100")
    make_sale(client, lot["id"], quantity="40")

    response = client.post(
        "/api/v1/sales",
        json={
            "lot_id": lot["id"],
            "trade_date": "2026-04-10",
            "quantity": "61",
            "total_proceeds": "41000",
            "fx_rate": "41.8",
        },
    )
    assert response.status_code == 422
    problem = response.json()
    assert problem["detail"] == "Only 60 units are available in this package"
    assert problem["code"] == "sale_exceeds_available"
    assert problem["params"] == {"available": "60"}

    make_sale(client, lot["id"], quantity="60")


def test_sale_update_excludes_itself(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"], quantity="100")
    sale = make_sale(client, lot["id"], quantity="40")

    body = {**sale, "quantity": "100"}
    del body["id"]
    response = client.put(f"/api/v1/sales/{sale['id']}", json=body)

    assert response.status_code == 200


def test_sale_before_purchase_rejected(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"])

    response = client.post(
        "/api/v1/sales",
        json={
            "lot_id": lot["id"],
            "trade_date": "2026-01-01",
            "quantity": "10",
            "total_proceeds": "10100",
            "fx_rate": "41.8",
        },
    )

    assert response.status_code == 422


def test_lot_quantity_below_sold_rejected(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"], quantity="100")
    make_sale(client, lot["id"], quantity="40")

    body = {**lot, "quantity": "30"}
    del body["id"]
    response = client.put(f"/api/v1/lots/{lot['id']}", json=body)

    assert response.status_code == 422


def test_delete_lot_with_sales_conflicts(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"])
    sale = make_sale(client, lot["id"])

    assert client.delete(f"/api/v1/lots/{lot['id']}").status_code == 409
    assert client.delete(f"/api/v1/sales/{sale['id']}").status_code == 204
    assert client.delete(f"/api/v1/lots/{lot['id']}").status_code == 204


def test_payment_requires_holdings(client: TestClient) -> None:
    instrument = make_instrument(client)

    response = client.post(
        "/api/v1/payments",
        json={
            "instrument_id": instrument["id"],
            "kind": "coupon",
            "pay_date": "2026-03-01",
            "total_amount": "8250",
            "fx_rate": "41.5",
        },
    )

    assert response.status_code == 422


def test_payment_crud(client: TestClient) -> None:
    instrument = make_instrument(client)
    make_lot(client, instrument["id"])
    body = {
        "instrument_id": instrument["id"],
        "kind": "coupon",
        "pay_date": "2026-03-01",
        "total_amount": "8250",
        "fx_rate": "41.5",
    }

    created = client.post("/api/v1/payments", json=body)
    assert created.status_code == 201

    listed = client.get(f"/api/v1/payments?instrument_id={instrument['id']}")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["total_amount"] == "8250.00"

    payment_id = created.json()["id"]
    updated = client.put(f"/api/v1/payments/{payment_id}", json={**body, "total_amount": "8300"})
    assert updated.status_code == 200

    assert client.delete(f"/api/v1/payments/{payment_id}").status_code == 204


def test_payment_on_purchase_day_rejected(client: TestClient) -> None:
    instrument = make_instrument(client)
    make_lot(client, instrument["id"], trade_date="2026-01-10")

    response = client.post(
        "/api/v1/payments",
        json={
            "instrument_id": instrument["id"],
            "kind": "coupon",
            "pay_date": "2026-01-10",
            "total_amount": "8250",
            "fx_rate": "41.5",
        },
    )

    assert response.status_code == 422


def _post_payment(client: TestClient, instrument_id: int, **overrides: str) -> Response:
    body = {
        "instrument_id": instrument_id,
        "kind": "coupon",
        "pay_date": "2026-03-01",
        "total_amount": "8250",
        "fx_rate": "41.5",
        **overrides,
    }
    response: Response = client.post("/api/v1/payments", json=body)
    return response


def test_delete_lot_with_payments_conflicts(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"])
    assert _post_payment(client, instrument["id"]).status_code == 201

    response = client.delete(f"/api/v1/lots/{lot['id']}")

    assert response.status_code == 409
    assert response.json()["code"] == "payment_loses_holdings"
    assert response.json()["params"] == {"date": "2026-03-01"}


def test_moving_purchase_past_received_coupon_conflicts(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"], trade_date="2026-01-10")
    assert _post_payment(client, instrument["id"]).status_code == 201

    body = {**lot, "trade_date": "2026-03-05"}
    del body["id"]
    response = client.put(f"/api/v1/lots/{lot['id']}", json=body)

    assert response.status_code == 409
    assert client.get(f"/api/v1/lots/{lot['id']}").json()["trade_date"] == "2026-01-10"


def test_selling_everything_before_received_coupon_conflicts(client: TestClient) -> None:
    instrument = make_instrument(client)
    lot = make_lot(client, instrument["id"], quantity="100")
    assert _post_payment(client, instrument["id"]).status_code == 201

    response = client.post(
        "/api/v1/sales",
        json={
            "lot_id": lot["id"],
            "trade_date": "2026-02-01",
            "quantity": "100",
            "total_proceeds": "101000",
            "fx_rate": "41.8",
        },
    )

    assert response.status_code == 409
    make_sale(client, lot["id"], trade_date="2026-02-01", quantity="99")


def test_redemption_before_recorded_coupon_conflicts(client: TestClient) -> None:
    instrument = make_instrument(client)
    make_lot(client, instrument["id"])
    assert _post_payment(client, instrument["id"], pay_date="2026-09-01").status_code == 201

    response = _post_payment(
        client, instrument["id"], kind="redemption", pay_date="2026-06-01", total_amount="1"
    )

    assert response.status_code == 409


def test_coupon_after_redemption_rejected(client: TestClient) -> None:
    instrument = make_instrument(client)
    make_lot(client, instrument["id"])
    assert (
        _post_payment(
            client, instrument["id"], kind="redemption", pay_date="2026-06-01"
        ).status_code
        == 201
    )

    response = _post_payment(client, instrument["id"], pay_date="2026-09-01")

    assert response.status_code == 422
    assert response.json()["code"] == "payment_without_holdings"


def test_eur_bond_operations_need_a_currency_rate(client: TestClient) -> None:
    instrument = make_instrument(client, isin="UA4000236723", currency="EUR")
    body = {
        "instrument_id": instrument["id"],
        "trade_date": "2026-01-10",
        "quantity": "5",
        "price_per_unit": "1000",
        "total_cost": "5000",
        "fx_rate": "42.1",
    }

    missing = client.post("/api/v1/lots", json=body)
    assert missing.status_code == 422
    assert missing.json()["code"] == "currency_rate_required"
    assert missing.json()["params"] == {"currency": "EUR"}

    created = client.post("/api/v1/lots", json={**body, "currency_rate": "48.9"})
    assert created.status_code == 201, created.text
    assert created.json()["currency_rate"] == "48.900000"


def test_usd_bond_operations_take_no_currency_rate(client: TestClient) -> None:
    instrument = make_instrument(client, isin="UA4000236541", currency="USD")

    response = client.post(
        "/api/v1/lots",
        json={
            "instrument_id": instrument["id"],
            "trade_date": "2026-01-10",
            "quantity": "5",
            "price_per_unit": "1000",
            "total_cost": "5000",
            "fx_rate": "42.1",
            "currency_rate": "42.1",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "currency_rate_not_applicable"


def test_bond_currency_is_locked_once_it_has_operations(client: TestClient) -> None:
    instrument = make_instrument(client)
    body = {k: v for k, v in instrument.items() if k not in ("id", "kind")}
    assert (
        client.put(
            f"/api/v1/instruments/{instrument['id']}", json={**body, "currency": "USD"}
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/api/v1/instruments/{instrument['id']}", json={**body, "currency": "UAH"}
        ).status_code
        == 200
    )
    make_lot(client, instrument["id"])

    response = client.put(
        f"/api/v1/instruments/{instrument['id']}", json={**body, "currency": "USD"}
    )

    assert response.status_code == 409
    assert response.json()["code"] == "bond_currency_locked"
