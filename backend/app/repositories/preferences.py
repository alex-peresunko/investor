from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Preference


def get_all(session: Session) -> dict[str, str]:
    return {p.key: p.value for p in session.scalars(select(Preference))}


def save(session: Session, key: str, value: str) -> None:
    session.merge(Preference(key=key, value=value))
    session.flush()
