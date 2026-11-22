"""Parsers for NBU depositary market files and the auction feed; no network, no DB."""

import io
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from openpyxl import load_workbook

MILLION = Decimal(1_000_000)
CENT = Decimal("0.01")

# Holder groups as the columns of T-bills_debt.xlsx name them. Older sheets lack some groups.
HOLDERS = (
    "nbu",
    "banks",
    "companies",
    "communities",
    "individuals",
    "non_residents",
    "nominees",
)
_HOLDER_WORDS = {
    "нбу": "nbu",
    "банк": "banks",
    "юридичн": "companies",
    "територіальн": "communities",
    "фізичн": "individuals",
    "нерезидент": "non_residents",
    "номінальн": "nominees",
}
HolderGroup = str  # "all", "UAH", "USD" or "EUR"


@dataclass(frozen=True)
class HolderSnapshot:
    day: date
    group: HolderGroup
    total: Decimal
    by_holder: dict[str, Decimal]


@dataclass(frozen=True)
class TradeDay:
    """Secondary-market deals in one bond on one day, as the depositary aggregates them."""

    day: date
    isin: str
    deals: int
    # Delivery versus payment; the price and yields describe these deals only.
    volume_uah: Decimal | None
    # Free of payment (transfers without settlement); absent before August 2022.
    volume_free_uah: Decimal | None
    # Per bond, in UAH even for dollar and euro bonds, including accrued coupon.
    price_uah: Decimal | None
    yield_avg: Decimal | None
    yield_min: Decimal | None
    yield_max: Decimal | None


@dataclass(frozen=True)
class Auction:
    day: date
    number: str
    isin: str
    currency: str
    settlement_date: date
    maturity_date: date
    bucket: str
    # Yields as fractions; NBU publishes percents.
    yield_cutoff: Decimal | None
    yield_avg: Decimal | None
    yield_min: Decimal | None
    yield_max: Decimal | None
    # Amounts in the bond's currency.
    bid: Decimal
    sold: Decimal
    raised: Decimal
    # Offer limit set by the Ministry of Finance; None when unlimited or unknown.
    limit: Decimal | None


CYRILLIC_I = "\u0456"


def _norm(text: object) -> str:
    """Lowercase with Latin i folded into Cyrillic i; NBU mixes them in headers."""
    return str(text or "").lower().replace("i", CYRILLIC_I).strip()


def _decimal(value: object) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, float):
        return Decimal(repr(value))
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except InvalidOperation:
        return None


def _day(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _rows(content: bytes) -> Iterator[list[tuple[Any, ...]]]:
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    try:
        for sheet in workbook.worksheets:
            yield list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()


def _group(label: object) -> HolderGroup | None:
    text = _norm(label)
    if text == "всього":
        return "all"
    if "гривн" in text:
        return "UAH"
    if "долар" in text:
        return "USD"
    if "євро" in text:
        return "EUR"
    return None


def parse_holders(content: bytes) -> list[HolderSnapshot]:
    """T-bills_debt.xlsx: principal outstanding by holder; one snapshot per day and group,
    oldest first."""
    found: dict[tuple[date, HolderGroup], HolderSnapshot] = {}
    for rows in _rows(content):
        columns: dict[int, str] = {}
        total_column: int | None = None
        current: date | None = None
        for row in rows:
            cells = list(row)
            if not columns:
                for index, cell in enumerate(cells):
                    if _norm(cell) == "усього":
                        total_column = index
                    for word, holder in _HOLDER_WORDS.items():
                        if word in _norm(cell) and isinstance(cell, str) and len(cell) < 40:
                            columns[index] = holder
                continue
            if len(cells) < 2 or total_column is None:
                continue
            current = _day(cells[0]) or current
            group = _group(cells[1])
            total = _decimal(cells[total_column]) if total_column < len(cells) else None
            if current is None or group is None or total is None:
                continue
            by_holder = {holder: Decimal(0) for holder in HOLDERS}
            for index, holder in columns.items():
                value = _decimal(cells[index]) if index < len(cells) else None
                by_holder[holder] = ((value or Decimal(0)) * MILLION).quantize(CENT)
            found.setdefault(
                (current, group),
                HolderSnapshot(current, group, (total * MILLION).quantize(CENT), by_holder),
            )
    return sorted(found.values(), key=lambda s: (s.day, s.group))


_TRADE_FIELDS = (
    ("дата", "day"),
    ("ідентифікаційн", "isin"),
    ("кількість угод", "deals"),
    ("без оплати", "volume_free"),
    ("обсяг", "volume"),
    ("ціна", "price"),
    ("мінімальна", "yield_min"),
    ("максимальна", "yield_max"),
    ("дохідність", "yield_avg"),
)


def _trade_columns(row: Iterable[object]) -> dict[str, int]:
    columns: dict[str, int] = {}
    for index, cell in enumerate(row):
        text = _norm(cell)
        for word, field in _TRADE_FIELDS:
            if word in text:
                columns.setdefault(field, index)
                break
    return columns


def parse_trades(content: bytes) -> list[TradeDay]:
    """vtor_rin.xlsx: secondary-market deals per bond and day, oldest first."""
    found: dict[tuple[date, str], TradeDay] = {}
    for rows in _rows(content):
        columns: dict[str, int] = {}
        for row in rows:
            if not columns:
                candidate = _trade_columns(row)
                if {"day", "isin", "price"} <= candidate.keys():
                    columns = candidate
                continue

            def cell(
                field: str, row: tuple[Any, ...] = row, columns: dict[str, int] = columns
            ) -> object:
                index = columns.get(field)
                return row[index] if index is not None and index < len(row) else None

            day = _day(cell("day"))
            isin = str(cell("isin") or "").strip()
            if day is None or not isin.startswith("UA"):
                continue
            volume = _decimal(cell("volume"))
            free = _decimal(cell("volume_free"))
            found.setdefault(
                (day, isin),
                TradeDay(
                    day=day,
                    isin=isin,
                    deals=int(_decimal(cell("deals")) or 0),
                    volume_uah=None if volume is None else (volume * MILLION).quantize(Decimal(1)),
                    volume_free_uah=None if free is None else (free * MILLION).quantize(Decimal(1)),
                    price_uah=_quantize(_decimal(cell("price")), "0.01"),
                    yield_avg=_quantize(_decimal(cell("yield_avg")), "0.000001"),
                    yield_min=_quantize(_decimal(cell("yield_min")), "0.000001"),
                    yield_max=_quantize(_decimal(cell("yield_max")), "0.000001"),
                ),
            )
    return sorted(found.values(), key=lambda t: (t.day, t.isin))


def _quantize(value: Decimal | None, places: str) -> Decimal | None:
    return None if value is None else value.quantize(Decimal(places))


def _dmy(text: object) -> date:
    day, month, year = str(text).split(".")
    return date(int(year), int(month), int(day))


def _percent(value: object) -> Decimal | None:
    number = _decimal(value)
    return None if number is None else (number / 100).quantize(Decimal("0.000001"))


def parse_auction(row: dict[str, Any]) -> Auction:
    sold = _decimal(row.get("VolumeSold")) or Decimal(0)
    bonds_sold = _decimal(row.get("Amount"))
    limit_bonds = _decimal(row.get("StockRestrictMF"))
    # StockRestrictMF counts bonds; the face value is what one sold bond added to VolumeSold.
    limit = sold / bonds_sold * limit_bonds if bonds_sold and limit_bonds else None
    return Auction(
        day=_dmy(row["AuctionDate"]),
        number=str(row.get("AuctionNum", "")),
        isin=str(row["StockCode"]),
        currency=str(row.get("ValCode", "")),
        settlement_date=_dmy(row["PayDate"]),
        maturity_date=_dmy(row["RepayDate"]),
        bucket=str(row.get("Bucket") or ""),
        yield_cutoff=_percent(row.get("IncomeLevel")),
        yield_avg=_percent(row.get("AvgLevel")),
        yield_min=_percent(row.get("MinLevel")),
        yield_max=_percent(row.get("MaxLevel")),
        bid=_decimal(row.get("VolumeSubmit")) or Decimal(0),
        sold=sold,
        raised=_decimal(row.get("Attraction")) or Decimal(0),
        limit=limit,
    )
