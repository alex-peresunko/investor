from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.i18n import DEFAULT_LANGUAGE, Language

DEFAULT_DEPOSIT_RATE = Decimal("0.12")


class PreferencesOut(BaseModel):
    language: Language = DEFAULT_LANGUAGE
    # Annual rate, as a fraction, of the UAH deposit the dashboard compares the bonds with.
    deposit_rate: Decimal = DEFAULT_DEPOSIT_RATE
    # True when the database holds the sample data of `app.demo`; not settable through the API.
    demo: bool = False


class PreferencesUpdate(BaseModel):
    """Only the fields sent are changed."""

    language: Language | None = None
    deposit_rate: Decimal | None = Field(default=None, ge=0, le=1)
