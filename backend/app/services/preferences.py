from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.core.i18n import LANGUAGES
from app.repositories import preferences as repo
from app.schemas.preferences import DEFAULT_DEPOSIT_RATE, PreferencesOut, PreferencesUpdate


def _deposit_rate(stored: str | None) -> Decimal:
    try:
        rate = Decimal(stored) if stored is not None else DEFAULT_DEPOSIT_RATE
    except InvalidOperation:
        return DEFAULT_DEPOSIT_RATE
    return rate if 0 <= rate <= 1 else DEFAULT_DEPOSIT_RATE


def get_preferences(session: Session) -> PreferencesOut:
    stored = repo.get_all(session)
    values: dict[str, object] = {
        "demo": stored.get("demo") == "true",
        "deposit_rate": _deposit_rate(stored.get("deposit_rate")),
    }
    language = stored.get("language")
    # A language removed from the app since it was saved falls back to the default.
    if language in LANGUAGES:
        values["language"] = language
    return PreferencesOut.model_validate(values)


def update_preferences(session: Session, data: PreferencesUpdate) -> PreferencesOut:
    for key, value in data.model_dump(exclude_none=True).items():
        repo.save(session, key, str(value))
    return get_preferences(session)
