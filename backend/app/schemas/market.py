from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Currency, PaymentKind
from app.schemas.securities import SecurityPayment

HolderGroup = Literal["all", "UAH", "USD", "EUR"]
Holder = Literal[
    "nbu", "banks", "companies", "communities", "individuals", "non_residents", "nominees"
]


class MarketQuote(BaseModel):
    """One day of secondary-market deals in a bond, delivery versus payment."""

    day: date
    deals: int
    volume_uah: Decimal | None
    volume_free_uah: Decimal | None
    price_uah: Decimal | None
    # Per 100 of face value in the bond's currency; dirty includes accrued coupon.
    dirty_price: Decimal | None
    clean_price: Decimal | None
    yield_avg: Decimal | None
    yield_min: Decimal | None
    yield_max: Decimal | None


class AuctionOut(BaseModel):
    day: date
    number: str
    isin: str
    currency: str
    settlement_date: date
    maturity_date: date
    bucket: str
    yield_cutoff: Decimal | None
    yield_avg: Decimal | None
    yield_min: Decimal | None
    yield_max: Decimal | None
    bid: Decimal
    sold: Decimal
    raised: Decimal
    limit: Decimal | None


class MarketBond(BaseModel):
    isin: str
    name: str
    currency: Currency
    face_value: Decimal
    coupon_rate: Decimal
    coupon_frequency: int
    variable_rate: bool
    issue_date: date
    maturity_date: date
    outstanding_bonds: int
    # Face value outstanding in the bond's currency, and in UAH at the latest NBU rate.
    outstanding: Decimal
    outstanding_uah: Decimal
    # Fraction of all domestic bonds outstanding, by UAH value.
    market_share: Decimal
    next_payment_date: date | None
    last_trade: MarketQuote | None
    volume_30d_uah: Decimal
    last_auction: AuctionOut | None
    # The app's own bond with this ISIN, if any.
    instrument_id: int | None


class MarketBonds(BaseModel):
    trades_as_of: date | None
    outstanding_uah: Decimal
    bonds: list[MarketBond]


class MarketBondDetail(BaseModel):
    bond: MarketBond
    schedule: list[SecurityPayment]
    trades: list[MarketQuote]
    auctions: list[AuctionOut]


class HolderSlice(BaseModel):
    holder: Holder
    amount: Decimal
    share: Decimal
    # Change since the last day of the previous month / previous year; None without data then.
    change_month: Decimal | None
    change_year: Decimal | None


class HolderGroupOut(BaseModel):
    group: HolderGroup
    total: Decimal
    change_month: Decimal | None
    change_year: Decimal | None
    holders: list[HolderSlice]


class HolderPoint(BaseModel):
    day: date
    group: HolderGroup
    total: Decimal
    by_holder: dict[Holder, Decimal]


class HoldersReport(BaseModel):
    day: date
    month_base_day: date | None
    year_base_day: date | None
    groups: list[HolderGroupOut]
    # Last published day of every month, plus `day`.
    history: list[HolderPoint]


class Repayment(BaseModel):
    """A scheduled payment on all bonds of one ISIN outstanding today."""

    pay_date: date
    isin: str
    name: str
    currency: Currency
    kind: PaymentKind
    amount: Decimal
    # At the latest NBU rate, not the rate of the payment day.
    amount_uah: Decimal
