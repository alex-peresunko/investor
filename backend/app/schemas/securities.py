from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import Currency, PaymentKind
from app.schemas.instruments import InstrumentIn


class SecurityPayment(BaseModel):
    kind: PaymentKind
    pay_date: date
    amount_per_unit: Decimal


class SecurityOut(InstrumentIn):
    """Bond terms and payment schedule as NBU publishes them; valid as an InstrumentCreate body."""

    schedule: list[SecurityPayment]
    # Coupon set per period (CFI attribute "V"), e.g. CPI-linked; future coupons may change.
    variable_rate: bool


class SecuritySummary(BaseModel):
    isin: str
    name: str
    currency: Currency
    maturity_date: date
    variable_rate: bool
