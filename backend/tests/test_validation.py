"""Sanity checks. Pure functions, fake data, no network."""

import pytest

from app.services.validation import (
    check_fields,
    due_date_not_before_invoice_date,
    is_positive_amount,
    is_valid_gstin,
    is_valid_ifsc,
)


@pytest.mark.parametrize(
    "gstin",
    ["27AABCA1234K1Z5", "07ZVTWS4267Q8ZX", "33BNSFZ9496J5ZJ"],
)
def test_well_formed_gstins_pass(gstin: str) -> None:
    assert is_valid_gstin(gstin)


@pytest.mark.parametrize(
    "gstin, why",
    [
        ("27AABCA1234K1Z", "too short"),
        ("27AABCA1234K1Z55", "too long"),
        ("2AABCA1234K1Z5X", "one state digit"),
        ("27AABCA1234K1X5", "no Z in position 14"),
        ("27AABCA1234K0Z5", "entity char may not be 0"),
        ("", "empty"),
        (None, "missing"),
    ],
)
def test_malformed_gstins_fail(gstin: str | None, why: str) -> None:
    assert not is_valid_gstin(gstin), why


def test_identifier_checks_are_case_insensitive() -> None:
    """
    Case is a formatting artifact, not a data-quality problem.

    The pipeline uppercases these during normalisation, but the checks are
    called directly with raw input too, so they tolerate either case rather
    than reporting a warning the user cannot act on.
    """
    assert is_valid_gstin("27aabca1234k1z5")
    assert is_valid_ifsc("hdfc0004512")
    assert is_valid_gstin("  27AABCA1234K1Z5  "), "surrounding space is trimmed"


@pytest.mark.parametrize("ifsc", ["HDFC0004512", "KKBK0007781", "SBIN0012345"])
def test_well_formed_ifscs_pass(ifsc: str) -> None:
    assert is_valid_ifsc(ifsc)


@pytest.mark.parametrize(
    "ifsc, why",
    [
        ("HDFC1004512", "fifth character must be 0"),
        ("HDF00004512", "only three bank letters"),
        ("HDFC000451", "too short"),
        ("HDFC00045123", "too long"),
        (None, "missing"),
    ],
)
def test_malformed_ifscs_fail(ifsc: str | None, why: str) -> None:
    assert not is_valid_ifsc(ifsc), why


@pytest.mark.parametrize("value", ["1", "0.01", 1500, 12.5, "486500.00"])
def test_positive_amounts_pass(value: object) -> None:
    assert is_positive_amount(value)


@pytest.mark.parametrize("value", ["0", "-1", 0, -12.5, "abc", None, ""])
def test_non_positive_amounts_fail(value: object) -> None:
    assert not is_positive_amount(value)


def test_due_date_on_or_after_invoice_date_is_fine() -> None:
    assert due_date_not_before_invoice_date("2026-04-01", "2026-05-01")
    assert due_date_not_before_invoice_date("2026-04-01", "2026-04-01")


def test_due_date_before_invoice_date_is_not() -> None:
    assert not due_date_not_before_invoice_date("2026-05-01", "2026-04-01")


def test_missing_dates_are_not_an_error() -> None:
    """Real invoices are often incomplete; absence is not a contradiction."""
    assert due_date_not_before_invoice_date(None, "2026-04-01")
    assert due_date_not_before_invoice_date("2026-04-01", None)
    assert due_date_not_before_invoice_date(None, None)


def test_clean_fields_produce_no_warnings() -> None:
    assert (
        check_fields(
            {
                "gstin": "27AABCA1234K1Z5",
                "ifsc": "HDFC0004512",
                "amount": "486500.00",
                "gst_amount": "87570.00",
                "invoice_date": "2026-04-01",
                "due_date": "2026-05-01",
            }
        )
        == []
    )


def test_missing_fields_produce_no_warnings() -> None:
    """A null is the extractor doing as it was told, not a data-quality problem."""
    assert check_fields({k: None for k in
                         ("gstin", "ifsc", "amount", "gst_amount", "invoice_date", "due_date")}) == []


def test_each_bad_field_is_reported_once() -> None:
    warnings = check_fields(
        {
            "gstin": "NOTAGSTIN",
            "ifsc": "BAD",
            "amount": "-5",
            "gst_amount": "0",
            "invoice_date": "2026-05-01",
            "due_date": "2026-04-01",
        }
    )
    codes = [w["code"] for w in warnings]
    assert codes == [
        "gstin_format",
        "ifsc_format",
        "amount_not_positive",
        "gst_amount_not_positive",
        "due_before_invoice",
    ]
    assert all(w["message"] and w["field"] for w in warnings)
