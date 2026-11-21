from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.common import (
    FxRate,
    NonNegativeMoney,
    Note,
    PaymentKind,
    PositiveMoney,
    Quantity,
    UnitPrice,
)


class LotIn(BaseModel):
    instrument_id: int
    trade_date: date
    quantity: Quantity
    price_per_unit: UnitPrice
    total_cost_uah: PositiveMoney
    accrued_paid_uah: NonNegativeMoney = NonNegativeMoney(0)
    fee_uah: NonNegativeMoney = NonNegativeMoney(0)
    fx_rate: FxRate
    note: Note


class LotOut(LotIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class SaleIn(BaseModel):
    lot_id: int
    trade_date: date
    quantity: Quantity
    total_proceeds_uah: PositiveMoney
    accrued_received_uah: NonNegativeMoney = NonNegativeMoney(0)
    fee_uah: NonNegativeMoney = NonNegativeMoney(0)
    fx_rate: FxRate
    note: Note


class SaleOut(SaleIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class PaymentIn(BaseModel):
    instrument_id: int
    kind: PaymentKind
    pay_date: date
    total_amount_uah: PositiveMoney
    fee_uah: NonNegativeMoney = NonNegativeMoney(0)
    fx_rate: FxRate
    note: Note


class PaymentOut(PaymentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
