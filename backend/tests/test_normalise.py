"""Normalisation helpers. Fake data, no network."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.normalise import (
    normalise_amount,
    normalise_code,
    normalise_date,
    normalise_email,
    normalise_text,
    to_date,
)


@pytest.mark.parametrize(
    "given, expected",
    [
        ("2026-04-03", "2026-04-03"),
        ("03/04/2026", "2026-04-03"),   # day-first, the Indian convention
        ("03-04-2026", "2026-04-03"),
        ("03.04.2026", "2026-04-03"),
        ("5 Jan 2026", "2026-01-05"),
        ("5 January 2026", "2026-01-05"),
        ("Jan 5, 2026", "2026-01-05"),
        ("2026/04/03", "2026-04-03"),
        ("03/04/26", "2026-04-03"),
        ("2026-04-03T10:30:00", "2026-04-03"),
    ],
)
def test_dates_normalise_to_iso(given: str, expected: str) -> None:
    assert normalise_date(given) == expected


@pytest.mark.parametrize("given", ["not a date", "", None, "32/13/2026"])
def test_unreadable_dates_become_none(given: str | None) -> None:
    assert normalise_date(given) is None


@pytest.mark.parametrize(
    "given, expected",
    [
        ("₹ 4,86,500.00", "486500.00"),   # Indian digit grouping
        ("Rs. 1,234", "1234"),            # the dot in "Rs." is not a decimal point
        ("INR 1,234/-", "1234"),
        ("4,86,500", "486500"),
        ("1234.50", "1234.50"),
        (".50", "0.50"),
        ("(1,200)", "-1200"),
        ("-500", "-500"),
        ("Total: Rs 12,500 only", "12500"),
        (486500, "486500"),
    ],
)
def test_amounts_strip_symbols_and_separators(given: object, expected: str) -> None:
    assert normalise_amount(given) == Decimal(expected)


@pytest.mark.parametrize("given", ["abc", "", None, "-"])
def test_unreadable_amounts_become_none(given: str | None) -> None:
    assert normalise_amount(given) is None


def test_amounts_keep_full_precision() -> None:
    """Decimal throughout; a float would lose paise."""
    assert normalise_amount("0.07") + normalise_amount("0.01") == Decimal("0.08")


@pytest.mark.parametrize(
    "given, expected",
    [
        (" 27aabca1234k1z5 ", "27AABCA1234K1Z5"),
        ("hdfc 0004512", "HDFC0004512"),
        ("5010 0294 8177 32", "50100294817732"),
        ("", None),
        (None, None),
    ],
)
def test_codes_uppercase_and_lose_spaces(given: str | None, expected: str | None) -> None:
    assert normalise_code(given) == expected


def test_emails_lowercase_and_trim() -> None:
    assert normalise_email("  Accounts@Vendor.IN ") == "accounts@vendor.in"
    assert normalise_email("") is None


def test_text_collapses_whitespace() -> None:
    assert normalise_text("  ABC   Technologies\n Pvt Ltd ") == "ABC Technologies Pvt Ltd"
    assert normalise_text("   ") is None


def test_to_date_returns_a_date_object() -> None:
    assert to_date("03/04/2026") == date(2026, 4, 3)
    assert to_date("rubbish") is None
