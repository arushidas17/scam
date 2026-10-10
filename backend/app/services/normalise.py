"""
Turning what the model printed into what the database stores.

Separate from extraction.py so it can be tested without the SDK, and reused
when a user corrects a field by hand.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# Formats seen on Indian invoices, most specific first. ISO is tried first so
# an unambiguous value is never reinterpreted.
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%Y/%m/%d",
    "%d-%m-%y",
    "%d/%m/%y",
)

# The numeric run inside a string like "Rs. 4,86,500.00" or "INR 1,234/-".
# Matched rather than filtered: deleting every non-digit would keep the dot in
# "Rs." and turn 1,234 into 0.1234.
_AMOUNT_TOKEN = re.compile(r"\d[\d,\s]*(?:\.\d+)?|\.\d+")


def normalise_date(value: str | None) -> str | None:
    """
    Return an ISO date string, or None when the value cannot be read.

    Day-first is assumed for ambiguous values like 03/04/2026, which is the
    Indian convention and matches the invoices this product sees.
    """
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    for fmt in _DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt).date()
        except ValueError:
            continue
        # A two-digit year near the century boundary lands in the wrong one.
        if parsed.year < 1970:
            parsed = parsed.replace(year=parsed.year + 100)
        return parsed.isoformat()

    # Last resort: a full ISO timestamp.
    try:
        return datetime.fromisoformat(text).date().isoformat()
    except ValueError:
        return None


def normalise_amount(value: str | float | int | None) -> Decimal | None:
    """
    Strip currency symbols, commas and spaces, and return a Decimal.

    Indian grouping ("4,86,500.00") falls out naturally because every comma is
    removed rather than assumed to be a thousands separator.
    """
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))

    text = str(value).strip()
    if not text:
        return None

    # A leading minus or surrounding parentheses means negative on some documents.
    negative = text.lstrip().startswith("-") or (
        text.startswith("(") and text.endswith(")")
    )

    match = _AMOUNT_TOKEN.search(text)
    if match is None:
        return None

    # Indian grouping ("4,86,500.00") needs no special handling once every
    # separator is removed.
    cleaned = re.sub(r"[,\s]", "", match.group(0))
    if not cleaned or cleaned == ".":
        return None

    try:
        amount = Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None

    return -amount if negative else amount


def normalise_code(value: str | None) -> str | None:
    """Uppercase an identifier and remove the spaces documents print inside them."""
    if value is None:
        return None
    text = re.sub(r"\s+", "", str(value)).upper()
    return text or None


def normalise_email(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def normalise_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def to_date(value: str | None) -> date | None:
    """ISO string to a date object, for writing to a DATE column."""
    iso = normalise_date(value)
    return date.fromisoformat(iso) if iso else None
