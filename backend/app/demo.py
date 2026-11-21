"""Demo data: bonds and operations over the 24 months before today. Run by scripts/demo.sh."""

import sys
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.core.db import get_engine
from app.engine.portfolio import BondTerms, accrued_coupon
from app.engine.schedule import add_months, generate_schedule
from app.models import Instrument, Lot
from app.repositories import operations as operations_repo
from app.schemas.instruments import InstrumentIn
from app.schemas.operations import LotIn, PaymentIn, SaleIn
from app.services import fx, instruments, operations

CENT = Decimal("0.01")
FACE = Decimal(1000)
BROKER_FEE = Decimal("0.001")


@dataclass(frozen=True)
class DemoBond:
    serial: str
    coupon_rate: str
    issue_months: int
    maturity_months: int


@dataclass(frozen=True)
class DemoLot:
    bond: int
    day: int
    quantity: int
    market_yield: str
    via_broker: bool = False


@dataclass(frozen=True)
class DemoSale:
    lot: int
    day: int
    quantity: int
    market_yield: str


# Months and days count from 24 months before today.
BONDS = [
    DemoBond("3181", "0.1620", -6, 10),
    DemoBond("3264", "0.1700", -3, 21),
    DemoBond("3512", "0.1650", 2, 34),
    DemoBond("3793", "0.1595", 9, 46),
    DemoBond("4015", "0", 13, 25),
    DemoBond("4236", "0.1540", 19, 54),
]
LOTS = [
    DemoLot(0, 5, 300, "0.168"),
    DemoLot(1, 20, 200, "0.166"),
    DemoLot(2, 75, 250, "0.165"),
    DemoLot(1, 130, 150, "0.160", via_broker=True),
    DemoLot(2, 190, 200, "0.162"),
    DemoLot(3, 310, 400, "0.160"),
    DemoLot(2, 400, 150, "0.158", via_broker=True),
    DemoLot(3, 470, 200, "0.157"),
    DemoLot(4, 420, 300, "0.155"),
    DemoLot(5, 650, 350, "0.154"),
    DemoLot(3, 700, 100, "0.152", via_broker=True),
    DemoLot(5, 715, 100, "0.151"),
]
SALES = [
    DemoSale(3, 560, 150, "0.150"),
    DemoSale(2, 520, 100, "0.152"),
    DemoSale(6, 600, 50, "0.150"),
]


def isin(serial: str) -> str:
    """UA40002 + 4-digit serial + ISIN check digit (Luhn over the letters expanded to numbers)."""
    body = f"UA40002{serial}"
    digits = "".join(str(int(ch, 36)) for ch in body)
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch) * (2 if i % 2 == 0 else 1)
        total += d // 10 + d % 10
    return f"{body}{(10 - total % 10) % 10}"


def _weekday(day: date) -> date:
    return day + timedelta(days=7 - day.weekday()) if day.weekday() >= 5 else day


def _dirty_price(terms: BondTerms, day: date, market_yield: Decimal, frequency: int) -> Decimal:
    """Remaining flows at `market_yield`: compounded per coupon period, simple if zero-coupon."""
    price = Decimal(0)
    for item in terms.schedule:
        if item.pay_date <= day:
            continue
        years = Decimal((item.pay_date - day).days) / Decimal(365)
        if frequency:
            factor = (1 + market_yield / frequency) ** int(years * frequency)
            factor *= 1 + market_yield / frequency * (years * frequency % 1)
        else:
            factor = 1 + market_yield * years
        price += item.amount_per_unit / factor
    return price.quantize(CENT, ROUND_HALF_UP)


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, ROUND_HALF_UP)


def has_data(session: Session) -> bool:
    return bool(session.scalar(select(exists().where(Instrument.id.is_not(None)))))


def seed(session: Session, today: date) -> None:
    start = add_months(today, -24)
    created: list[tuple[Instrument, BondTerms]] = []
    for bond in BONDS:
        issue = _weekday(add_months(start, bond.issue_months))
        maturity = _weekday(add_months(start, bond.maturity_months))
        rate = Decimal(bond.coupon_rate)
        frequency = 2 if rate else 0
        name = (
            f"OVDP {rate * 100:.2f}% {maturity:%m/%Y}"
            if rate
            else f"OVDP discount {maturity:%m/%Y}"
        )
        instrument = instruments.create_instrument(
            session,
            InstrumentIn(
                isin=isin(bond.serial),
                name=name,
                face_value=FACE,
                coupon_rate=rate,
                coupon_frequency=frequency,
                issue_date=issue,
                maturity_date=maturity,
            ),
        )
        schedule = tuple(generate_schedule(FACE, rate, frequency, issue, maturity))
        terms = BondTerms(instrument.id, FACE, issue, maturity, schedule)
        created.append((instrument, terms))

    lots: list[Lot] = []
    for spec in LOTS:
        instrument, terms = created[spec.bond]
        day = _weekday(start + timedelta(days=spec.day))
        price = _dirty_price(terms, day, Decimal(spec.market_yield), instrument.coupon_frequency)
        qty = Decimal(spec.quantity)
        cost = qty * price
        lots.append(
            operations.create_lot(
                session,
                LotIn(
                    instrument_id=instrument.id,
                    trade_date=day,
                    quantity=qty,
                    price_per_unit=price,
                    total_cost_uah=cost,
                    accrued_paid_uah=_cents(qty * accrued_coupon(terms, day)),
                    fee_uah=_cents(cost * BROKER_FEE) if spec.via_broker else Decimal(0),
                    fx_rate=fx.usd_rate(session, day),
                    note="Secondary market via broker" if spec.via_broker else "Primary auction",
                ),
            )
        )

    for sale in SALES:
        lot = lots[sale.lot]
        instrument, terms = next(c for c in created if c[0].id == lot.instrument_id)
        day = _weekday(start + timedelta(days=sale.day))
        price = _dirty_price(terms, day, Decimal(sale.market_yield), instrument.coupon_frequency)
        qty = Decimal(sale.quantity)
        operations.create_sale(
            session,
            SaleIn(
                lot_id=lot.id,
                trade_date=day,
                quantity=qty,
                total_proceeds_uah=qty * price,
                accrued_received_uah=_cents(qty * accrued_coupon(terms, day)),
                fee_uah=_cents(qty * price * BROKER_FEE),
                fx_rate=fx.usd_rate(session, day),
                note=None,
            ),
        )

    for instrument, terms in created:
        for item in terms.schedule:
            if item.pay_date > today:
                continue
            held = operations_repo.held_quantity_before(session, instrument.id, item.pay_date)
            if held <= 0:
                continue
            operations.create_payment(
                session,
                PaymentIn(
                    instrument_id=instrument.id,
                    kind=item.kind,
                    pay_date=item.pay_date,
                    total_amount_uah=_cents(held * item.amount_per_unit),
                    fx_rate=fx.usd_rate(session, item.pay_date),
                    note=None,
                ),
            )


def main() -> int:
    with Session(get_engine()) as session:
        if has_data(session):
            print("The database already has bonds; demo data was not loaded.")
            return 0
        seed(session, date.today())  # noqa: DTZ011
        session.commit()
    print("Demo data loaded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
