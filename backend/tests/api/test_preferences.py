from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.repositories import preferences as repo


def test_language_defaults_to_english_and_is_saved(client: TestClient) -> None:
    assert client.get("/api/v1/preferences").json() == {"language": "en", "demo": False}

    response = client.patch("/api/v1/preferences", json={"language": "uk"})

    assert response.status_code == 200
    assert response.json() == {"language": "uk", "demo": False}
    assert client.get("/api/v1/preferences").json() == {"language": "uk", "demo": False}
    assert client.patch("/api/v1/preferences", json={}).json() == {"language": "uk", "demo": False}


def test_unsupported_language_rejected(client: TestClient) -> None:
    assert client.patch("/api/v1/preferences", json={"language": "xx"}).status_code == 422


def test_language_no_longer_supported_falls_back(client: TestClient, session: Session) -> None:
    repo.save(session, "language", "xx")

    assert client.get("/api/v1/preferences").json() == {"language": "en", "demo": False}
