import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.services.securities import reset_cache

SECURITIES = r"https://bank\.gov\.ua/depo_securities.*"


def _coupons(dates: list[str], amount: float) -> list[dict[str, Any]]:
    return [{"pay_date": d, "pay_type": "1", "pay_val": amount, "array": "true"} for d in dates]


USD_BOND = {
    "cpcode": "UA4000236541",
    "nominal": 1000,
    "auk_proc": 4.17,
    "pgs_date": "2027-02-04",
    "razm_date": "2025-07-29",
    "pay_period": 182,
    "val_code": "USD",
    "cpcode_cfi": "DBFTFR",
    "payments": [
        *_coupons(["2026-02-05", "2026-08-06", "2027-02-04"], 20.85),
        {"pay_date": "2027-02-04", "pay_type": "2", "pay_val": 1000, "array": "true"},
    ],
}
ANNUAL_UAH_BOND = {
    "cpcode": "UA4000234567",
    "nominal": 1000,
    "auk_proc": 15.2,
    "pgs_date": "2028-05-10",
    "razm_date": "2025-05-14",
    # The first coupon is short; the rate must come from the regular ones.
    "pay_period": 364,
    "val_code": "UAH",
    "cpcode_cfi": "DBVTFR",
    "payments": _coupons(["2026-05-13", "2027-05-12", "2028-05-10"], 152)
    + _coupons(["2025-11-12"], 75.5),
}
GBP_BOND = {**USD_BOND, "cpcode": "UA4000299999", "val_code": "GBP"}


@pytest.fixture(autouse=True)
def _fresh_cache() -> Iterator[None]:
    reset_cache()
    yield
    reset_cache()


def _serve(*rows: dict[str, Any]) -> respx.Route:
    return respx.get(url__regex=SECURITIES).mock(
        return_value=httpx.Response(200, text=json.dumps(list(rows)))
    )


@respx.mock
def test_usd_bond_terms_and_schedule(client: TestClient) -> None:
    route = _serve(USD_BOND, ANNUAL_UAH_BOND)

    response = client.get("/api/v1/securities/ua4000236541")

    assert response.status_code == 200, response.text
    body = response.json()
    assert {k: body[k] for k in ("isin", "currency", "coupon_frequency", "issue_date")} == {
        "isin": "UA4000236541",
        "currency": "USD",
        "coupon_frequency": 2,
        "issue_date": "2025-07-29",
    }
    assert body["coupon_rate"] == "0.041700"
    assert body["variable_rate"] is False
    assert body["name"] == "OVDP USD 4.17% 02/2027"
    assert [(s["kind"], s["pay_date"]) for s in body["schedule"]][-2:] == [
        ("coupon", "2027-02-04"),
        ("redemption", "2027-02-04"),
    ]
    client.get("/api/v1/securities/UA4000234567")
    assert route.call_count == 1


@respx.mock
def test_rate_comes_from_the_regular_coupon_and_redemption_is_added(client: TestClient) -> None:
    _serve(ANNUAL_UAH_BOND)

    body = client.get("/api/v1/securities/UA4000234567").json()

    assert (body["coupon_frequency"], body["coupon_rate"]) == (1, "0.152000")
    assert body["variable_rate"] is True
    assert body["schedule"][0] == {
        "kind": "coupon",
        "pay_date": "2025-11-12",
        "amount_per_unit": "75.5",
    }
    assert body["schedule"][-1]["kind"] == "redemption"


@respx.mock
def test_unknown_unsupported_and_unavailable(client: TestClient) -> None:
    _serve(GBP_BOND)
    missing = client.get("/api/v1/securities/UA4000000000")
    assert missing.status_code == 404
    assert missing.json()["code"] == "security_not_found"
    unsupported = client.get("/api/v1/securities/UA4000299999")
    assert unsupported.status_code == 422
    assert unsupported.json()["params"] == {"isin": "UA4000299999", "currency": "GBP"}

    reset_cache()
    respx.get(url__regex=SECURITIES).mock(return_value=httpx.Response(503))
    assert client.get("/api/v1/securities/UA4000236541").status_code == 502


@respx.mock
def test_bond_created_with_the_nbu_schedule(client: TestClient) -> None:
    _serve(USD_BOND)
    security = client.get("/api/v1/securities/UA4000236541").json()

    created = client.post("/api/v1/instruments", json=security)

    assert created.status_code == 201, created.text
    schedule = client.get(f"/api/v1/instruments/{created.json()['id']}/schedule").json()
    assert [s["pay_date"] for s in schedule if s["kind"] == "coupon"] == [
        "2026-02-05",
        "2026-08-06",
        "2027-02-04",
    ]


@respx.mock
def test_list_skips_matured_and_unsupported_bonds(client: TestClient) -> None:
    matured = {**USD_BOND, "cpcode": "UA4000211111", "pgs_date": "2020-01-15"}
    _serve(ANNUAL_UAH_BOND, matured, GBP_BOND, USD_BOND)

    response = client.get("/api/v1/securities")

    assert response.status_code == 200, response.text
    assert response.json() == [
        {
            "isin": "UA4000236541",
            "name": "OVDP USD 4.17% 02/2027",
            "currency": "USD",
            "maturity_date": "2027-02-04",
            "variable_rate": False,
        },
        {
            "isin": "UA4000234567",
            "name": "OVDP 15.20% 05/2028",
            "currency": "UAH",
            "maturity_date": "2028-05-10",
            "variable_rate": True,
        },
    ]
