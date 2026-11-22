from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import Currency, PaymentKind, PositiveMoney

Isin = Annotated[str, Field(pattern=r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")]


class InstrumentIn(BaseModel):
    isin: Isin
    name: str = Field(min_length=1, max_length=200)
    currency: Currency = "UAH"
    face_value: PositiveMoney
    coupon_rate: Annotated[Decimal, Field(ge=0, lt=1, max_digits=9, decimal_places=6)]
    coupon_frequency: Literal[0, 1, 2, 4, 12]
    issue_date: date
    maturity_date: date

    @model_validator(mode="after")
    def _maturity_after_issue(self) -> Self:
        if self.maturity_date <= self.issue_date:
            raise ValueError("maturity_date must be after issue_date")
        return self


class InstrumentOut(InstrumentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str


class ScheduledPaymentIn(BaseModel):
    kind: PaymentKind
    pay_date: date
    amount_per_unit: Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]


class ScheduledPaymentOut(ScheduledPaymentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class InstrumentCreate(InstrumentIn):
    # Used as the payment schedule instead of generating one from the terms.
    schedule: list[ScheduledPaymentIn] | None = None
