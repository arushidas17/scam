"""Authentication. Every endpoint must refuse an anonymous caller."""

from __future__ import annotations

import uuid

import pytest

from app.auth import clear_token_cache

# (method, path, body) for every endpoint added in this task, plus the
# upload-era ones that were brought behind auth.
PROTECTED = [
    ("get", "/dashboard/stats", None),
    ("get", "/invoices", None),
    ("get", f"/invoices/{uuid.uuid4()}", None),
    ("post", f"/invoices/{uuid.uuid4()}/decision", {"action": "approve"}),
    ("patch", f"/invoices/{uuid.uuid4()}/fields", {"gstin": "27AABCA1234K1Z5"}),
    ("post", f"/invoices/{uuid.uuid4()}/analyse", None),
    ("get", "/vendors", None),
    ("get", f"/vendors/{uuid.uuid4()}", None),
    ("patch", f"/vendors/{uuid.uuid4()}/trust", {"is_trusted": True}),
    ("post", "/payment-checker/analyse", {"from_email": "a@b.in", "body": "hello"}),
]


@pytest.mark.parametrize("method, path, body", PROTECTED)
def test_every_endpoint_refuses_an_anonymous_caller(anonymous, method, path, body) -> None:
    response = getattr(anonymous, method)(path, **({"json": body} if body else {}))
    assert response.status_code == 401, f"{method.upper()} {path} was not protected"
    assert "www-authenticate" in {k.lower() for k in response.headers}


@pytest.mark.parametrize("method, path, body", PROTECTED)
def test_a_garbage_token_is_refused(anonymous, monkeypatch, method, path, body) -> None:
    """A malformed token must not reach the database."""
    clear_token_cache()
    monkeypatch.setattr(
        "app.auth.verify_token",
        lambda token: (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=401, detail="bad token")
        ),
    )
    response = getattr(anonymous, method)(
        path, headers={"Authorization": "Bearer not-a-real-token"},
        **({"json": body} if body else {}),
    )
    assert response.status_code == 401


def test_upload_is_protected(anonymous) -> None:
    response = anonymous.post(
        "/invoices/upload", files={"file": ("a.pdf", b"%PDF-1.4 x", "application/pdf")}
    )
    assert response.status_code == 401


def test_health_stays_public(anonymous) -> None:
    assert anonymous.get("/health").status_code in (200, 503)


def test_a_non_bearer_scheme_is_refused(anonymous) -> None:
    response = anonymous.get("/invoices", headers={"Authorization": "Basic abc123"})
    assert response.status_code == 401


def test_an_empty_bearer_token_is_refused(anonymous) -> None:
    response = anonymous.get("/invoices", headers={"Authorization": "Bearer "})
    assert response.status_code == 401


def test_a_verified_token_creates_the_user_row(monkeypatch) -> None:
    """First sign-in writes the local row, keyed on the Supabase user id."""
    from app.auth import upsert_user
    from app.database import SessionLocal
    from app.models import User

    try:
        with SessionLocal() as probe:
            probe.get(User, uuid.uuid4())
    except Exception:
        pytest.skip("database not reachable")

    new_id = uuid.uuid4()
    payload = {
        "id": str(new_id),
        "email": "Fresh.User@Example.IN",
        "user_metadata": {"full_name": "Fresh User"},
    }

    with SessionLocal() as db:
        user = upsert_user(payload, db)
        assert user.id == new_id
        assert user.email == "fresh.user@example.in", "emails are normalised"
        assert user.name == "Fresh User"

        # Signing in again must not create a second row.
        again = upsert_user(payload, db)
        assert again.id == new_id

        db.delete(db.get(User, new_id))
        db.commit()


def test_a_token_without_a_user_id_is_refused() -> None:
    from fastapi import HTTPException

    from app.auth import upsert_user

    with pytest.raises(HTTPException) as excinfo:
        upsert_user({"email": "x@y.in"}, None)
    assert excinfo.value.status_code == 401
