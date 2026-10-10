"""
Every rule: firing, not firing, and with null inputs.

Fake data throughout. No network, no database.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services import risk_constants as K
from app.services.risk_rules import (
    ALL_RULES,
    BankChange,
    PastInvoice,
    RuleContext,
    abnormal_amount,
    bank_account_changed,
    duplicate_invoice,
    gstin_invalid_or_mismatched,
    lookalike_domain,
    new_vendor,
    odd_timing,
    run_rules,
    totals_mismatch,
)
from tests.conftest import FakeVendor, past_invoices


# --- the whole set -----------------------------------------------------------
def test_a_clean_invoice_fires_nothing(clean_fields, ctx) -> None:
    assert run_rules(clean_fields, ctx) == []


def test_no_rule_raises_on_null_input(null_fields) -> None:
    """A field that is null means the rule cannot run, not that it should crash."""
    for rule in ALL_RULES:
        assert rule(null_fields, RuleContext()) is None or rule.__name__ == "new_vendor"


def test_no_rule_raises_on_an_empty_dict() -> None:
    for rule in ALL_RULES:
        rule({}, RuleContext())  # must not raise


def test_no_rule_raises_on_junk_values(ctx) -> None:
    junk = {k: object() for k in ("amount", "gst_amount", "invoice_date", "due_date")}
    junk.update({"gstin": 12345, "bank_account": [], "sender_email": 7})
    for rule in ALL_RULES:
        rule(junk, ctx)  # must not raise


# --- bank_account_changed ----------------------------------------------------
def test_bank_account_changed_fires(clean_fields, ctx) -> None:
    fields = {**clean_fields, "bank_account": "91847263510094"}
    flag = bank_account_changed(fields, ctx)

    assert flag is not None
    assert flag.points == K.POINTS_BANK_ACCOUNT_CHANGED == 40
    assert flag.evidence["on_record"] == "50100294817732"
    assert flag.evidence["on_invoice"] == "91847263510094"
    assert flag.evidence["record_last_confirmed_on"] == "2025-08-22"


def test_bank_account_changed_does_not_fire_when_it_matches(clean_fields, ctx) -> None:
    assert bank_account_changed(clean_fields, ctx) is None


def test_bank_account_changed_ignores_printed_spacing(clean_fields, ctx) -> None:
    """"5010 0294 8177 32" is the same account as "50100294817732"."""
    fields = {**clean_fields, "bank_account": "5010 0294 8177 32"}
    assert bank_account_changed(fields, ctx) is None


def test_bank_account_changed_is_silent_on_nulls(null_fields, ctx) -> None:
    assert bank_account_changed(null_fields, ctx) is None


def test_bank_account_changed_needs_a_vendor(clean_fields) -> None:
    fields = {**clean_fields, "bank_account": "99999999999999"}
    assert bank_account_changed(fields, RuleContext(vendor=None)) is None


# --- duplicate_invoice -------------------------------------------------------
def test_duplicate_invoice_fires_on_the_same_number(clean_fields, vendor) -> None:
    ctx = RuleContext(
        vendor=vendor,
        vendor_invoices=[
            PastInvoice("other", "ABC/2026/0914", date(2026, 5, 1), Decimal("111"))
        ],
        current_invoice_id="current",
    )
    flag = duplicate_invoice(clean_fields, ctx)
    assert flag is not None
    assert flag.points == K.POINTS_DUPLICATE_INVOICE == 35
    assert flag.evidence["matched_on"] == "invoice_number"
    assert flag.evidence["other_invoice_id"] == "other"


def test_duplicate_invoice_fires_on_same_amount_within_the_window(clean_fields, vendor) -> None:
    ctx = RuleContext(
        vendor=vendor,
        vendor_invoices=[
            PastInvoice("other", "DIFFERENT-1", date(2026, 10, 1), Decimal("350000.00"))
        ],
        current_invoice_id="current",
    )
    flag = duplicate_invoice(clean_fields, ctx)
    assert flag is not None
    assert flag.evidence["matched_on"] == "amount_and_date"


def test_duplicate_invoice_does_not_fire_outside_the_window(clean_fields, vendor) -> None:
    far_off = date(2026, 10, 5) - timedelta(days=K.DUPLICATE_WINDOW_DAYS + 10)
    ctx = RuleContext(
        vendor=vendor,
        vendor_invoices=[PastInvoice("other", "DIFFERENT-1", far_off, Decimal("350000.00"))],
        current_invoice_id="current",
    )
    assert duplicate_invoice(clean_fields, ctx) is None


def test_duplicate_invoice_ignores_the_invoice_itself(clean_fields, vendor) -> None:
    """An invoice is not its own duplicate."""
    ctx = RuleContext(
        vendor=vendor,
        vendor_invoices=[
            PastInvoice("current", "ABC/2026/0914", date(2026, 10, 5), Decimal("350000.00"))
        ],
        current_invoice_id="current",
    )
    assert duplicate_invoice(clean_fields, ctx) is None


def test_duplicate_invoice_is_silent_on_nulls(null_fields, ctx) -> None:
    assert duplicate_invoice(null_fields, ctx) is None


# --- lookalike_domain --------------------------------------------------------
@pytest.mark.parametrize(
    "sender, distance",
    [
        ("accounts@abctechnoIogies.com", 1),   # capital i for l
        ("accounts@abctechnologie.com", 1),    # a character dropped
        ("accounts@abctechnolgies.com", 1),
        ("accounts@abctechnlgies.com", 2),   # two characters dropped
    ],
)
def test_lookalike_domain_fires_on_near_misses(clean_fields, ctx, sender: str, distance: int) -> None:
    flag = lookalike_domain({**clean_fields, "sender_email": sender}, ctx)
    assert flag is not None, sender
    assert flag.points == K.POINTS_LOOKALIKE_DOMAIN == 30
    assert flag.evidence["edit_distance"] == distance
    assert flag.evidence["on_record"] == "abctechnologies.com"
    assert flag.evidence["differing_characters"], "the UI shows which characters differ"


def test_a_one_character_difference_fires_but_an_unrelated_domain_does_not(clean_fields, ctx) -> None:
    """The case the product exists for, next to the case it must not cry wolf on."""
    lookalike = lookalike_domain(
        {**clean_fields, "sender_email": "accounts@abctechnoIogies.com"}, ctx
    )
    assert lookalike is not None
    assert lookalike.evidence["edit_distance"] == 1

    unrelated = lookalike_domain(
        {**clean_fields, "sender_email": "accounts@totallydifferentsupplier.in"}, ctx
    )
    assert unrelated is None


def test_lookalike_domain_does_not_fire_on_the_real_domain(clean_fields, ctx) -> None:
    assert lookalike_domain(clean_fields, ctx) is None


def test_lookalike_domain_ignores_case(clean_fields, ctx) -> None:
    """Domains are case-insensitive, so this is the same address."""
    assert lookalike_domain({**clean_fields, "sender_email": "A@ABCTECHNOLOGIES.COM"}, ctx) is None


def test_lookalike_domain_is_silent_on_nulls(null_fields, ctx) -> None:
    assert lookalike_domain(null_fields, ctx) is None


def test_lookalike_domain_needs_a_vendor(clean_fields) -> None:
    fields = {**clean_fields, "sender_email": "accounts@abctechnoIogies.com"}
    assert lookalike_domain(fields, RuleContext(vendor=None)) is None


# --- gstin_invalid_or_mismatched ---------------------------------------------
def test_gstin_fires_when_malformed(clean_fields, ctx) -> None:
    flag = gstin_invalid_or_mismatched({**clean_fields, "gstin": "NOTAGSTIN"}, ctx)
    assert flag is not None
    assert flag.points == K.POINTS_GSTIN_INVALID_OR_MISMATCHED == 25
    assert flag.evidence["reason"] == "format"


def test_gstin_fires_when_it_belongs_to_someone_else(clean_fields, ctx) -> None:
    flag = gstin_invalid_or_mismatched({**clean_fields, "gstin": "29AAKCV6620Q1ZH"}, ctx)
    assert flag is not None
    assert flag.evidence["reason"] == "mismatch"
    assert flag.evidence["on_record"] == "27AABCA1234K1Z5"


def test_gstin_does_not_fire_when_it_matches(clean_fields, ctx) -> None:
    assert gstin_invalid_or_mismatched(clean_fields, ctx) is None


def test_gstin_is_silent_on_nulls(null_fields, ctx) -> None:
    assert gstin_invalid_or_mismatched(null_fields, ctx) is None


# --- abnormal_amount ---------------------------------------------------------
def test_abnormal_amount_is_skipped_below_the_history_threshold(clean_fields, vendor) -> None:
    """With four past invoices an 'average' is noise, so the rule must not fire."""
    thin = RuleContext(
        vendor=vendor,
        vendor_invoices=past_invoices(["300000", "310000", "305000", "295000"]),
        current_invoice_id="current",
    )
    assert len(thin.vendor_invoices) == K.ABNORMAL_AMOUNT_MIN_HISTORY - 1
    assert abnormal_amount({**clean_fields, "amount": Decimal("900000")}, thin) is None


def test_abnormal_amount_runs_at_the_history_threshold(clean_fields, vendor) -> None:
    enough = RuleContext(
        vendor=vendor,
        vendor_invoices=past_invoices(["300000", "310000", "305000", "295000", "302000"]),
        current_invoice_id="current",
    )
    assert len(enough.vendor_invoices) == K.ABNORMAL_AMOUNT_MIN_HISTORY
    assert abnormal_amount({**clean_fields, "amount": Decimal("900000")}, enough) is not None


def test_abnormal_amount_does_not_fire_within_the_normal_range(clean_fields, ctx) -> None:
    assert abnormal_amount(clean_fields, ctx) is None


def test_abnormal_amount_scores_15_just_over_the_threshold(clean_fields, vendor) -> None:
    flat = RuleContext(
        vendor=vendor,
        vendor_invoices=past_invoices(["100000"] * 6),
        current_invoice_id="current",
    )
    # 31% above an average of 100000, and the history has no spread, so the
    # sigma test is not what is driving this.
    flag = abnormal_amount({**clean_fields, "amount": Decimal("131000")}, flat)
    assert flag is not None
    assert flag.points == K.POINTS_ABNORMAL_AMOUNT_MIN == 15


def test_abnormal_amount_scores_25_beyond_three_sigma(clean_fields, vendor) -> None:
    spread = RuleContext(
        vendor=vendor,
        vendor_invoices=past_invoices(["99000", "100000", "101000", "100500", "99500", "100200"]),
        current_invoice_id="current",
    )
    flag = abnormal_amount({**clean_fields, "amount": Decimal("250000")}, spread)
    assert flag is not None
    assert flag.points == K.POINTS_ABNORMAL_AMOUNT_MAX == 25


def test_abnormal_amount_is_graduated_between_the_anchors(clean_fields, vendor) -> None:
    """15 at the threshold, 25 at the ceiling, rising in between."""
    flat = RuleContext(
        vendor=vendor, vendor_invoices=past_invoices(["100000"] * 8), current_invoice_id="current"
    )
    scored = {
        pct: abnormal_amount({**clean_fields, "amount": Decimal(str(100000 * (1 + pct / 100)))}, flat)
        for pct in (31, 42, 60, 90)
    }
    assert [f.points for f in scored.values()] == [15, 17, 20, 25]


def test_abnormal_amount_evidence_carries_the_comparison(clean_fields, vendor) -> None:
    flat = RuleContext(
        vendor=vendor, vendor_invoices=past_invoices(["100000"] * 8), current_invoice_id="current"
    )
    flag = abnormal_amount({**clean_fields, "amount": Decimal("142000")}, flat)
    assert flag.evidence["amount"] == "142000"
    assert flag.evidence["vendor_average"] == "100000.00"
    assert flag.evidence["percent_above_average"] == "42.0"
    assert flag.evidence["sample_size"] == 8


def test_abnormal_amount_is_silent_on_nulls(null_fields, ctx) -> None:
    assert abnormal_amount(null_fields, ctx) is None


def test_abnormal_amount_ignores_a_cheaper_invoice(clean_fields, ctx) -> None:
    assert abnormal_amount({**clean_fields, "amount": Decimal("10000")}, ctx) is None


# --- totals_mismatch ---------------------------------------------------------
def test_totals_mismatch_fires_when_the_tax_does_not_reconcile(clean_fields, ctx) -> None:
    flag = totals_mismatch({**clean_fields, "gst_amount": Decimal("12345.00")}, ctx)
    assert flag is not None
    assert flag.points == K.POINTS_TOTALS_MISMATCH == 15


def test_totals_mismatch_accepts_every_standard_rate(clean_fields, ctx) -> None:
    amount = Decimal("118000.00")
    for rate, gst in (("18", "18000.00"), ("12", "12642.86"), ("5", "5619.05"), ("0", "0.00")):
        fields = {**clean_fields, "amount": amount, "gst_amount": Decimal(gst)}
        assert totals_mismatch(fields, ctx) is None, f"{rate}% should reconcile"


def test_totals_mismatch_tolerates_one_rupee_of_rounding(clean_fields, ctx) -> None:
    # 18% of the implied net is 17999.96, so this is 0.24 out — inside tolerance.
    fields = {**clean_fields, "amount": Decimal("118000.00"), "gst_amount": Decimal("18000.20")}
    assert totals_mismatch(fields, ctx) is None


def test_totals_mismatch_fires_when_gst_exceeds_the_total(clean_fields, ctx) -> None:
    fields = {**clean_fields, "amount": Decimal("1000"), "gst_amount": Decimal("5000")}
    flag = totals_mismatch(fields, ctx)
    assert flag is not None


def test_totals_mismatch_is_silent_on_nulls(null_fields, ctx) -> None:
    assert totals_mismatch(null_fields, ctx) is None


def test_totals_mismatch_is_silent_when_only_gst_is_missing(clean_fields, ctx) -> None:
    assert totals_mismatch({**clean_fields, "gst_amount": None}, ctx) is None


# --- new_vendor --------------------------------------------------------------
def test_new_vendor_fires_when_nothing_matched(clean_fields) -> None:
    flag = new_vendor(clean_fields, RuleContext(vendor=None))
    assert flag is not None
    assert flag.points == K.POINTS_NEW_VENDOR == 10
    assert flag.evidence["vendor_name_on_invoice"] == "ABC Technologies"


def test_new_vendor_does_not_fire_when_a_vendor_matched(clean_fields, ctx) -> None:
    assert new_vendor(clean_fields, ctx) is None


def test_new_vendor_fires_even_with_nothing_to_show(null_fields) -> None:
    """An unreadable invoice from nobody we know is still an unknown vendor."""
    flag = new_vendor(null_fields, RuleContext(vendor=None))
    assert flag is not None
    assert flag.evidence["vendor_name_on_invoice"] is None


# --- odd_timing --------------------------------------------------------------
def test_odd_timing_fires_on_a_weekend_invoice(clean_fields, ctx) -> None:
    saturday = date(2026, 10, 3)
    flag = odd_timing({**clean_fields, "invoice_date": saturday, "due_date": date(2026, 11, 2)}, ctx)
    assert flag is not None
    assert flag.points == K.POINTS_ODD_TIMING == 10
    assert flag.evidence["weekend"] is True
    assert flag.evidence["invoice_day_of_week"] == "Saturday"


def test_odd_timing_fires_on_an_immediate_due_date(clean_fields, ctx) -> None:
    monday = date(2026, 10, 5)
    flag = odd_timing({**clean_fields, "invoice_date": monday, "due_date": monday}, ctx)
    assert flag is not None
    assert flag.evidence["days_until_due"] == 0


def test_odd_timing_does_not_fire_on_normal_terms(clean_fields, ctx) -> None:
    assert odd_timing(clean_fields, ctx) is None


def test_odd_timing_accepts_the_minimum_gap(clean_fields, ctx) -> None:
    monday = date(2026, 10, 5)
    fields = {**clean_fields, "invoice_date": monday, "due_date": date(2026, 10, 7)}
    assert odd_timing(fields, ctx) is None


def test_odd_timing_is_silent_on_nulls(null_fields, ctx) -> None:
    assert odd_timing(null_fields, ctx) is None


def test_odd_timing_works_with_no_due_date(clean_fields, ctx) -> None:
    assert odd_timing({**clean_fields, "due_date": None}, ctx) is None


# --- documents that are legitimately incomplete -------------------------------
#
# A retail cash receipt has no bank account, no IFSC, no sender email and often
# no GSTIN. None of that is suspicious; it is simply what the document is. The
# rules that compare those values must sit out rather than fire or raise.

@pytest.fixture
def receipt_fields() -> dict:
    """A cash receipt: an amount and a date, and nothing to pay into."""
    return {
        "vendor_name": "Sundaram General Stores",
        "invoice_number": "RCPT-88213",
        "invoice_date": date(2026, 10, 5),   # a Monday
        "due_date": None,                     # paid at the counter
        "amount": Decimal("1250.00"),
        "gst_amount": None,
        "gstin": None,
        "bank_account": None,
        "ifsc": None,
        "sender_email": None,
        "currency": "INR",
    }


def test_a_receipt_with_no_bank_details_scores_without_error(receipt_fields, ctx) -> None:
    flags = run_rules(receipt_fields, ctx)

    fired = {f.code for f in flags}
    assert "bank_account_changed" not in fired, "there is no account to have changed"
    assert "ifsc_changed" not in fired
    assert "lookalike_domain" not in fired, "there is no sender domain to compare"
    assert "gstin_invalid_or_mismatched" not in fired, "an absent GSTIN is not a malformed one"
    assert "totals_mismatch" not in fired, "no tax line to reconcile"


def test_a_receipt_scores_through_the_whole_pipeline(receipt_fields, ctx) -> None:
    """End to end: it produces a score, a band, and a coherent breakdown."""
    from app.services.scoring import score_flags

    result = score_flags(run_rules(receipt_fields, ctx))

    assert isinstance(result.score, int)
    assert 0 <= result.score <= 100
    assert result.status in ("normal", "needs_review", "suspicious")
    # The invariant still holds for a sparse document.
    assert sum(f.points for f in result.flags) == result.raw_total


def test_a_receipt_from_an_unknown_vendor_only_flags_the_unknown_vendor(receipt_fields) -> None:
    result_flags = run_rules(receipt_fields, RuleContext(vendor=None))
    assert {f.code for f in result_flags} == {"new_vendor"}


def test_a_receipt_with_nothing_but_an_amount_still_scores(ctx) -> None:
    """The sparsest document that could arrive: one number and nothing else."""
    from app.services.scoring import score_flags

    sparse = {
        "vendor_name": None, "invoice_number": None, "invoice_date": None,
        "due_date": None, "amount": Decimal("499.00"), "gst_amount": None,
        "gstin": None, "bank_account": None, "ifsc": None,
        "sender_email": None, "currency": None,
    }
    result = score_flags(run_rules(sparse, ctx))
    assert result.score >= 0
    assert result.status in ("normal", "needs_review", "suspicious")


def test_an_empty_string_counts_as_missing_not_as_a_bad_value(receipt_fields, ctx) -> None:
    """
    The form sends null for a cleared field, but an empty string must behave
    the same way rather than failing a format check.
    """
    blanked = {**receipt_fields, "gstin": "", "ifsc": "", "bank_account": "", "sender_email": ""}
    fired = {f.code for f in run_rules(blanked, ctx)}
    assert "gstin_invalid_or_mismatched" not in fired
    assert "ifsc_changed" not in fired
    assert "bank_account_changed" not in fired
