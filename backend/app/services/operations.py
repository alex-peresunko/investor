from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models import Instrument, Lot, Payment, Sale
from app.repositories import instruments as instruments_repo
from app.repositories import operations as repo
from app.schemas.operations import LotIn, PaymentIn, SaleIn


def _instrument_for(session: Session, instrument_id: int) -> Instrument:
    instrument = instruments_repo.get(session, instrument_id)
    if instrument is None:
        raise ValidationError(f"Bond {instrument_id} does not exist")
    return instrument


# --- Lots ---


def list_lots(session: Session, instrument_id: int | None) -> Sequence[Lot]:
    return repo.list_lots(session, instrument_id)


def get_lot(session: Session, lot_id: int) -> Lot:
    lot = session.get(Lot, lot_id)
    if lot is None:
        raise NotFoundError(f"Package {lot_id} not found")
    return lot


def _check_lot(instrument: Instrument, data: LotIn) -> None:
    if not instrument.issue_date <= data.trade_date < instrument.maturity_date:
        raise ValidationError("Purchase date must be between the bond's issue and maturity dates")


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
        raise ValidationError("Cannot change the bond of a package that has sales")
    if data.quantity < sold:
        raise ValidationError(f"Quantity cannot be below the {sold} units already sold")
    first_sale = repo.earliest_sale_date(session, lot_id)
    if first_sale is not None and data.trade_date > first_sale:
        raise ValidationError("Purchase date cannot be after this package's first sale")
    for field, value in data.model_dump().items():
        setattr(lot, field, value)
    session.flush()
    session.refresh(lot)
    return lot


def delete_lot(session: Session, lot_id: int) -> None:
    lot = get_lot(session, lot_id)
    if repo.sold_quantity(session, lot_id) > 0:
        raise ConflictError("Delete this package's sales first")
    session.delete(lot)
    session.flush()


# --- Sales ---


def list_sales(session: Session, lot_id: int | None) -> Sequence[Sale]:
    return repo.list_sales(session, lot_id)


def get_sale(session: Session, sale_id: int) -> Sale:
    sale = session.get(Sale, sale_id)
    if sale is None:
        raise NotFoundError(f"Sale {sale_id} not found")
    return sale


def _check_sale(session: Session, data: SaleIn, sale_id: int | None) -> None:
    lot = session.get(Lot, data.lot_id)
    if lot is None:
        raise ValidationError(f"Package {data.lot_id} does not exist")
    instrument = _instrument_for(session, lot.instrument_id)
    if not lot.trade_date <= data.trade_date < instrument.maturity_date:
        raise ValidationError("Sale date must be between the purchase date and the bond's maturity")
    available = lot.quantity - repo.sold_quantity(session, lot.id, exclude_sale_id=sale_id)
    if data.quantity > available:
        raise ValidationError(f"Only {available.normalize():f} units are available in this package")


def create_sale(session: Session, data: SaleIn) -> Sale:
    _check_sale(session, data, sale_id=None)
    sale = Sale(**data.model_dump())
    session.add(sale)
    session.flush()
    session.refresh(sale)
    return sale


def update_sale(session: Session, sale_id: int, data: SaleIn) -> Sale:
    sale = get_sale(session, sale_id)
    _check_sale(session, data, sale_id=sale_id)
    for field, value in data.model_dump().items():
        setattr(sale, field, value)
    session.flush()
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
        raise NotFoundError(f"Payment {payment_id} not found")
    return payment


def _check_payment(session: Session, data: PaymentIn) -> None:
    _instrument_for(session, data.instrument_id)
    if repo.held_quantity_before(session, data.instrument_id, data.pay_date) <= 0:
        raise ValidationError("No packages of this bond were held the day before the payment date")


def create_payment(session: Session, data: PaymentIn) -> Payment:
    _check_payment(session, data)
    payment = Payment(**data.model_dump())
    session.add(payment)
    session.flush()
    session.refresh(payment)
    return payment


def update_payment(session: Session, payment_id: int, data: PaymentIn) -> Payment:
    payment = get_payment(session, payment_id)
    _check_payment(session, data)
    for field, value in data.model_dump().items():
        setattr(payment, field, value)
    session.flush()
    session.refresh(payment)
    return payment


def delete_payment(session: Session, payment_id: int) -> None:
    session.delete(get_payment(session, payment_id))
    session.flush()
