from sqlalchemy.orm import Session

from app.core.i18n import LANGUAGES
from app.repositories import preferences as repo
from app.schemas.preferences import PreferencesOut, PreferencesUpdate


def get_preferences(session: Session) -> PreferencesOut:
    stored = repo.get_all(session)
    language = stored.get("language")
    demo = stored.get("demo") == "true"
    # A language removed from the app since it was saved falls back to the default.
    if language in LANGUAGES:
        return PreferencesOut.model_validate({"language": language, "demo": demo})
    return PreferencesOut(demo=demo)


def update_preferences(session: Session, data: PreferencesUpdate) -> PreferencesOut:
    for key, value in data.model_dump(exclude_none=True).items():
        repo.save(session, key, str(value))
    return get_preferences(session)
