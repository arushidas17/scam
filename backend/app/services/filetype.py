"""
Deciding what a file really is.

The declared content-type and the filename extension are both attacker- (or
simply browser-) controlled, so the only thing trusted here is the leading
bytes of the file itself.
"""

from __future__ import annotations

# (magic bytes, offset, mime type). PDF and PNG have fixed signatures; JPEG
# always starts FF D8 FF regardless of which JFIF/EXIF variant follows.
_SIGNATURES: tuple[tuple[bytes, int, str], ...] = (
    (b"%PDF-", 0, "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"\xff\xd8\xff", 0, "image/jpeg"),
)

ALLOWED_MIME_TYPES = ("application/pdf", "image/jpeg", "image/png")

HUMAN_NAMES = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
}


def sniff(data: bytes) -> str | None:
    """The real MIME type from the file's own bytes, or None if unrecognised."""
    for signature, offset, mime_type in _SIGNATURES:
        if data[offset : offset + len(signature)] == signature:
            return mime_type
    return None


def describe_allowed() -> str:
    return ", ".join(HUMAN_NAMES[m] for m in ALLOWED_MIME_TYPES)
