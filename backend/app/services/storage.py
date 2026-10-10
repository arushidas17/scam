"""
Supabase Storage, reached over its REST API with the service key.

The bucket is private. Nothing here ever returns a public URL: reading a file
back always goes through a short-lived signed URL, so a leaked path on its own
grants no access.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

EXTENSION_BY_MIME = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
}


class StorageError(RuntimeError):
    """Raised when Supabase Storage refuses an operation."""


@dataclass(frozen=True)
class StoredFile:
    path: str
    mime_type: str
    size_bytes: int


def _settings():
    return get_settings()


def _headers() -> dict[str, str]:
    key = _settings().supabase_secret_key
    return {"Authorization": f"Bearer {key}", "apikey": key}


def _base_url() -> str:
    return _settings().supabase_url.rstrip("/") + "/storage/v1"


def _redact(text: str) -> str:
    """Strip the service key out of anything headed for a log."""
    key = _settings().supabase_secret_key
    return text.replace(key, "<redacted>") if key else text


def ensure_bucket() -> None:
    """
    Create the private bucket if it is missing.

    ``public`` is pinned to False on create. An existing bucket is left alone:
    silently flipping someone's bucket settings would be worse than failing.
    """
    bucket = _settings().storage_bucket
    with httpx.Client(timeout=20.0) as client:
        existing = client.get(f"{_base_url()}/bucket/{bucket}", headers=_headers())
        if existing.status_code == 200:
            if existing.json().get("public"):
                logger.warning(
                    "Storage bucket %r is public; invoice files should not be.", bucket
                )
            return

        created = client.post(
            f"{_base_url()}/bucket",
            headers=_headers(),
            json={"id": bucket, "name": bucket, "public": False},
        )
        if created.status_code not in (200, 201):
            raise StorageError(
                f"Could not create storage bucket {bucket!r}: "
                f"{created.status_code} {_redact(created.text)[:200]}"
            )


def build_path(mime_type: str) -> str:
    """``{uuid}.{ext}`` — the original filename is never used in the path."""
    extension = EXTENSION_BY_MIME.get(mime_type, "bin")
    return f"{uuid.uuid4()}.{extension}"


def upload(data: bytes, mime_type: str, path: str | None = None) -> StoredFile:
    """Put the file in the private bucket and return where it landed."""
    bucket = _settings().storage_bucket
    object_path = path or build_path(mime_type)

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{_base_url()}/object/{bucket}/{object_path}",
            headers={
                **_headers(),
                "Content-Type": mime_type,
                # Never overwrite: paths are UUIDs, so a collision means a bug.
                "x-upsert": "false",
            },
            content=data,
        )

    if response.status_code not in (200, 201):
        raise StorageError(
            f"Upload failed: {response.status_code} {_redact(response.text)[:200]}"
        )

    return StoredFile(path=object_path, mime_type=mime_type, size_bytes=len(data))


def signed_url(path: str, expires_in: int | None = None) -> str | None:
    """
    A short-lived read URL for a stored object.

    Returns None rather than raising: a missing preview should not fail an
    upload that otherwise succeeded.
    """
    settings = _settings()
    ttl = expires_in or settings.signed_url_ttl_seconds

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{_base_url()}/object/sign/{settings.storage_bucket}/{path}",
                headers=_headers(),
                json={"expiresIn": ttl},
            )
        if response.status_code != 200:
            logger.warning(
                "Could not sign %r: %s %s",
                path,
                response.status_code,
                _redact(response.text)[:200],
            )
            return None

        signed = response.json().get("signedURL") or response.json().get("signedUrl")
        if not signed:
            return None
        return f"{settings.supabase_url.rstrip('/')}/storage/v1{signed}"
    except httpx.HTTPError as exc:
        logger.warning("Could not sign %r: %s", path, _redact(str(exc)))
        return None


def delete(path: str) -> None:
    """Remove an object. Used only to tidy up after a failed upload."""
    try:
        with httpx.Client(timeout=20.0) as client:
            client.request(
                "DELETE",
                f"{_base_url()}/object/{_settings().storage_bucket}",
                headers=_headers(),
                json={"prefixes": [path]},
            )
    except httpx.HTTPError as exc:
        logger.warning("Could not delete %r: %s", path, _redact(str(exc)))
