"""Vendor matching. Fake vendors, no database."""

from __future__ import annotations

from app.services.vendor_match import (
    MATCH_DOMAIN,
    MATCH_GSTIN,
    MATCH_NAME,
    MATCH_NONE,
    match_vendor,
)
from tests.conftest import FakeVendor

ABC = FakeVendor()
MERIDIAN = FakeVendor(
    id="ven_mer", name="Meridian Supplies Pvt Ltd", gstin="27AADCM4821K1ZP",
    email_domain="meridiansupplies.in", bank_account="50100288110045",
)
VENDORS = [ABC, MERIDIAN]


def test_gstin_wins() -> None:
    match = match_vendor({"gstin": "27AABCA1234K1Z5", "vendor_name": "Something Else"}, None, vendors=VENDORS)
    assert match.vendor is ABC
    assert match.method == MATCH_GSTIN
    assert match.confidence == 1.0


def test_gstin_match_ignores_case_and_spacing() -> None:
    match = match_vendor({"gstin": " 27aabca1234k1z5 "}, None, vendors=VENDORS)
    assert match.vendor is ABC


def test_name_matches_when_the_gstin_is_missing() -> None:
    """A small typo still matches; this is what fuzzy matching is for."""
    match = match_vendor({"vendor_name": "ABC Tecnologies"}, None, vendors=VENDORS)
    assert match.vendor is ABC
    assert match.method == MATCH_NAME
    assert match.confidence >= 0.88


def test_a_legal_suffix_falls_below_the_threshold() -> None:
    """
    Documented behaviour, not an accident.

    token_sort_ratio scores "ABC Technologies Pvt Ltd" against "ABC
    Technologies" at 80, under the 88 threshold, so it does not match on name.
    Such an invoice still resolves via its GSTIN or sender domain, and failing
    to the "unknown vendor" path is the safe direction to fail in.
    """
    match = match_vendor({"vendor_name": "ABC Technologies Pvt Ltd"}, None, vendors=VENDORS)
    assert match.vendor is None

    # The same invoice with its GSTIN present matches conclusively.
    with_gstin = match_vendor(
        {"vendor_name": "ABC Technologies Pvt Ltd", "gstin": "27AABCA1234K1Z5"},
        None, vendors=VENDORS,
    )
    assert with_gstin.vendor is ABC


def test_token_sort_handles_reordered_words() -> None:
    match = match_vendor({"vendor_name": "Technologies ABC"}, None, vendors=VENDORS)
    assert match.vendor is ABC


def test_a_distant_name_does_not_match() -> None:
    match = match_vendor({"vendor_name": "Totally Unrelated Trading Co"}, None, vendors=VENDORS)
    assert match.vendor is None
    assert match.method == MATCH_NONE


def test_an_ambiguous_name_is_refused() -> None:
    """
    Two vendors within the margin cannot be told apart from the name alone.

    Returning None is the safe answer: a wrong match would compare the invoice
    against the wrong bank account, which is worse than reporting unknown.
    """
    twin = FakeVendor(id="ven_twin", name="ABC Technologie", gstin="29ZZZZZ1111Z1Z1",
                      email_domain="abctechnologie.in")
    match = match_vendor({"vendor_name": "ABC Technologies"}, None, vendors=[ABC, twin])
    assert match.vendor is None
    assert match.method == MATCH_NONE
    assert len(match.ambiguous_between) == 2, "the reviewer is told which two"


def test_domain_matches_last() -> None:
    match = match_vendor({"sender_email": "accounts@meridiansupplies.in"}, None, vendors=VENDORS)
    assert match.vendor is MERIDIAN
    assert match.method == MATCH_DOMAIN
    assert match.confidence < 1.0, "a domain is the weakest of the three signals"


def test_a_lookalike_domain_does_not_match_a_vendor() -> None:
    """The whole point: a near-miss domain must not quietly resolve to the real vendor."""
    match = match_vendor({"sender_email": "accounts@abctechnoIogies.com"}, None, vendors=VENDORS)
    assert match.vendor is None


def test_nothing_at_all_matches_nothing() -> None:
    match = match_vendor({}, None, vendors=VENDORS)
    assert match.vendor is None
    assert match.method == MATCH_NONE


def test_null_fields_are_safe() -> None:
    nulls = {"gstin": None, "vendor_name": None, "sender_email": None}
    assert match_vendor(nulls, None, vendors=VENDORS).vendor is None


def test_no_vendors_on_file() -> None:
    assert match_vendor({"gstin": "27AABCA1234K1Z5"}, None, vendors=[]).vendor is None
