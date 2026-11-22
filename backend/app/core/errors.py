from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# English `detail` for each error `code`. The UI translates by `code` and `params` (its
# `errors.<code>` keys), so a code and its placeholders must match frontend/src/locales/*.json.
MESSAGES: dict[str, str] = {
    "bond_not_found": "Bond {id} not found",
    "bond_exists": "Bond {isin} already exists",
    "bond_has_operations": "Delete this bond's packages and payments first",
    "bond_currency_locked": "Cannot change the currency of a bond that has operations",
    "security_not_found": "NBU lists no bond {isin}",
    "security_unsupported": "Bond {isin} is in {currency}, which the app does not support",
    "securities_unavailable": "The NBU bond list is unavailable; enter the terms manually",
    "schedule_duplicate_date": "Each date can have only one coupon and one redemption",
    "schedule_multiple_redemptions": "A bond can have only one redemption",
    "bond_missing": "Bond {id} does not exist",
    "package_not_found": "Package {id} not found",
    "package_missing": "Package {id} does not exist",
    "purchase_date_out_of_range": (
        "Purchase date must be between the bond's issue and maturity dates"
    ),
    "package_bond_locked": "Cannot change the bond of a package that has sales",
    "quantity_below_sold": "Quantity cannot be below the {sold} units already sold",
    "purchase_after_first_sale": "Purchase date cannot be after this package's first sale",
    "package_has_sales": "Delete this package's sales first",
    "sale_not_found": "Sale {id} not found",
    "sale_date_out_of_range": "Sale date must be between the purchase date and the bond's maturity",
    "sale_exceeds_available": "Only {available} units are available in this package",
    "payment_not_found": "Payment {id} not found",
    "payment_without_holdings": (
        "No packages of this bond were held the day before the payment date"
    ),
    "payment_loses_holdings": (
        "The payment of {date} would have no packages held the day before it; "
        "change or delete that payment first"
    ),
    "currency_rate_required": "Enter the UAH rate for {currency}",
    "currency_rate_not_applicable": "A {currency} bond takes no separate currency rate",
    "fx_future_date": "No official rate for a future date",
    "fx_unavailable": "NBU rate service is unavailable; enter the rate manually",
    "fx_no_rate": "NBU has no rate for this date; enter the rate manually",
    "period_end_before_start": "The end date must not be before the start date",
    "months_out_of_range": "months must be between 1 and 120",
}


class DomainError(Exception):
    status_code = 400
    title = "Bad request"

    def __init__(self, code: str, **params: str | int) -> None:
        self.code = code
        self.params = {key: str(value) for key, value in params.items()}
        self.detail = MESSAGES[code].format(**self.params)
        super().__init__(self.detail)


class NotFoundError(DomainError):
    status_code = 404
    title = "Not found"


class ConflictError(DomainError):
    status_code = 409
    title = "Conflict"


class ValidationError(DomainError):
    status_code = 422
    title = "Validation failed"


class UpstreamError(DomainError):
    status_code = 502
    title = "Upstream service unavailable"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "title": exc.title,
                "status": exc.status_code,
                "detail": exc.detail,
                "code": exc.code,
                "params": exc.params,
            },
            media_type="application/problem+json",
        )
