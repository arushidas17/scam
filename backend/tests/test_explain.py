"""
The explanation step. Mocked client throughout, no network.

The security-relevant assertions here are that the score never reaches the
model and that bank account numbers never leave the building.
"""

from __future__ import annotations

import json

from app.services.explain import (
    PROMPT,
    explain,
    fallback_explanation,
    _safe_flag_summary,
)
from app.services.risk_rules import Flag
from tests.conftest import fake_gemini, failing_gemini

FLAGS = [
    Flag("bank_account_changed", "Bank account changed",
         "Pay 91847263510094 instead of 50100294817732.", 40,
         {"on_record": "50100294817732", "on_invoice": "91847263510094"}),
    Flag("lookalike_domain", "Lookalike email domain", "One character off.", 30,
         {"on_record": "abctechnologies.com", "on_invoice": "abctechnoiogies.com"}),
]

GOOD = json.dumps(
    {
        "verdict": "Do not release this payment until the account is confirmed by phone.",
        "steps": [
            "Call ABC Technologies on the number in your vendor records.",
            "Compare the sender domain against the one on record.",
        ],
    }
)


def test_the_model_never_sees_the_score_or_the_points() -> None:
    captured = {}

    class Client:
        class interactions:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                from types import SimpleNamespace
                return SimpleNamespace(output_text=GOOD)

    explain(FLAGS, vendor_name="ABC Technologies", amount="486500", client=Client())

    sent = captured["input"][0]["text"]
    assert "40" not in sent and "30" not in sent, "points would let it reconstruct the score"
    assert "87" not in sent
    assert "points" not in sent.lower().replace("appoints", "")


def test_bank_account_numbers_never_reach_the_model() -> None:
    summary = _safe_flag_summary(FLAGS)
    blob = json.dumps(summary)
    assert "91847263510094" not in blob
    assert "50100294817732" not in blob
    assert "[redacted]" in blob
    # Evidence is dropped wholesale, not merely scrubbed.
    assert all("evidence" not in entry for entry in summary)


def test_the_prompt_insists_on_the_number_on_record() -> None:
    """The single instruction that makes the advice safe."""
    # Collapse the prompt's own line wrapping before matching on phrases.
    lowered = " ".join(PROMPT.lower().split())
    assert "phone number already held in your own vendor records" in lowered
    assert "not to use any phone number, email address or link" in lowered
    assert "taken from the invoice or the email it arrived with" in lowered


def test_a_good_response_is_used() -> None:
    result = explain(FLAGS, vendor_name="ABC Technologies", client=fake_gemini(GOOD))
    assert result.generated_by_fallback is False
    assert result.verdict.startswith("Do not release")
    assert len(result.steps) == 2


def test_the_fallback_is_used_when_the_model_fails() -> None:
    result = explain(FLAGS, vendor_name="ABC Technologies", client=failing_gemini())
    assert result.generated_by_fallback is True
    assert result.verdict
    assert 2 <= len(result.steps) <= 4


def test_the_fallback_is_used_when_the_response_is_malformed() -> None:
    result = explain(FLAGS, vendor_name="ABC Technologies", client=fake_gemini("not json"))
    assert result.generated_by_fallback is True


def test_a_thin_response_falls_back() -> None:
    thin = json.dumps({"verdict": "Careful.", "steps": ["Only one step."]})
    result = explain(FLAGS, vendor_name="ABC Technologies", client=fake_gemini(thin))
    assert result.generated_by_fallback is True, "the contract is 2 to 4 steps"


def test_the_fallback_still_tells_you_to_use_the_number_on_record() -> None:
    result = fallback_explanation(FLAGS, "ABC Technologies")
    joined = " ".join(result.steps).lower()
    assert "already held in your vendor records" in joined
    assert "never a number or address taken from the invoice" in joined


def test_the_fallback_is_specific_to_the_flags_that_fired() -> None:
    duplicate = [Flag("duplicate_invoice", "Duplicate invoice", "Seen before.", 35)]
    result = fallback_explanation(duplicate, "ABC Technologies")
    assert any("matching invoice" in s.lower() for s in result.steps)
    assert not any("domain" in s.lower() for s in result.steps)


def test_no_flags_means_no_model_call() -> None:
    """Nothing fired, so there is nothing to explain and no reason to pay for a call."""
    called = []

    class Client:
        class interactions:
            @staticmethod
            def create(**kwargs):
                called.append(kwargs)
                raise AssertionError("should not be called")

    result = explain([], vendor_name="ABC Technologies", client=Client())
    assert called == []
    assert result.generated_by_fallback is True


def test_explain_never_raises() -> None:
    """A score that is already computed must not be lost to an explanation failure."""
    result = explain(FLAGS, vendor_name=None, client=failing_gemini(KeyboardInterrupt and RuntimeError("boom")))
    assert result.verdict
