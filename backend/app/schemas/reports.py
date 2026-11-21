from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.engine.portfolio import Amount, PeriodPnl


class AmountOut(BaseModel):
    uah: Decimal
    usd: Decimal

    @classmethod
    def of(cls, amount: Amount) -> "AmountOut":
        return cls(uah=amount.uah, usd=amount.usd)


class PnlOut(BaseModel):
    opening_value: AmountOut
    closing_value: AmountOut
    invested: AmountOut
    received: AmountOut
    pnl: AmountOut

    @classmethod
    def of(cls, pnl: PeriodPnl) -> "PnlOut":
        return cls(
            opening_value=AmountOut.of(pnl.opening_value),
            closing_value=AmountOut.of(pnl.closing_value),
            invested=AmountOut.of(pnl.invested),
            received=AmountOut.of(pnl.received),
            pnl=AmountOut.of(pnl.pnl),
        )


class LotSummary(BaseModel):
    lot_id: int
    instrument_id: int
    isin: str
    name: str
    trade_date: date
    maturity_date: date
    quantity: Decimal
    open_quantity: Decimal
    pnl: PnlOut
    xirr_uah: Decimal | None
    xirr_usd: Decimal | None


class PortfolioReport(BaseModel):
    start: date
    end: date
    totals: PnlOut
    # Split of totals.pnl by package state at `end`: realized = fully sold or redeemed packages,
    # unrealized = packages still (partly) held. realized + unrealized == totals.pnl exactly.
    realized: AmountOut
    unrealized: AmountOut
    xirr_uah: Decimal | None
    xirr_usd: Decimal | None
    lots: list[LotSummary]


class FlowOut(BaseModel):
    day: date
    kind: Literal["buy", "sell", "coupon", "redemption", "fee"]
    amount_uah: Decimal
    fx_rate: Decimal
    amount_usd: Decimal


class LotReport(BaseModel):
    start: date
    end: date
    summary: LotSummary
    flows: list[FlowOut]


class TimeseriesPoint(BaseModel):
    day: date
    value: AmountOut
    cumulative_pnl: AmountOut


class UpcomingPayment(BaseModel):
    pay_date: date
    instrument_id: int
    isin: str
    name: str
    kind: Literal["coupon", "redemption"]
    amount_per_unit: Decimal
    quantity: Decimal
    expected_uah: Decimal
    expected_usd_estimate: Decimal


class PaymentAllocation(BaseModel):
    lot_id: int
    amount_uah: Decimal


class ReceivedPayment(BaseModel):
    payment_id: int
    pay_date: date
    instrument_id: int
    isin: str
    name: str
    kind: Literal["coupon", "redemption"]
    # Units held at the end of the previous day, which the amount was split over.
    quantity: Decimal
    total_amount_uah: Decimal
    fee_uah: Decimal
    fx_rate: Decimal
    amount_usd: Decimal
    allocations: list[PaymentAllocation]
