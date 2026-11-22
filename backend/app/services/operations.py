from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models import Instrument, Lot, Payment, Sale
from app.repositories import instruments as instruments_repo
from app.repositories import operations as repo
from app.schemas.operations import LotIn, PaymentIn, SaleIn


def _instrument_for(session: Session, instrument_id: int) -> Instrument:
    instrument = instruments_repo.get(session, instrument_id)
    if instrument is None:
        raise ValidationError("bond_missing", id=instrument_id)
    return instrument


def _check_currency_rate(instrument: Instrument, currency_rate: Decimal | None) -> None:
    needs_rate = instrument.currency not in ("UAH", "USD")
    if needs_rate and currency_rate is None:
        raise ValidationError("currency_rate_required", currency=instrument.currency)
    if not needs_rate and currency_rate is not None:
        raise ValidationError("currency_rate_not_applicable", currency=instrument.currency)


def _ensure_payments_held(session: Session, *instrument_ids: int) -> None:
    """Raises if any recorded payment of these bonds no longer has holdings the day before it;
    the engine would allocate such a payment to no package and drop it from every report."""
    session.flush()
    for instrument_id in set(instrument_ids):
        for payment in repo.list_payments(session, instrument_id):
            if repo.held_quantity_before(session, instrument_id, payment.pay_date) <= 0:
                raise ConflictError("payment_loses_holdings", date=payment.pay_date.isoformat())


# --- Lots ---


def list_lots(session: Session, instrument_id: int | None) -> Sequence[Lot]:
    return repo.list_lots(session, instrument_id)


def get_lot(session: Session, lot_id: int) -> Lot:
    lot = session.get(Lot, lot_id)
    if lot is None:
        raise NotFoundError("package_not_found", id=lot_id)
    return lot


def _check_lot(instrument: Instrument, data: LotIn) -> None:
    if not instrument.issue_date <= data.trade_date < instrument.maturity_date:
        raise ValidationError("purchase_date_out_of_range")
    _check_currency_rate(instrument, data.currency_rate)


def create_lot(session: Session, data: LotIn) -> Lot:
    _check_lot(_instrument_for(session, data.instrument_id), data)
    lot = Lot(**data.model_dump())
    session.add(lot)
    session.flush()
    session.refresh(lot)
    return lot


def update_lot(session: Session, lot_id: int, data: LotIn) -> Lot:
    lot = get_lot(session, lot_id)
    _check_lot(_instrument_for(session, data.instrument_id), data)
    sold = repo.sold_quantity(session, lot_id)
    if sold > 0 and data.instrument_id != lot.instrument_id:
        raise ValidationError("package_bond_locked")
    if data.quantity < sold:
        raise ValidationError("quantity_below_sold", sold=f"{sold.normalize():f}")
    first_sale = repo.earliest_sale_date(session, lot_id)
    if first_sale is not None and data.trade_date > first_sale:
        raise ValidationError("purchase_after_first_sale")
    old_instrument_id = lot.instrument_id
    for field, value in data.model_dump().items():
        setattr(lot, field, value)
    _ensure_payments_held(session, old_instrument_id, lot.instrument_id)
    session.refresh(lot)
    return lot


def delete_lot(session: Session, lot_id: int) -> None:
    lot = get_lot(session, lot_id)
    if repo.sold_quantity(session, lot_id) > 0:
        raise ConflictError("package_has_sales")
    session.delete(lot)
    _ensure_payments_held(session, lot.instrument_id)


# --- Sales ---


def list_sales(session: Session, lot_id: int | None) -> Sequence[Sale]:
    return repo.list_sales(session, lot_id)


def get_sale(session: Session, sale_id: int) -> Sale:
    sale = session.get(Sale, sale_id)
    if sale is None:
        raise NotFoundError("sale_not_found", id=sale_id)
    return sale


def _check_sale(session: Session, data: SaleIn, sale_id: int | None) -> None:
    lot = session.get(Lot, data.lot_id)
    if lot is None:
        raise ValidationError("package_missing", id=data.lot_id)
    instrument = _instrument_for(session, lot.instrument_id)
    if not lot.trade_date <= data.trade_date < instrument.maturity_date:
        raise ValidationError("sale_date_out_of_range")
    _check_currency_rate(instrument, data.currency_rate)
    available = lot.quantity - repo.sold_quantity(session, lot.id, exclude_sale_id=sale_id)
    if data.quantity > available:
        raise ValidationError("sale_exceeds_available", available=f"{available.normalize():f}")


def _lot_instrument_id(session: Session, lot_id: int) -> int:
    lot = session.get(Lot, lot_id)
    assert lot is not None
    return lot.instrument_id


def create_sale(session: Session, data: SaleIn) -> Sale:
    _check_sale(session, data, sale_id=None)
    sale = Sale(**data.model_dump())
    session.add(sale)
    _ensure_payments_held(session, _lot_instrument_id(session, sale.lot_id))
    session.refresh(sale)
    return sale


def update_sale(session: Session, sale_id: int, data: SaleIn) -> Sale:
    sale = get_sale(session, sale_id)
    _check_sale(session, data, sale_id=sale_id)
    old_instrument_id = _lot_instrument_id(session, sale.lot_id)
    for field, value in data.model_dump().items():
        setattr(sale, field, value)
    _ensure_payments_held(session, old_instrument_id, _lot_instrument_id(session, sale.lot_id))
    session.refresh(sale)
    return sale


def delete_sale(session: Session, sale_id: int) -> None:
    session.delete(get_sale(session, sale_id))
    session.flush()


# --- Payments (coupons and redemptions) ---


def list_payments(session: Session, instrument_id: int | None) -> Sequence[Payment]:
    return repo.list_payments(session, instrument_id)


def get_payment(session: Session, payment_id: int) -> Payment:
    payment = session.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("payment_not_found", id=payment_id)
    return payment


def _check_payment(session: Session, data: PaymentIn) -> None:
    _check_currency_rate(_instrument_for(session, data.instrument_id), data.currency_rate)
    if repo.held_quantity_before(session, data.instrument_id, data.pay_date) <= 0:
        raise ValidationError("payment_without_holdings")


def create_payment(session: Session, data: PaymentIn) -> Payment:
    _check_payment(session, data)
    payment = Payment(**data.model_dump())
    session.add(payment)
    _ensure_payments_held(session, payment.instrument_id)
    session.refresh(payment)
    return payment


def update_payment(session: Session, payment_id: int, data: PaymentIn) -> Payment:
    payment = get_payment(session, payment_id)
    _check_payment(session, data)
    old_instrument_id = payment.instrument_id
    for field, value in data.model_dump().items():
        setattr(payment, field, value)
    _ensure_payments_held(session, old_instrument_id, payment.instrument_id)
    session.refresh(payment)
    return payment


def delete_payment(session: Session, payment_id: int) -> None:
    session.delete(get_payment(session, payment_id))
    session.flush()
