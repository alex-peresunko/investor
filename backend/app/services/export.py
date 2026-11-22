import csv
import io
from datetime import date

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.core.i18n import Language, translator
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
    "fee",
    "fx_rate",
    "note",
]

PORTFOLIO_COLUMNS = [
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


def _operation_rows(session: Session, language: Language) -> list[list[object]]:
    t = translator(language)
    instruments = {i.id: i for i in session.query(Instrument)}
    lots = {lot.id: lot for lot in repo.list_lots(session, None)}
    rows: list[list[object]] = []
    for lot in lots.values():
        rows.append(
            [
                lot.trade_date,
                t("operation.buy"),
                instruments[lot.instrument_id].isin,
                lot.id,
                lot.quantity,
                instruments[lot.instrument_id].currency,
                lot.total_cost,
                lot.accrued_paid,
                lot.fee,
                lot.currency_rate or "",
                lot.fx_rate,
                lot.note or "",
            ]
        )
    for sale in repo.list_sales(session, None):
        lot = lots[sale.lot_id]
        rows.append(
            [
                sale.trade_date,
                t("operation.sell"),
                instruments[lot.instrument_id].isin,
                lot.id,
                sale.quantity,
                instruments[lot.instrument_id].currency,
                sale.total_proceeds,
                sale.accrued_received,
                sale.fee,
                sale.currency_rate or "",
                sale.fx_rate,
                sale.note or "",
            ]
        )
    for payment in repo.list_payments(session, None):
        rows.append(
            [
                payment.pay_date,
                t(f"operation.{payment.kind}"),
                instruments[payment.instrument_id].isin,
                "",
                "",
                instruments[payment.instrument_id].currency,
                payment.total_amount,
                "",
                payment.fee,
                payment.currency_rate or "",
                payment.fx_rate,
                payment.note or "",
            ]
        )
    rows.sort(key=lambda r: (str(r[0]), str(r[1])))
    return rows


def _headers(language: Language, columns: list[str]) -> list[str]:
    t = translator(language)
    return [t(f"column.{c}") for c in columns]


def operations_csv(session: Session, language: Language) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(_headers(language, OPERATION_COLUMNS))
    writer.writerows(_operation_rows(session, language))
    return buffer.getvalue()


def _xlsx_bytes(workbook: Workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def operations_xlsx(session: Session, language: Language) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = translator(language)("sheet.operations")
    sheet.append(_headers(language, OPERATION_COLUMNS))
    for row in _operation_rows(session, language):
        sheet.append(row)
    return _xlsx_bytes(workbook)


def portfolio_xlsx(
    session: Session, start: date | None, end: date | None, language: Language
) -> bytes:
    t = translator(language)
    report = portfolio_report(session, start, end)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = t("sheet.pnl")
    sheet.append([t("row.period"), report.start, report.end])
    sheet.append([])
    sheet.append(_headers(language, PORTFOLIO_COLUMNS))
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
        (t("row.realized"), report.realized),
        (t("row.unrealized"), report.unrealized),
    ):
        sheet.append([label, "", "", "", "", "", "", "", "", part.uah, "", "", "", part.usd])
    totals = report.totals
    sheet.append(
        [
            t("row.total"),
            "",
            "",
            "",
            "",
            "",
            totals.invested.uah,
            totals.received.uah,
            totals.closing_value.uah,
            totals.pnl.uah,
            totals.invested.usd,
            totals.received.usd,
            totals.closing_value.usd,
            totals.pnl.usd,
            report.xirr_uah,
            report.xirr_usd,
        ]
    )
    return _xlsx_bytes(workbook)
