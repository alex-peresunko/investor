"""Writes the OpenAPI spec to the path given as argv[1]; frontend types are generated from it."""

import json
import sys
from pathlib import Path

from app.main import create_app

Path(sys.argv[1]).write_text(json.dumps(create_app().openapi(), indent=2) + "\n")
