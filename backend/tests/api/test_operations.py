from fastapi.testclient import TestClient

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
        "total_cost_uah": "101000",
        "accrued_paid_uah": "1500",
        "fee_uah": "0",
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
            "total_proceeds_uah": "41000",
            "fx_rate": "41.8",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Only 60 units are available in this package"

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
            "total_proceeds_uah": "10100",
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
            "total_amount_uah": "8250",
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
        "total_amount_uah": "8250",
        "fx_rate": "41.5",
    }

    created = client.post("/api/v1/payments", json=body)
    assert created.status_code == 201

    listed = client.get(f"/api/v1/payments?instrument_id={instrument['id']}")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["total_amount_uah"] == "8250.00"

    payment_id = created.json()["id"]
    updated = client.put(
        f"/api/v1/payments/{payment_id}", json={**body, "total_amount_uah": "8300"}
    )
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
            "total_amount_uah": "8250",
            "fx_rate": "41.5",
        },
    )

    assert response.status_code == 422
