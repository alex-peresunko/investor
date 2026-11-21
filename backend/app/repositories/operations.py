from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Lot, Payment, Sale


def list_lots(session: Session, instrument_id: int | None) -> Sequence[Lot]:
    stmt = select(Lot).order_by(Lot.trade_date, Lot.id)
    if instrument_id is not None:
        stmt = stmt.where(Lot.instrument_id == instrument_id)
    return session.scalars(stmt).all()


def list_sales(session: Session, lot_id: int | None) -> Sequence[Sale]:
    stmt = select(Sale).order_by(Sale.trade_date, Sale.id)
    if lot_id is not None:
        stmt = stmt.where(Sale.lot_id == lot_id)
    return session.scalars(stmt).all()


def list_payments(session: Session, instrument_id: int | None) -> Sequence[Payment]:
    stmt = select(Payment).order_by(Payment.pay_date, Payment.id)
    if instrument_id is not None:
        stmt = stmt.where(Payment.instrument_id == instrument_id)
    return session.scalars(stmt).all()


def sold_quantity(session: Session, lot_id: int, exclude_sale_id: int | None = None) -> Decimal:
    stmt = select(func.coalesce(func.sum(Sale.quantity), 0)).where(Sale.lot_id == lot_id)
    if exclude_sale_id is not None:
        stmt = stmt.where(Sale.id != exclude_sale_id)
    return Decimal(session.scalar(stmt) or 0)


def earliest_sale_date(session: Session, lot_id: int) -> date | None:
    return session.scalar(select(func.min(Sale.trade_date)).where(Sale.lot_id == lot_id))


def held_quantity_before(session: Session, instrument_id: int, day: date) -> Decimal:
    """Units of the instrument held at the end of the day before `day`."""
    bought = session.scalar(
        select(func.coalesce(func.sum(Lot.quantity), 0)).where(
            Lot.instrument_id == instrument_id, Lot.trade_date < day
        )
    )
    sold = session.scalar(
        select(func.coalesce(func.sum(Sale.quantity), 0))
        .join(Lot, Sale.lot_id == Lot.id)
        .where(Lot.instrument_id == instrument_id, Sale.trade_date < day)
    )
    return Decimal(bought or 0) - Decimal(sold or 0)
