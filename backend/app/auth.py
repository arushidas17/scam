"""
Authentication.

The front end signs in with Supabase Auth and sends the resulting JWT. Rather
than holding a copy of the project's signing secret, the token is verified
against the Supabase project itself: ``GET /auth/v1/user`` accepts the token and
answers with the user it belongs to, or rejects it. That means a revoked or
expired token stops working immediately, which local signature checking alone
would not catch.

Verified tokens are cached briefly so a page that fires several requests does
not cause several round trips.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

# auto_error=False so a missing header produces our own 401 with a useful
# message, rather than FastAPI's bare 403.
bearer_scheme = HTTPBearer(auto_error=False, description="Supabase access token")

# token -> (expires_at, payload). Short enough that a sign-out takes effect
# promptly, long enough to spare the auth service a burst of identical calls.
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 30.0
_CACHE_MAX_ENTRIES = 512


@dataclass(frozen=True)
class CurrentUser:
    """The signed-in user, as the rest of the app sees them."""

    id: uuid.UUID
    email: str
    name: str
    role: str

    def as_dict(self) -> dict[str, Any]:
        return {"id": str(self.id), "email": self.email, "name": self.name, "role": self.role}


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _cache_get(token: str) -> dict[str, Any] | None:
    entry = _CACHE.get(token)
    if entry is None:
        return None
    expires_at, payload = entry
    if expires_at < time.monotonic():
        _CACHE.pop(token, None)
        return None
    return payload


def _cache_put(token: str, payload: dict[str, Any]) -> None:
    if len(_CACHE) >= _CACHE_MAX_ENTRIES:
        _CACHE.clear()
    _CACHE[token] = (time.monotonic() + _CACHE_TTL_SECONDS, payload)


def verify_token(token: str) -> dict[str, Any]:
    """
    Ask Supabase who this token belongs to.

    Raises 401 for anything that is not a clear success, and 503 if the auth
    service cannot be reached — an unreachable verifier must never be treated
    as a pass.
    """
    cached = _cache_get(token)
    if cached is not None:
        return cached

    settings = get_settings()
    url = settings.supabase_url.rstrip("/") + "/auth/v1/user"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_secret_key,
                },
            )
    except httpx.HTTPError as exc:
        logger.error("Could not reach Supabase Auth: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in could not be verified right now. Try again.",
        ) from exc

    if response.status_code == 200:
        payload = response.json()
        _cache_put(token, payload)
        return payload

    if response.status_code in (401, 403):
        raise _unauthorised("That sign-in token is not valid or has expired.")

    logger.error("Unexpected response from Supabase Auth: %s", response.status_code)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Sign-in could not be verified right now. Try again.",
    )


def _display_name(payload: dict[str, Any], email: str) -> str:
    meta = payload.get("user_metadata") or {}
    for key in ("full_name", "name", "display_name"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return email.split("@")[0] or "User"


def upsert_user(payload: dict[str, Any], db: Session) -> CurrentUser:
    """
    Find or create the local row for this Supabase user.

    ``users.id`` carries the Supabase auth id, so the two stay in step without
    a mapping table. The row is created on first sign-in; afterwards only the
    name and email are refreshed, never the role, which is ours to manage.
    """
    raw_id = payload.get("id") or payload.get("sub")
    email = (payload.get("email") or "").strip().lower()

    if not raw_id:
        raise _unauthorised("That sign-in token carries no user id.")

    try:
        user_id = uuid.UUID(str(raw_id))
    except (ValueError, TypeError) as exc:
        raise _unauthorised("That sign-in token carries an unrecognised user id.") from exc

    if not email:
        # Supabase allows phone-only accounts; this product is email-based.
        email = f"{user_id}@users.noreply.local"

    name = _display_name(payload, email)
    user = db.get(User, user_id)

    if user is None:
        # An account could already exist under this email from an earlier
        # provider; adopt it rather than failing on the unique constraint.
        existing = db.scalars(select(User).where(User.email == email)).first()
        if existing is not None:
            user = existing
        else:
            user = User(id=user_id, name=name, email=email, role="reviewer")
            db.add(user)
            db.commit()
            db.refresh(user)
    else:
        if user.name != name or user.email != email:
            user.name = name
            user.email = email
            db.commit()
            db.refresh(user)

    return CurrentUser(id=user.id, email=user.email, name=user.name, role=user.role)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """FastAPI dependency: the signed-in user, or 401."""
    if credentials is None or not (credentials.credentials or "").strip():
        raise _unauthorised("Sign in to use this endpoint.")

    if (credentials.scheme or "").lower() != "bearer":
        raise _unauthorised("Send the token as 'Authorization: Bearer <token>'.")

    payload = verify_token(credentials.credentials.strip())
    user = upsert_user(payload, db)
    # Handy for logging further down the request.
    request.state.user = user
    return user


def clear_token_cache() -> None:
    """Drop every cached verification. Used by tests."""
    _CACHE.clear()
