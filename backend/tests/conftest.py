from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from app.core.config import get_settings
from app.core.db import get_session
from app.main import create_app
from app.services.fx import reset_nbu_cooldown

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def database_url(monkeypatch_session: pytest.MonkeyPatch) -> Iterator[str]:
    with PostgresContainer("docker.io/library/postgres:16.15-alpine", driver="psycopg") as pg:
        url = pg.get_connection_url()
        monkeypatch_session.setenv("INVESTOR_DATABASE_URL", url)
        get_settings.cache_clear()
        command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
        yield url


@pytest.fixture(autouse=True)
def _nbu_cooldown() -> None:
    reset_nbu_cooldown()


@pytest.fixture(scope="session")
def monkeypatch_session() -> Iterator[pytest.MonkeyPatch]:
    mp = pytest.MonkeyPatch()
    yield mp
    mp.undo()


@pytest.fixture(scope="session")
def engine(database_url: str) -> Engine:
    return create_engine(database_url)


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """A session whose work is rolled back after the test, even after commits inside the app."""
    connection = engine.connect()
    outer = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield db
    finally:
        db.close()
        outer.rollback()
        connection.close()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    app = create_app()

    def _session() -> Iterator[Session]:
        yield session
        session.flush()

    app.dependency_overrides[get_session] = _session
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
