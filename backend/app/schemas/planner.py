from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.engine.planner import LadderPeriod
from app.schemas.common import Currency


class PlannedPurchase(BaseModel):
    buy_date: date
    isin: str
    name: str
    maturity_date: date
    quantity: int
    # Per bond in the plan's currency: clean price plus coupon accrued on buy_date.
    price: Decimal
    cost: Decimal
    # Latest known yield, from a secondary-market trade or an auction, whichever is newer.
    yield_rate: Decimal | None
    # No trade in the last 30 days: priced at face value.
    price_estimated: bool
    variable_rate: bool
    # The app's own bond with this ISIN, if any.
    instrument_id: int | None


class PlanAmount(BaseModel):
    # First day of a month (coupons) or of a ladder period (redemptions).
    start: date
    current: Decimal
    with_plan: Decimal


class PurchasePlan(BaseModel):
    currency: Currency
    period: LadderPeriod
    start: date
    end: date
    coupons: list[PlanAmount]
    redemptions: list[PlanAmount]
    purchases: list[PlannedPurchase]
    invested: Decimal
    cash_left: Decimal
    # Bonds in the currency that passed the filters and mature within the horizon of some
    # purchase day.
    candidates: int
