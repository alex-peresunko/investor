import calendar
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

PaymentKind = Literal["coupon", "redemption"]
CENT = Decimal("0.01")


@dataclass(frozen=True)
class ScheduleItem:
    kind: PaymentKind
    pay_date: date
    amount_per_unit: Decimal


def add_months(day: date, months: int) -> date:
    """Shifts by whole months, clamping to the last day of the target month."""
    years, month_index = divmod(day.month - 1 + months, 12)
    year, month = day.year + years, month_index + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def generate_schedule(
    face_value: Decimal,
    coupon_rate: Decimal,
    coupon_frequency: int,
    issue_date: date,
    maturity_date: date,
) -> list[ScheduleItem]:
    """Coupon dates step back from maturity until the issue date (exclusive), plus redemption.

    Sorted by date; on the maturity date the coupon comes before the redemption.
    """
    items: list[ScheduleItem] = []
    if coupon_frequency > 0 and coupon_rate > 0:
        step = 12 // coupon_frequency
        coupon = (face_value * coupon_rate / coupon_frequency).quantize(CENT, ROUND_HALF_UP)
        n = 0
        while (pay_date := add_months(maturity_date, -step * n)) > issue_date:
            items.append(ScheduleItem("coupon", pay_date, coupon))
            n += 1
    items.append(ScheduleItem("redemption", maturity_date, face_value))
    return sorted(items, key=lambda item: (item.pay_date, item.kind))
