import io
import json
from collections.abc import Iterator
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.services.market import reset_caches
from app.services.securities import reset_cache
from tests.factories import make_instrument

TODAY = date.today()  # noqa: DTZ011
SECURITIES = r"https://bank\.gov\.ua/depo_securities.*"
HOLDERS = r"https://bank\.gov\.ua/files/Depositary/T-bills_debt\.xlsx"
TRADES = r"https://bank\.gov\.ua/files/Depositary/vtor_rin\.xlsx"
AUCTIONS = r"https://bank\.gov\.ua/NBU_ovdp.*"
RATES = r"https://bank\.gov\.ua/NBU_Exchange/exchange_site.*"
USD_RATE = Decimal("40")
EUR_RATE = Decimal("45")


def _iso(day: date) -> str:
    return day.isoformat()


def _coupon(day: date, amount: float) -> dict[str, Any]:
    return {"pay_date": _iso(day), "pay_type": "1", "pay_val": amount}


UAH_BOND = {
    "cpcode": "UA4000000001",
    "nominal": 1000,
    "pgs_date": _iso(TODAY + timedelta(days=400)),
    "razm_date": _iso(TODAY - timedelta(days=330)),
    "pay_period": 182,
    "val_code": "UAH",
    "cpcode_cfi": "DBFTFR",
    "total_bonds": 3_000_000,
    "payments": [
        _coupon(TODAY - timedelta(days=148), 80),
        _coupon(TODAY + timedelta(days=34), 80),
        _coupon(TODAY + timedelta(days=216), 80),
        _coupon(TODAY + timedelta(days=400), 80),
        {"pay_date": _iso(TODAY + timedelta(days=400)), "pay_type": "2", "pay_val": 1000},
    ],
}
# Zero coupon so the clean price equals the dirty one.
USD_BOND = {
    "cpcode": "UA4000000002",
    "nominal": 1000,
    "pgs_date": _iso(TODAY + timedelta(days=200)),
    "razm_date": _iso(TODAY - timedelta(days=100)),
    "val_code": "USD",
    "cpcode_cfi": "DBFTFR",
    "total_bonds": 25_000,
    "payments": [
        {"pay_date": _iso(TODAY + timedelta(days=200)), "pay_type": "2", "pay_val": 1000},
    ],
}
MATURED = {**UAH_BOND, "cpcode": "UA4000000003", "pgs_date": _iso(TODAY - timedelta(days=1))}
EUROBOND = {**USD_BOND, "cpcode": "XS0000000004", "total_bonds": None}


@pytest.fixture(autouse=True)
def _fresh_caches() -> Iterator[None]:
    reset_caches()
    reset_cache()
    yield
    reset_caches()
    reset_cache()


def _xlsx(sheets: dict[str, list[list[Any]]]) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for name, rows in sheets.items():
        sheet = workbook.create_sheet(name)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _holder_rows(day: date, nbu: float, banks: float, individuals: float) -> list[list[Any]]:
    total = nbu + banks + individuals
    return [
        [day, "Всього", total, nbu, banks, 0, 0, individuals, 0, 0],
        [None, "ОВДП. номіновані в гривні. у т.ч.", total, nbu, banks, 0, 0, individuals, 0, 0],
        [None, "ОВДП - ПДВ", 0, 0, 0, 0, 0, 0, 0, 0],
        [None, "ОВДП. номіновані в доларах США", 0, 0, 0, 0, 0, 0, 0, 0],
    ]


LATEST = TODAY - timedelta(days=2)
HOLDERS_DAY = date(2026, 11, 20)
MONTH_BASE = date(2026, 10, 30)
YEAR_BASE = date(2025, 12, 31)


def _holders_file() -> bytes:
    header: list[list[Any]] = [
        ["ОВДП, які знаходяться в обігу, за сумою основного боргу"],
        ["Дата", "Вид ЦП", "Усього", "Облігації. які знаходяться у власності"],
        [
            None,
            None,
            None,
            "НБУ",
            "Банків",
            "Юридичних осіб ",
            "Територіальних громад",
            "Фiзичних осiб",
            "Нерезидентів",
            "Номінальних утримувачив",
        ],
    ]
    rows = (
        header
        + _holder_rows(HOLDERS_DAY, 600, 900, 200)
        + _holder_rows(MONTH_BASE, 610, 880, 190)
        + _holder_rows(YEAR_BASE, 650, 800, 100)
    )
    return _xlsx({"this": rows})


def _trades_file() -> bytes:
    header = [
        "Дата виконання угод",
        "Міжнародний ідентифікаційний номер ОВДП",
        "Валюта випуску",
        "Вид ОВДП",
        "Дата погашення ОВДП",
        "Загальна кількість угод, шт.",
        "Загальний обсяг угод, поставка ЦП проти оплати,  млн.грн.",
        "Загальний обсяг угод, поставка ЦП без оплати, млн.грн.",
        "Середньозважена ціна за 1 ОВДП*,\n грн.",
        "Середньозважена дохідність*,\n % річних",
        "Мінімальна дохідність*, \n% річних",
        "Максимальна дохідність*, \n% річних",
    ]

    def row(day: date, isin: str, *values: Any) -> list[Any]:
        return [day, isin, "", "", None, *values]

    return _xlsx(
        {
            "now": [
                ["Узагальнена інформація"],
                header,
                row(LATEST, "UA4000000002", 3, 2.05, "-", 41000, 0.05, 0.049, 0.051),
                row(
                    LATEST - timedelta(days=40), "UA4000000002", 1, 1, 0.5, 40500, 0.06, 0.06, 0.06
                ),
                row(LATEST, "UA4000000001", 2, 0.5, 3.0, 1050, 0.16, 0.16, 0.16),
                row(LATEST - timedelta(days=1), "UA4000000001", 1, "-", 1.0, "-", "-", "-", "-"),
            ]
        }
    )


def _rates(request: httpx.Request) -> httpx.Response:
    currency = request.url.params["valcode"].upper()
    rate = float(USD_RATE if currency == "USD" else EUR_RATE)
    rows = [
        {
            "exchangedate": (TODAY - timedelta(days=back)).strftime("%d.%m.%Y"),
            "rate_per_unit": rate,
        }
        for back in range(60, -1, -1)
    ]
    return httpx.Response(200, text=json.dumps(rows))


AUCTION_DAY = TODAY - timedelta(days=(TODAY.weekday() - 1) % 7 or 7)


def _auctions(request: httpx.Request) -> httpx.Response:
    if request.url.params["date"] != AUCTION_DAY.strftime("%d.%m.%Y"):
        return httpx.Response(200, text="[]")
    row = {
        "AuctionDate": AUCTION_DAY.strftime("%d.%m.%Y"),
        "AuctionNum": "7",
        "ValCode": "UAH",
        "StockCode": "UA4000000001",
        "PayDate": (AUCTION_DAY + timedelta(days=1)).strftime("%d.%m.%Y"),
        "RepayDate": (TODAY + timedelta(days=400)).strftime("%d.%m.%Y"),
        "Bucket": "1y",
        "IncomeLevel": 15.1,
        "AvgLevel": 15.07,
        "MinLevel": 14.99,
        "MaxLevel": 15.2,
        "Amount": 1000,
        "StockRestrictMF": 2000,
        "VolumeSubmit": 1500000,
        "VolumeSold": 1000000,
        "Attraction": 1010000.5,
    }
    return httpx.Response(200, text=json.dumps([row]))


def _serve_all() -> None:
    respx.get(url__regex=SECURITIES).mock(
        return_value=httpx.Response(200, text=json.dumps([UAH_BOND, USD_BOND, MATURED, EUROBOND]))
    )
    respx.get(url__regex=HOLDERS).mock(return_value=httpx.Response(200, content=_holders_file()))
    respx.get(url__regex=TRADES).mock(return_value=httpx.Response(200, content=_trades_file()))
    respx.get(url__regex=AUCTIONS).mock(side_effect=_auctions)
    respx.get(url__regex=RATES).mock(side_effect=_rates)


@respx.mock
def test_bonds_list_domestic_outstanding_with_share_trades_and_auctions(
    client: TestClient,
) -> None:
    _serve_all()
    mine = make_instrument(client, isin="UA4000000002", currency="USD")

    response = client.get("/api/v1/market/bonds")

    assert response.status_code == 200, response.text
    body = response.json()
    assert [b["isin"] for b in body["bonds"]] == ["UA4000000001", "UA4000000002"]
    uah, usd = body["bonds"]
    # 3 bn UAH + 25 m USD x 40 = 4 bn UAH in all.
    assert Decimal(body["outstanding_uah"]) == Decimal("4000000000")
    assert Decimal(uah["market_share"]) == Decimal("0.75")
    assert Decimal(usd["outstanding"]) == Decimal("25000000")
    assert body["trades_as_of"] == _iso(LATEST)
    assert uah["instrument_id"] is None
    assert usd["instrument_id"] == mine["id"]
    # 41 000 UAH per bond ÷ 40 = 1 025 USD on a face of 1 000.
    assert Decimal(usd["last_trade"]["dirty_price"]) == Decimal("102.5")
    assert Decimal(usd["last_trade"]["clean_price"]) == Decimal("102.5")
    assert Decimal(usd["last_trade"]["yield_avg"]) == Decimal("0.05")
    assert Decimal(usd["volume_30d_uah"]) == Decimal("2050000")
    assert uah["last_auction"]["day"] == _iso(AUCTION_DAY)
    assert Decimal(uah["last_auction"]["yield_avg"]) == Decimal("0.1507")
    assert Decimal(uah["last_auction"]["limit"]) == Decimal("2000000")
    assert uah["next_payment_date"] == _iso(TODAY + timedelta(days=34))


@respx.mock
def test_bond_detail_with_clean_price_trades_and_auctions(client: TestClient) -> None:
    _serve_all()

    body = client.get("/api/v1/market/bonds/ua4000000001").json()

    quote = body["bond"]["last_trade"]
    assert Decimal(quote["dirty_price"]) == Decimal("105")
    # Accrued 80 x 146 / 182 days of the coupon period.
    assert Decimal(quote["clean_price"]) == Decimal("98.5824")
    assert [t["day"] for t in body["trades"]] == [
        _iso(LATEST - timedelta(days=1)),
        _iso(LATEST),
    ]
    assert body["trades"][0]["price_uah"] is None
    assert body["trades"][1]["volume_free_uah"] == "3000000"
    assert len(body["auctions"]) == 1
    assert body["schedule"][-1]["kind"] == "redemption"


@respx.mock
def test_unknown_bond_is_404(client: TestClient) -> None:
    _serve_all()

    response = client.get("/api/v1/market/bonds/UA4000000003")

    assert response.status_code == 404
    assert response.json()["code"] == "security_not_found"


@respx.mock
def test_holders_with_changes_since_month_and_year_start(client: TestClient) -> None:
    _serve_all()

    response = client.get("/api/v1/market/holders")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["day"] == _iso(HOLDERS_DAY)
    assert body["month_base_day"] == _iso(MONTH_BASE)
    assert body["year_base_day"] == _iso(YEAR_BASE)
    everything = next(g for g in body["groups"] if g["group"] == "all")
    assert Decimal(everything["total"]) == Decimal("1700000000")
    nbu = next(h for h in everything["holders"] if h["holder"] == "nbu")
    assert Decimal(nbu["change_month"]) == Decimal("-10000000")
    assert Decimal(nbu["change_year"]) == Decimal("-50000000")
    assert Decimal(nbu["share"]) == Decimal("0.352941")
    assert {p["day"] for p in body["history"]} == {
        _iso(HOLDERS_DAY),
        _iso(MONTH_BASE),
        _iso(YEAR_BASE),
    }


@respx.mock
def test_repayments_scale_schedule_by_bonds_outstanding(client: TestClient) -> None:
    _serve_all()

    rows = client.get("/api/v1/market/repayments").json()

    first = rows[0]
    assert (first["isin"], first["kind"], first["pay_date"]) == (
        "UA4000000001",
        "coupon",
        _iso(TODAY + timedelta(days=34)),
    )
    assert Decimal(first["amount"]) == Decimal("240000000")
    usd = next(r for r in rows if r["isin"] == "UA4000000002")
    assert Decimal(usd["amount"]) == Decimal("25000000")
    assert Decimal(usd["amount_uah"]) == Decimal("1000000000")
    assert all(r["isin"] != "UA4000000003" for r in rows)


@respx.mock
def test_nbu_down_is_502(client: TestClient) -> None:
    respx.get(url__regex=HOLDERS).mock(side_effect=httpx.ConnectError("down"))

    response = client.get("/api/v1/market/holders")

    assert response.status_code == 502
    assert response.json()["code"] == "market_unavailable"


@respx.mock
def test_plan_buys_outstanding_bonds_of_the_currency(client: TestClient) -> None:
    _serve_all()

    response = client.get(
        "/api/v1/reports/plan", params={"currency": "UAH", "years": 2, "extra_now": "10000"}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["candidates"] == 1
    first = body["purchases"][0]
    assert first["buy_date"] == _iso(TODAY)
    assert first["isin"] == "UA4000000001"
    # 1 050 UAH per bond on the last trade; 10 000 spread over four purchases of two bonds.
    assert first["quantity"] == 8
    assert abs(Decimal(first["price"]) - Decimal("1050")) < 1
    assert first["price_estimated"] is False
    assert first["yield_rate"] is not None
    assert len(body["coupons"]) == 24
    assert len(body["redemptions"]) == 2
    assert Decimal(body["invested"]) + Decimal(body["cash_left"]) >= Decimal("10000")


@respx.mock
def test_plan_min_yield_filters_candidates(client: TestClient) -> None:
    _serve_all()

    response = client.get(
        "/api/v1/reports/plan", params={"currency": "UAH", "extra_now": "10000", "min_yield": "0.2"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["candidates"] == 0
    assert response.json()["purchases"] == []


def test_plan_rejects_long_horizon(client: TestClient) -> None:
    response = client.get("/api/v1/reports/plan", params={"years": 11})

    assert response.status_code == 422
    assert response.json()["code"] == "plan_years_out_of_range"
