from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Preference(TimestampMixin, Base):
    """User preferences as key/value rows; `schemas.preferences` defines the keys and types."""

    __tablename__ = "preference"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
