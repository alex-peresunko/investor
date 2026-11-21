from datetime import date
from decimal import Decimal

from app.engine.schedule import ScheduleItem, add_months, generate_schedule


def test_add_months_clamps_to_month_end() -> None:
    assert add_months(date(2027, 8, 31), -6) == date(2027, 2, 28)
    assert add_months(date(2026, 1, 15), 13) == date(2027, 2, 15)


def test_semiannual_schedule() -> None:
    items = generate_schedule(
        Decimal("1000"), Decimal("0.165"), 2, date(2025, 3, 2), date(2026, 9, 2)
    )
    assert items == [
        ScheduleItem("coupon", date(2025, 9, 2), Decimal("82.50")),
        ScheduleItem("coupon", date(2026, 3, 2), Decimal("82.50")),
        ScheduleItem("coupon", date(2026, 9, 2), Decimal("82.50")),
        ScheduleItem("redemption", date(2026, 9, 2), Decimal("1000")),
    ]


def test_zero_coupon_has_only_redemption() -> None:
    items = generate_schedule(Decimal("1000"), Decimal("0"), 0, date(2026, 1, 1), date(2027, 1, 1))
    assert items == [ScheduleItem("redemption", date(2027, 1, 1), Decimal("1000"))]
