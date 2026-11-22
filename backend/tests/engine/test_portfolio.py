from datetime import date
from decimal import Decimal

from app.engine.portfolio import (
    Amount,
    BondTerms,
    FxAt,
    LotData,
    PaymentData,
    PeriodPnl,
    Portfolio,
    SaleData,
    accrued_coupon,
    missed_payments,
    xirr,
)
from app.engine.schedule import PaymentKind, generate_schedule

D = Decimal

# Bond used by most tests: 16.5 % semi-annual, coupons 82.50 on 1 Mar / 1 Sep, matures 2027-09-01.
OVDP = BondTerms(
    instrument_id=1,
    face_value=D("1000"),
    issue_date=date(2025, 3, 5),
    maturity_date=date(2027, 9, 1),
    schedule=tuple(generate_schedule(D("1000"), D("0.165"), 2, date(2025, 3, 5), date(2027, 9, 1))),
)


def lot(
    lot_id: int = 1,
    trade_date: date = date(2026, 1, 10),
    quantity: str = "100",
    total_cost: str = "105471",
    accrued_paid: str = "5971",
    fee: str = "0",
    fx: str = "42",
    instrument_id: int = 1,
) -> LotData:
    return LotData(
        lot_id,
        instrument_id,
        trade_date,
        D(quantity),
        D(total_cost),
        D(accrued_paid),
        D(fee),
        D(fx),
    )


def payment(
    payment_id: int, kind: PaymentKind, pay_date: date, amount: str, fx: str, fee: str = "0"
) -> PaymentData:
    return PaymentData(payment_id, 1, kind, pay_date, D(amount), D(fee), D(fx))


def fx_const(rate: str) -> FxAt:
    return lambda currency, _day: D(1) if currency == "UAH" else D(rate)


def test_interview_example_usd_includes_currency_loss() -> None:
    terms = BondTerms(
        1,
        D("1000"),
        date(2025, 1, 1),
        date(2026, 1, 1),
        schedule=tuple(
            generate_schedule(D("1000"), D("0.1"), 2, date(2025, 1, 1), date(2026, 1, 1))
        ),
    )
    p = Portfolio(
        {1: terms},
        [lot(trade_date=date(2025, 1, 2), total_cost="100000", accrued_paid="0", fx="41")],
        [],
        [
            payment(1, "coupon", date(2025, 7, 1), "5000", "41.5"),
            payment(2, "redemption", date(2026, 1, 1), "100000", "42"),
        ],
    )
    result = p.period_pnl([1], date(2025, 1, 1), date(2026, 1, 31), fx_const("43"))
    assert result.pnl.uah == D("5000.00")
    assert result.pnl.usd == D("62.41")
    assert result.invested.uah == D("100000.00")
    assert result.received.uah == D("105000.00")
    assert result.closing_value.uah == D("0.00")


def test_split_remainder_goes_to_largest_then_lowest_id() -> None:
    lots = [lot(lot_id=i, quantity="10") for i in (1, 2, 3)]
    p = Portfolio({1: OVDP}, lots, [], [])
    shares = p.allocate(payment(1, "coupon", date(2026, 3, 1), "100", "41"))
    assert shares == {1: (D("33.34"), D("0")), 2: (D("33.33"), D("0")), 3: (D("33.33"), D("0"))}


def test_allocation_uses_holdings_at_end_of_previous_day() -> None:
    lots = [
        lot(lot_id=1, quantity="100"),
        lot(lot_id=2, quantity="100", trade_date=date(2026, 3, 1)),
    ]
    sales = [SaleData(1, 1, date(2026, 2, 28), D("50"), D("50000"), D("0"), D("41"))]
    p = Portfolio({1: OVDP}, lots, sales, [])
    shares = p.allocate(payment(1, "coupon", date(2026, 3, 1), "4125", "41", fee="10"))
    assert shares == {1: (D("4125.00"), D("10.00"))}


def test_open_quantity_after_sale_and_redemption() -> None:
    sales = [SaleData(1, 1, date(2026, 5, 1), D("40"), D("41000"), D("0"), D("41"))]
    p = Portfolio(
        {1: OVDP},
        [lot()],
        sales,
        [payment(1, "redemption", date(2027, 9, 1), "60000", "40")],
    )
    assert p.open_quantity(1, date(2026, 1, 9)) == 0
    assert p.open_quantity(1, date(2026, 1, 10)) == 100
    assert p.open_quantity(1, date(2026, 5, 1)) == 60
    assert p.open_quantity(1, date(2027, 9, 1)) == 0


def test_accrued_coupon_is_linear_between_coupon_dates() -> None:
    # 2025-09-01 -> 2026-03-01 is 181 days; 131 days elapsed on 2026-01-10.
    assert accrued_coupon(OVDP, date(2026, 1, 10)) == D("82.50") * 131 / 181
    assert accrued_coupon(OVDP, date(2026, 3, 1)) == 0
    assert accrued_coupon(OVDP, date(2027, 9, 1)) == 0


def test_value_amortizes_clean_price_to_face_value() -> None:
    p = Portfolio({1: OVDP}, [lot()], [], [])
    # Clean cost 995.00 per unit; at maturity the clean value reaches face value 1000.
    assert p.unit_value(1, date(2026, 1, 10)) == D("995") + D("82.50") * 131 / 181
    assert p.unit_value(1, date(2027, 9, 1)) == D("1000")
    assert round(p.value(1, date(2026, 1, 10)), 2) == D("105470.99")


def test_period_pnl_starting_mid_holding() -> None:
    p = Portfolio(
        {1: OVDP},
        [lot(fee="50")],
        [],
        [payment(1, "coupon", date(2026, 3, 1), "8250", "41.5")],
    )
    result = p.period_pnl([1], date(2026, 2, 1), date(2026, 3, 31), fx_const("41"))
    # Opening at end of 2026-01-31: clean 995 + 5 * 21/599, accrued 82.5 * 152/181.
    opening = 100 * (D("995") + D("5") * 21 / 599 + D("82.50") * 152 / 181)
    closing = 100 * (D("995") + D("5") * 80 / 599 + D("82.50") * 30 / 184)
    assert result.opening_value.uah == round(opening, 2)
    assert result.closing_value.uah == round(closing, 2)
    assert result.invested.uah == D("0.00")
    assert result.received.uah == D("8250.00")
    assert result.pnl.uah == round(closing - opening + 8250, 2)
    assert result.pnl.usd == round(closing / 41 - opening / 41 + D("8250") / D("41.5"), 2)


def test_changing_purchase_rate_changes_only_usd() -> None:
    def pnl(fx: str) -> PeriodPnl:
        p = Portfolio({1: OVDP}, [lot(fx=fx)], [], [])
        return p.period_pnl([1], date(2026, 1, 1), date(2026, 2, 1), fx_const("42"))

    a, b = pnl("42"), pnl("40")
    assert a.pnl.uah == b.pnl.uah
    assert b.pnl.usd < a.pnl.usd


def test_xirr_simple_year() -> None:
    assert xirr([(date(2025, 1, 1), D("-1000")), (date(2026, 1, 1), D("1100"))]) == D("0.1")


def test_xirr_none_without_sign_change() -> None:
    assert xirr([(date(2025, 1, 1), D("-1000")), (date(2026, 1, 1), D("-5"))]) is None


def test_missed_payments_lists_unrecorded_coupons_while_held() -> None:
    portfolio = Portfolio(
        {1: OVDP},
        [lot(trade_date=date(2026, 1, 10))],
        [],
        [payment(1, "coupon", date(2026, 3, 3), "8250", "41.5")],
    )

    missed = missed_payments(portfolio, date(2026, 12, 31))

    assert [(m.item.kind, m.item.pay_date, m.quantity) for m in missed] == [
        ("coupon", date(2026, 9, 1), D("100"))
    ]


def test_missed_payments_ignores_coupons_before_purchase_and_after_sale() -> None:
    portfolio = Portfolio(
        {1: OVDP},
        [lot(trade_date=date(2026, 3, 1))],
        [SaleData(1, 1, date(2026, 8, 31), D("100"), D("100000"), D("0"), D("41"))],
        [],
    )

    assert missed_payments(portfolio, date(2027, 12, 31)) == []


def test_missed_payments_includes_unrecorded_redemption() -> None:
    portfolio = Portfolio({1: OVDP}, [lot(trade_date=date(2027, 3, 10))], [], [])

    missed = missed_payments(portfolio, date(2027, 9, 1))

    assert [(m.item.kind, m.item.pay_date) for m in missed] == [
        ("coupon", date(2027, 9, 1)),
        ("redemption", date(2027, 9, 1)),
    ]


def test_one_recorded_payment_matches_one_scheduled_payment() -> None:
    monthly = BondTerms(
        instrument_id=1,
        face_value=D("1000"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2027, 1, 1),
        schedule=tuple(
            generate_schedule(D("1000"), D("0.12"), 12, date(2025, 1, 1), date(2027, 1, 1))
        ),
    )
    portfolio = Portfolio(
        {1: monthly},
        [lot(trade_date=date(2026, 1, 10))],
        [],
        [payment(1, "coupon", date(2026, 2, 1), "1000", "41")],
    )

    missed = missed_payments(portfolio, date(2026, 3, 1))

    assert [m.item.pay_date for m in missed] == [date(2026, 3, 1)]


def test_usd_bond_converts_flows_at_their_own_rate_and_values_at_the_valuation_rate() -> None:
    usd_bond = BondTerms(
        instrument_id=1,
        face_value=D("1000"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2027, 1, 1),
        schedule=(),
        currency="USD",
    )
    bought = LotData(1, 1, date(2025, 1, 1), D("10"), D("10000"), D("0"), D("0"), D("40"), D("40"))
    redeemed = PaymentData(
        1, 1, "redemption", date(2027, 1, 1), D("10000"), D("0"), D("42"), D("42")
    )
    p = Portfolio({1: usd_bond}, [bought], [], [redeemed])

    closed = p.period_pnl([1], date(2025, 1, 1), date(2027, 1, 1), fx_const("42"))
    assert (closed.pnl.uah, closed.pnl.usd) == (D("20000.00"), D("0.00"))

    held = p.period_pnl([1], date(2025, 1, 1), date(2026, 1, 1), fx_const("41"))
    assert held.closing_value == Amount(D("410000.00"), D("10000.00"))


def test_eur_bond_values_at_eur_rate_and_reports_usd_through_uah() -> None:
    eur_bond = BondTerms(
        instrument_id=1,
        face_value=D("1000"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2027, 1, 1),
        schedule=(),
        currency="EUR",
    )
    bought = LotData(1, 1, date(2025, 1, 1), D("1"), D("1000"), D("0"), D("0"), D("40"), D("44"))
    p = Portfolio({1: eur_bond}, [bought], [], [])

    def rates(currency: str, _day: date) -> Decimal:
        return {"UAH": D("1"), "USD": D("40"), "EUR": D("46")}[currency]

    result = p.period_pnl([1], date(2025, 1, 1), date(2026, 1, 1), rates)
    assert result.invested == Amount(D("44000.00"), D("1100.00"))
    assert result.closing_value == Amount(D("46000.00"), D("1150.00"))


def _interview_portfolio() -> Portfolio:
    terms = BondTerms(
        1,
        D("1000"),
        date(2025, 1, 1),
        date(2026, 1, 1),
        schedule=tuple(
            generate_schedule(D("1000"), D("0.1"), 2, date(2025, 1, 1), date(2026, 1, 1))
        ),
    )
    return Portfolio(
        {1: terms},
        [lot(trade_date=date(2025, 1, 2), total_cost="100000", accrued_paid="0", fx="41")],
        [],
        [
            payment(1, "coupon", date(2025, 7, 1), "5000", "41.5"),
            payment(2, "redemption", date(2026, 1, 1), "100000", "42"),
        ],
    )


def test_usd_cash_alternative_earns_nothing_in_usd_and_the_rate_move_in_uah() -> None:
    p = _interview_portfolio()
    result = p.usd_cash_alternative([1], date(2025, 1, 1), date(2026, 1, 31), fx_const("43"))
    dollars = D(100000) / D(41) - D(5000) / D("41.5") - D(100000) / D(42)
    assert result.closing_value.usd == dollars.quantize(D("0.01"))
    assert result.pnl.usd == D("0.00")
    assert str(result.pnl.usd) == "0.00"
    assert str(result.xirr_usd) == "0.0"
    assert result.pnl.uah == (dollars * 43 + 5000).quantize(D("0.01"))


def test_uah_deposit_alternative_compounds_at_the_rate() -> None:
    p = Portfolio({1: OVDP}, [lot(trade_date=date(2026, 1, 10), total_cost="100000")], [], [])
    start, end = date(2026, 1, 10), date(2027, 1, 10)
    result = p.uah_deposit_alternative([1], start, end, fx_const("40"), D("0.1"))
    assert result.closing_value.uah == D("110000.00")
    assert result.closing_value.usd == D("2750.00")
    assert result.pnl.uah == D("10000.00")
    assert result.xirr_uah == D("0.1")


def test_uah_deposit_alternative_starts_from_the_opening_value() -> None:
    p = Portfolio({1: OVDP}, [lot(trade_date=date(2026, 1, 10))], [], [])
    start, end = date(2026, 3, 1), date(2026, 3, 1)
    opening = p.period_pnl([1], start, end, fx_const("40")).opening_value.uah
    result = p.uah_deposit_alternative([1], start, end, fx_const("40"), D("0.2"))
    assert result.closing_value.uah == (opening * D("1.2") ** (D(1) / 365)).quantize(D("0.01"))


def test_alternatives_of_no_packages_are_zero() -> None:
    p = Portfolio({1: OVDP}, [], [], [])
    result = p.uah_deposit_alternative(
        [], date(2026, 1, 1), date(2026, 6, 1), fx_const("40"), D("0.1")
    )
    assert result.pnl == Amount(D("0.00"), D("0.00"))
    assert result.xirr_uah is None
