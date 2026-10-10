"""
The demo case, end to end, with a mocked Gemini client.

ABC Technologies, a changed bank account, a sender domain with a capital I
where the l should be, and an amount 42% above the vendor's average must score
exactly 87 from exactly three flags:

    bank_account_changed   +40
    lookalike_domain       +30
    abnormal_amount        +17   (42% above average, graduated 15..25)
                           ----
                             87   suspicious

Nothing else may fire, or the total would not be 87 — which is why the invoice
below has a matching GSTIN, reconciling totals, a weekday date and normal terms.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

import pytest

from app.services.explain import explain
from app.services.risk_rules import BankChange, PastInvoice, RuleContext, run_rules
from app.services.scoring import score_flags
from app.services.vendor_match import match_vendor
from tests.conftest import FakeVendor, fake_gemini, failing_gemini

# Eight settled invoices averaging exactly 300000, with a realistic spread
# (standard deviation ~52200). The spread matters: with a tightly clustered
# history, 42% above the mean would be more than three standard deviations out
# and abnormal_amount would award its maximum 25 rather than 17.
HISTORY_AMOUNTS = ["220000", "240000", "270000", "300000", "300000", "330000", "360000", "380000"]
VENDOR_AVERAGE = Decimal("300000")
# 42% above 300000.
DEMO_AMOUNT = Decimal("426000")

ABC = FakeVendor(
    name="ABC Technologies",
    gstin="27AABCA1234K1Z5",
    email_domain="abctechnologies.com",
    bank_account="50100294817732",
)

# Capital I in place of the lowercase l — a one-character lookalike.
LOOKALIKE_SENDER = "accounts@abctechnoIogies.com"

MODEL_REPLY = json.dumps(
    {
        "verdict": "Do not release this payment until the bank details are confirmed by phone.",
        "steps": [
            "Call ABC Technologies on the number already in your vendor records, not any number on the invoice.",
            "Compare the sender's domain with abctechnologies.com character by character.",
            "Check the amount against the purchase order before releasing anything.",
        ],
    }
)


@pytest.fixture
def demo_fields() -> dict:
    return {
        "vendor_name": "ABC Technologies",
        "invoice_number": "ABC/2026/0914",
        "invoice_date": date(2026, 10, 5),   # a Monday
        "due_date": date(2026, 11, 4),       # normal 30-day terms
        "amount": DEMO_AMOUNT,
        "gst_amount": Decimal("64983.05"),   # 18% of the net, so totals reconcile
        "gstin": "27AABCA1234K1Z5",          # matches the vendor record
        "bank_account": "91847263510094",    # NOT the account on record
        "ifsc": "KKBK0007781",
        "sender_email": LOOKALIKE_SENDER,
        "currency": "INR",
    }


@pytest.fixture
def demo_ctx() -> RuleContext:
    return RuleContext(
        vendor=ABC,
        vendor_invoices=[
            PastInvoice(
                id=f"past-{i}",
                invoice_number=f"ABC/2026/{800 + i}",
                invoice_date=date(2026, 1 + (i % 9), 10),
                amount=Decimal(a),
            )
            for i, a in enumerate(HISTORY_AMOUNTS)
        ],
        bank_changes=[BankChange(changed_on=date(2026, 10, 3), verified=False)],
        current_invoice_id="demo",
    )


def test_the_demo_invoice_scores_exactly_87_with_three_flags(demo_fields, demo_ctx) -> None:
    result = score_flags(run_rules(demo_fields, demo_ctx))

    assert result.score == 87
    assert result.status == "suspicious"
    assert len(result.flags) == 3

    assert [(f.code, f.points) for f in result.flags] == [
        ("bank_account_changed", 40),
        ("lookalike_domain", 30),
        ("abnormal_amount", 17),
    ]
    # The arithmetic is re-derivable by hand from the flag list.
    assert sum(f.points for f in result.flags) == result.score
    assert result.capped is False


def test_the_demo_flags_carry_the_evidence_the_ui_shows(demo_fields, demo_ctx) -> None:
    flags = {f.code: f for f in run_rules(demo_fields, demo_ctx)}

    bank = flags["bank_account_changed"].evidence
    assert bank["on_record"] == "50100294817732"
    assert bank["on_invoice"] == "91847263510094"
    assert bank["record_last_confirmed_on"] == "2026-10-03"

    domain = flags["lookalike_domain"].evidence
    assert domain["on_record"] == "abctechnologies.com"
    assert domain["on_invoice"] == "abctechnoiogies.com"   # lowercased for comparison
    assert domain["edit_distance"] == 1
    assert domain["differing_characters"][0]["on_record"] == "l"
    assert domain["differing_characters"][0]["on_invoice"] == "i"

    amount = flags["abnormal_amount"].evidence
    assert amount["amount"] == "426000"
    assert amount["vendor_average"] == "300000.00"
    assert amount["percent_above_average"] == "42.0"
    assert amount["sample_size"] == 8
    # Inside three sigma, which is why this scores 17 and not the maximum 25.
    assert float(amount["standard_deviations_above"]) < 3.0


def test_the_lookalike_domain_does_not_resolve_to_the_real_vendor(demo_fields) -> None:
    """
    The sender domain must not match ABC, or the impersonation would be invisible.

    The invoice still identifies as ABC through its GSTIN, which is what lets
    the bank-account and amount rules compare against the right record.
    """
    by_domain = match_vendor({"sender_email": LOOKALIKE_SENDER}, None, vendors=[ABC])
    assert by_domain.vendor is None

    full = match_vendor(demo_fields, None, vendors=[ABC])
    assert full.vendor is ABC
    assert full.method == "gstin"


def test_the_demo_explanation_is_written_from_the_flags(demo_fields, demo_ctx) -> None:
    result = score_flags(run_rules(demo_fields, demo_ctx))
    explanation = explain(
        result.flags,
        vendor_name=ABC.name,
        amount=demo_fields["amount"],
        client=fake_gemini(MODEL_REPLY),
    )

    assert explanation.generated_by_fallback is False
    assert explanation.verdict
    assert 2 <= len(explanation.steps) <= 4


def test_the_demo_still_scores_87_when_the_model_is_unavailable(demo_fields, demo_ctx) -> None:
    """The score is plain Python; it cannot depend on the explanation call."""
    result = score_flags(run_rules(demo_fields, demo_ctx))
    explanation = explain(
        result.flags, vendor_name=ABC.name, amount=demo_fields["amount"], client=failing_gemini()
    )

    assert result.score == 87, "unchanged by the model being down"
    assert explanation.generated_by_fallback is True
    assert explanation.verdict
    assert 2 <= len(explanation.steps) <= 4
    assert "already held in your vendor records" in " ".join(explanation.steps)


def test_the_demo_score_is_reproducible(demo_fields, demo_ctx) -> None:
    """Same input, same score, every time — the point of rules over a model."""
    scores = {score_flags(run_rules(demo_fields, demo_ctx)).score for _ in range(25)}
    assert scores == {87}


def test_removing_the_changed_account_drops_the_score_by_exactly_40(demo_fields, demo_ctx) -> None:
    """Each flag's contribution is independent and traceable."""
    honest = {**demo_fields, "bank_account": ABC.bank_account}
    assert score_flags(run_rules(honest, demo_ctx)).score == 87 - 40


def test_a_clean_invoice_from_the_same_vendor_scores_zero(demo_fields, demo_ctx) -> None:
    clean = {
        **demo_fields,
        "amount": Decimal("300000"),
        "gst_amount": Decimal("45762.71"),   # 18% of the net
        "bank_account": ABC.bank_account,
        "sender_email": "accounts@abctechnologies.com",
    }
    result = score_flags(run_rules(clean, demo_ctx))
    assert result.score == 0
    assert result.status == "normal"
    assert result.flags == []
