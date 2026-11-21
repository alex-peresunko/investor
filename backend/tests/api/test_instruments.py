from fastapi.testclient import TestClient

from tests.factories import BOND, make_instrument, make_lot


def test_create_and_get_instrument(client: TestClient) -> None:
    created = make_instrument(client)

    response = client.get(f"/api/v1/instruments/{created['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["isin"] == BOND["isin"]
    assert body["kind"] == "bond"
    assert body["currency"] == "UAH"
    assert body["face_value"] == "1000.00"


def test_duplicate_isin_conflicts(client: TestClient) -> None:
    make_instrument(client)

    response = client.post("/api/v1/instruments", json=BOND)

    assert response.status_code == 409
    assert response.json()["title"] == "Conflict"


def test_maturity_before_issue_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/instruments", json={**BOND, "maturity_date": "2025-01-01"})

    assert response.status_code == 422


def test_invalid_isin_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/instruments", json={**BOND, "isin": "bad"})

    assert response.status_code == 422


def test_update_instrument(client: TestClient) -> None:
    created = make_instrument(client)

    response = client.put(f"/api/v1/instruments/{created['id']}", json={**BOND, "name": "Renamed"})

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_generate_schedule(client: TestClient) -> None:
    created = make_instrument(client)

    response = client.post(f"/api/v1/instruments/{created['id']}/schedule/generate")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 6
    assert body[0]["kind"] == "coupon"
    assert body[0]["pay_date"] == "2025-09-01"
    assert body[0]["amount_per_unit"] == "82.500000"
    assert body[-1]["kind"] == "redemption"
    assert body[-1]["pay_date"] == "2027-09-01"

    listed = client.get(f"/api/v1/instruments/{created['id']}/schedule")
    assert listed.status_code == 200
    assert listed.json() == body


def test_replace_schedule_rejects_duplicates(client: TestClient) -> None:
    created = make_instrument(client)
    item = {"kind": "coupon", "pay_date": "2026-03-01", "amount_per_unit": "82.5"}

    response = client.put(f"/api/v1/instruments/{created['id']}/schedule", json=[item, item])

    assert response.status_code == 422


def test_delete_instrument_with_lot_conflicts(client: TestClient) -> None:
    created = make_instrument(client)
    make_lot(client, created["id"])

    response = client.delete(f"/api/v1/instruments/{created['id']}")

    assert response.status_code == 409


def test_delete_instrument(client: TestClient) -> None:
    created = make_instrument(client)

    response = client.delete(f"/api/v1/instruments/{created['id']}")
    assert response.status_code == 204

    assert client.get(f"/api/v1/instruments/{created['id']}").status_code == 404


def test_create_generates_schedule(client: TestClient) -> None:
    bond = make_instrument(client)
    response = client.get(f"/api/v1/instruments/{bond['id']}/schedule")
    assert response.status_code == 200
    assert len(response.json()) == 6
