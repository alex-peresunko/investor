from datetime import date, timedelta
from decimal import Decimal

import httpx
import respx
from fastapi.testclient import TestClient

from tests.factories import make_instrument, make_lot

NBU = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange"


def _nbu_row(rate: str, day: str) -> str:
    return f'[{{"r030":840,"rate":{rate},"cc":"USD","exchangedate":"{day}"}}]'


@respx.mock
def test_rate_is_fetched_then_cached(client: TestClient) -> None:
    route = respx.get(NBU).mock(return_value=httpx.Response(200, text=_nbu_row("41.2345", "x")))
    first = client.get("/api/v1/fx/usd/2025-03-03")
    second = client.get("/api/v1/fx/usd/2025-03-03")
    assert first.status_code == 200
    assert first.json() == {"rate_date": "2025-03-03", "rate": "41.234500", "source": "NBU"}
    assert second.json()["rate"] == "41.234500"
    assert route.call_count == 1
    assert route.calls[0].request.url.params["date"] == "20250303"


@respx.mock
def test_unpublished_today_falls_back_to_previous_day(client: TestClient) -> None:
    today = date.today()  # noqa: DTZ011
    yesterday = (today - timedelta(days=1)).strftime("%Y%m%d")

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.params["date"] == yesterday:
            return httpx.Response(200, text=_nbu_row("45.0532", "x"))
        return httpx.Response(200, text="[]")

    respx.get(NBU).mock(side_effect=respond)
    response = client.get(f"/api/v1/fx/usd/{today.isoformat()}")
    assert response.status_code == 200
    assert response.json()["rate_date"] == today.isoformat()
    assert response.json()["rate"] == "45.053200"


def test_future_date_rejected(client: TestClient) -> None:
    future = (date.today() + timedelta(days=2)).isoformat()  # noqa: DTZ011
    response = client.get(f"/api/v1/fx/usd/{future}")
    assert response.status_code == 422


@respx.mock
def test_nbu_down_returns_502(client: TestClient) -> None:
    route = respx.get(NBU).mock(side_effect=httpx.ConnectError("down"))
    response = client.get("/api/v1/fx/usd/2025-03-04")
    assert response.status_code == 502
    assert "manually" in response.json()["detail"]
    assert route.call_count == 3


@respx.mock
def test_nbu_down_skips_network_during_cooldown(client: TestClient) -> None:
    route = respx.get(NBU).mock(side_effect=httpx.ConnectError("down"))
    client.get("/api/v1/fx/usd/2025-03-04")
    response = client.get("/api/v1/fx/usd/2025-03-05")
    assert response.status_code == 502
    assert route.call_count == 3


@respx.mock
def test_reports_use_nearest_known_rate_when_nbu_down(client: TestClient) -> None:
    respx.get(NBU).mock(side_effect=httpx.ConnectError("down"))
    lot = make_lot(client, make_instrument(client)["id"], fx_rate="40")
    upcoming = client.get("/api/v1/reports/upcoming")
    assert upcoming.status_code == 200, upcoming.text
    first = upcoming.json()[0]
    assert Decimal(first["expected_usd_estimate"]) == round(Decimal(first["expected_uah"]) / 40, 2)

    client.get("/api/v1/fx/usd/2025-03-04")  # still down; nothing cached
    assert client.get("/api/v1/reports/portfolio").status_code == 200
    assert client.get(f"/api/v1/reports/lots/{lot['id']}").status_code == 200


@respx.mock
def test_cached_nbu_rate_preferred_over_operation_rate(client: TestClient) -> None:
    route = respx.get(NBU).mock(return_value=httpx.Response(200, text=_nbu_row("44", "x")))
    client.get(f"/api/v1/fx/usd/{(date.today() - timedelta(days=3)).isoformat()}")  # noqa: DTZ011
    route.side_effect = httpx.ConnectError("down")
    make_lot(client, make_instrument(client)["id"], fx_rate="40")
    first = client.get("/api/v1/reports/upcoming").json()[0]
    assert Decimal(first["expected_usd_estimate"]) == round(Decimal(first["expected_uah"]) / 44, 2)


@respx.mock
def test_eur_rate_is_fetched_and_cached_separately(client: TestClient) -> None:
    route = respx.get(NBU).mock(return_value=httpx.Response(200, text=_nbu_row("48.9", "x")))

    eur = client.get("/api/v1/fx/eur/2025-03-03")

    assert eur.status_code == 200
    assert eur.json()["rate"] == "48.900000"
    assert route.calls[0].request.url.params["valcode"] == "EUR"
    assert client.get("/api/v1/fx/gbp/2025-03-03").status_code == 422
