import csv
import io
from datetime import date

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.models import Instrument
from app.repositories import operations as repo
from app.services.reports import portfolio_report

OPERATION_COLUMNS = [
    "date",
    "type",
    "isin",
    "package_id",
    "quantity",
    "amount_uah",
    "accrued_uah",
    "fee_uah",
    "fx_rate",
    "note",
]


def _operation_rows(session: Session) -> list[list[object]]:
    instruments = {i.id: i for i in session.query(Instrument)}
    lots = {lot.id: lot for lot in repo.list_lots(session, None)}
    rows: list[list[object]] = []
    for lot in lots.values():
        rows.append(
            [
                lot.trade_date,
                "buy",
                instruments[lot.instrument_id].isin,
                lot.id,
                lot.quantity,
                lot.total_cost_uah,
                lot.accrued_paid_uah,
                lot.fee_uah,
                lot.fx_rate,
                lot.note or "",
            ]
        )
    for sale in repo.list_sales(session, None):
        lot = lots[sale.lot_id]
        rows.append(
            [
                sale.trade_date,
                "sell",
                instruments[lot.instrument_id].isin,
                lot.id,
                sale.quantity,
                sale.total_proceeds_uah,
                sale.accrued_received_uah,
                sale.fee_uah,
                sale.fx_rate,
                sale.note or "",
            ]
        )
    for payment in repo.list_payments(session, None):
        rows.append(
            [
                payment.pay_date,
                payment.kind,
                instruments[payment.instrument_id].isin,
                "",
                "",
                payment.total_amount_uah,
                "",
                payment.fee_uah,
                payment.fx_rate,
                payment.note or "",
            ]
        )
    rows.sort(key=lambda r: (str(r[0]), str(r[1])))
    return rows


def operations_csv(session: Session) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(OPERATION_COLUMNS)
    writer.writerows(_operation_rows(session))
    return buffer.getvalue()


def _xlsx_bytes(workbook: Workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def operations_xlsx(session: Session) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Operations"
    sheet.append(OPERATION_COLUMNS)
    for row in _operation_rows(session):
        sheet.append(row)
    return _xlsx_bytes(workbook)


def portfolio_xlsx(session: Session, start: date | None, end: date | None) -> bytes:
    report = portfolio_report(session, start, end)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "P&L"
    sheet.append(["Period", report.start, report.end])
    sheet.append([])
    sheet.append(
        [
            "package_id",
            "isin",
            "name",
            "trade_date",
            "quantity",
            "open_quantity",
            "invested_uah",
            "received_uah",
            "closing_value_uah",
            "pnl_uah",
            "invested_usd",
            "received_usd",
            "closing_value_usd",
            "pnl_usd",
            "xirr_uah",
            "xirr_usd",
        ]
    )
    for lot in report.lots:
        p = lot.pnl
        sheet.append(
            [
                lot.lot_id,
                lot.isin,
                lot.name,
                lot.trade_date,
                lot.quantity,
                lot.open_quantity,
                p.invested.uah,
                p.received.uah,
                p.closing_value.uah,
                p.pnl.uah,
                p.invested.usd,
                p.received.usd,
                p.closing_value.usd,
                p.pnl.usd,
                lot.xirr_uah,
                lot.xirr_usd,
            ]
        )
    for label, part in (
        ("Realized (closed packages)", report.realized),
        ("Unrealized (open packages)", report.unrealized),
    ):
        sheet.append([label, "", "", "", "", "", "", "", "", part.uah, "", "", "", part.usd])
    t = report.totals
    sheet.append(
        [
            "TOTAL",
            "",
            "",
            "",
            "",
            "",
            t.invested.uah,
            t.received.uah,
            t.closing_value.uah,
            t.pnl.uah,
            t.invested.usd,
            t.received.usd,
            t.closing_value.usd,
            t.pnl.usd,
            report.xirr_uah,
            report.xirr_usd,
        ]
    )
    return _xlsx_bytes(workbook)
