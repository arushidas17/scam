"""
End-to-end checks against the real database.

These need a reachable DATABASE_URL and a seeded schema; they are skipped
rather than failed when the database cannot be reached, so the suite still
runs on a machine without credentials.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Authenticated: /vendors is behind the auth dependency."""
    from app.auth import CurrentUser, get_current_user
    from tests.conftest import TEST_USER_ID

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email="reviewer@fraudguardian.test",
        name="Test Reviewer", role="reviewer",
    )
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(scope="module")
def db_available() -> bool:
    from sqlalchemy import text

    from app.database import engine

    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return True
    except Exception:
        return False


def test_health_reports_the_database(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("database not reachable")
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["server_version"]


def test_vendors_returns_the_seeded_rows(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("database not reachable")
    response = client.get("/vendors")
    assert response.status_code == 200

    body = response.json()
    assert body["total"] >= 8

    names = {v["name"] for v in body["rows"]}
    assert "ABC Technologies" in names

    abc = next(v for v in body["rows"] if v["name"] == "ABC Technologies")
    assert abc["email_domain"] == "abctechnologies.com"
    assert abc["invoice_count"] >= 10
    # Money crosses the wire as a string, not a float, so no precision is lost.
    assert isinstance(abc["average_amount"], str)


def test_bank_details_are_not_exposed_in_the_list(
    client: TestClient, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("database not reachable")
    rows = client.get("/vendors").json()["rows"]
    assert rows
    for field in ("bank_account", "ifsc"):
        assert field not in rows[0]


def test_vendors_requires_a_token() -> None:
    """The endpoint was public in the first milestone; it is not any more."""
    from app.auth import get_current_user

    app.dependency_overrides.pop(get_current_user, None)
    assert TestClient(app).get("/vendors").status_code == 401


def test_cors_allows_the_front_end(client: TestClient) -> None:
    response = client.options(
        "/vendors",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in (200, 204)
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
