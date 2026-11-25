from datetime import date
from decimal import Decimal

from app.engine.planner import Candidate, Inflow, horizon, plan
from app.engine.portfolio import BondTerms
from app.engine.schedule import generate_schedule

D = Decimal
TODAY = date(2026, 11, 25)


def bond(
    isin: str, issue: date, maturity: date, rate: str = "0.16", price: str = "1000"
) -> Candidate:
    terms = BondTerms(
        instrument_id=0,
        face_value=D("1000"),
        issue_date=issue,
        maturity_date=maturity,
        schedule=tuple(generate_schedule(D("1000"), D(rate), 2, issue, maturity)),
    )
    return Candidate(isin=isin, terms=terms, clean_price=D(price), yield_rate=D(rate))


def test_horizon_is_whole_months_from_next_month() -> None:
    assert horizon(TODAY, 2) == (date(2026, 12, 1), date(2028, 11, 30))


def test_buys_the_bond_whose_coupons_fill_empty_months() -> None:
    held = [Inflow(date(2027, m, 15), "coupon", D("800")) for m in (1, 7)]
    held += [Inflow(date(2028, m, 15), "coupon", D("800")) for m in (1, 7)]
    same_months = bond("UA_JAN_JUL", date(2026, 1, 20), date(2028, 7, 20))
    other_months = bond("UA_APR_OCT", date(2026, 4, 20), date(2028, 10, 20))

    result = plan(
        today=TODAY,
        years=2,
        period="year",
        held=held,
        candidates=[same_months, other_months],
        extra_now=D("10000"),
    )

    assert {p.isin for p in result.purchases if p.day == TODAY} == {"UA_APR_OCT"}
    assert result.coupons_after[date(2027, 4, 1)] > 0
    assert result.coupons_before[date(2027, 4, 1)] == 0


def test_redemptions_go_to_the_empty_ladder_period() -> None:
    held = [Inflow(date(2027, 6, 1), "redemption", D("10000"))]
    first_year = bond("UA_Y1", date(2025, 6, 1), date(2027, 6, 1), rate="0.18")
    second_year = bond("UA_Y2", date(2025, 6, 1), date(2028, 6, 1), rate="0.15")

    result = plan(
        today=TODAY,
        years=2,
        period="year",
        held=held,
        candidates=[first_year, second_year],
        extra_now=D("10000"),
    )

    assert [p.isin for p in result.purchases if p.day == TODAY] == ["UA_Y2"]
    assert result.redemptions_after[date(2027, 12, 1)] > 0


def test_price_includes_accrued_coupon_and_cash_left_carries() -> None:
    candidate = bond("UA_ONLY", date(2026, 6, 1), date(2027, 6, 1))

    result = plan(
        today=TODAY,
        years=1,
        period="quarter",
        held=[],
        candidates=[candidate],
        extra_now=D("1500"),
    )

    # 80 coupon over 1 Jun to 1 Dec, 177 of 183 days accrued on 25 Nov.
    (first, *_) = result.purchases
    assert first.day == TODAY
    assert first.quantity == 1
    assert first.price == D("1077.38")
    assert first.cost + D("422.62") == D("1500")


def test_reinvests_redemptions_and_skips_bonds_maturing_after_the_horizon() -> None:
    held = [Inflow(date(2027, 3, 1), "redemption", D("5000"))]
    short = bond("UA_SHORT", date(2026, 3, 1), date(2027, 9, 1))
    beyond = bond("UA_LONG", date(2026, 3, 1), date(2029, 9, 1))

    result = plan(today=TODAY, years=1, period="quarter", held=held, candidates=[short, beyond])

    assert [(p.day, p.isin) for p in result.purchases] == [(date(2027, 3, 1), "UA_SHORT")]
    assert result.invested == result.purchases[0].cost


def test_min_purchase_waits_for_enough_cash() -> None:
    candidate = bond("UA_ONLY", date(2026, 3, 1), date(2027, 9, 1))

    result = plan(
        today=TODAY,
        years=1,
        period="year",
        held=[],
        candidates=[candidate],
        extra_monthly=D("1500"),
        min_purchase=D("4000"),
    )

    assert result.purchases[0].day == date(2027, 2, 1)


def test_redemptions_roll_over_to_the_far_end() -> None:
    held = [Inflow(date(2027, 6, 1), "redemption", D("10000"))]
    second_year = bond("UA_Y2", date(2025, 6, 1), date(2028, 6, 1))
    third_year = bond("UA_Y3", date(2025, 6, 1), date(2029, 6, 1))

    result = plan(
        today=TODAY,
        years=2,
        period="year",
        held=held,
        candidates=[second_year, third_year],
        extra_now=D("10000"),
    )

    # Today the window ends in November 2028, so only UA_Y2; the June 2027 redemption reaches
    # to June 2029 and fills the next empty year.
    assert {p.isin for p in result.purchases if p.day == TODAY} == {"UA_Y2"}
    assert {p.isin for p in result.purchases if p.day == date(2027, 6, 1)} == {"UA_Y3"}
    assert result.redemptions_after[date(2028, 12, 1)] > 0
