import json
from collections.abc import Callable
from functools import cache
from pathlib import Path
from typing import Literal, get_args

# Adding a language: extend this Literal, add app/locales/<code>.json and the frontend locale.
Language = Literal["en", "uk"]
LANGUAGES: tuple[Language, ...] = get_args(Language)
DEFAULT_LANGUAGE: Language = "en"

LOCALES_DIR = Path(__file__).resolve().parent.parent / "locales"


@cache
def _catalog(language: Language) -> dict[str, str]:
    data: dict[str, str] = json.loads((LOCALES_DIR / f"{language}.json").read_text("utf-8"))
    return data


def translator(language: Language) -> Callable[[str], str]:
    """Looks up `key` in `language`, falling back to English, then to the key itself."""
    catalog = _catalog(language)
    fallback = _catalog(DEFAULT_LANGUAGE)
    return lambda key: catalog.get(key) or fallback.get(key, key)
