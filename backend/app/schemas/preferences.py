from pydantic import BaseModel

from app.core.i18n import DEFAULT_LANGUAGE, Language


class PreferencesOut(BaseModel):
    language: Language = DEFAULT_LANGUAGE


class PreferencesUpdate(BaseModel):
    """Only the fields sent are changed."""

    language: Language | None = None
