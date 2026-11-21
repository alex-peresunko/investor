from datetime import date, timedelta

import httpx
import respx
from fastapi.testclient import TestClient

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
