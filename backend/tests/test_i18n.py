import json
import re
from pathlib import Path

import pytest

from app.core.errors import MESSAGES
from app.core.i18n import LANGUAGES, LOCALES_DIR, translator

FRONTEND_LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales"


@pytest.mark.parametrize("language", LANGUAGES)
def test_export_catalog_has_every_english_key(language: str) -> None:
    english = json.loads((LOCALES_DIR / "en.json").read_text("utf-8"))
    catalog = json.loads((LOCALES_DIR / f"{language}.json").read_text("utf-8"))
    assert catalog.keys() == english.keys()
    assert all(catalog.values())


def test_translator_falls_back_to_key() -> None:
    assert translator("uk")("row.total") == "РАЗОМ"
    assert translator("uk")("missing.key") == "missing.key"


@pytest.mark.skipif(not FRONTEND_LOCALES.exists(), reason="frontend sources not present")
@pytest.mark.parametrize("language", LANGUAGES)
def test_frontend_translates_every_error_code(language: str) -> None:
    errors = json.loads((FRONTEND_LOCALES / f"{language}.json").read_text("utf-8"))["errors"]
    for code, message in MESSAGES.items():
        assert code in errors, code
        expected = set(re.findall(r"{(\w+)}", message))
        assert set(re.findall(r"{{(\w+)}}", errors[code])) == expected, code
