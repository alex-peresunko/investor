from pydantic import BaseModel

from app.core.i18n import DEFAULT_LANGUAGE, Language


class PreferencesOut(BaseModel):
    language: Language = DEFAULT_LANGUAGE
    # True when the database holds the sample data of `app.demo`; not settable through the API.
    demo: bool = False


class PreferencesUpdate(BaseModel):
    """Only the fields sent are changed."""

    language: Language | None = None
