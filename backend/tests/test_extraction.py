"""
Extraction with a fake Gemini client. No network.

The fake stands in for ``client.interactions.create`` and returns whatever the
test tells it to, so retry and schema-failure behaviour can be driven exactly.
"""

import json
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.extraction import (
    ExtractionFailed,
    ExtractionSchema,
    extract_invoice,
)

PDF = b"%PDF-1.4 fake"

GOOD = {
    "vendor_name": "ABC Technologies",
    "vendor_name_confidence": 0.98,
    "invoice_number": "ABC/2026/0914",
    "invoice_number_confidence": 0.95,
    "invoice_date": "03/04/2026",
    "invoice_date_confidence": 0.9,
    "due_date": "03/05/2026",
    "due_date_confidence": 0.7,
    "amount": "₹ 4,86,500.00",
    "amount_confidence": 0.96,
    "gst_amount": "87,570",
    "gst_amount_confidence": 0.6,
    "gstin": "27aabca1234k1z5",
    "gstin_confidence": 0.93,
    "bank_account": "5010 0294 8177 32",
    "bank_account_confidence": 0.62,
    "ifsc": "hdfc0004512",
    "ifsc_confidence": 0.88,
    "sender_email": "Accounts@ABCTechnologies.com",
    "sender_email_confidence": 0.9,
    "currency": "inr",
    "currency_confidence": 0.99,
}


class FakeClient:
    """Replays a scripted list of responses or exceptions."""

    def __init__(self, *responses):
        self._responses = list(responses)
        self.calls = []
        self.interactions = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        item = self._responses.pop(0) if self._responses else self._responses_exhausted()
        if isinstance(item, Exception):
            raise item
        return SimpleNamespace(output_text=item)

    @staticmethod
    def _responses_exhausted():
        raise AssertionError("the client was called more times than the test scripted")


class FakeTimeout(Exception):
    """Named so _is_transient recognises it the way the SDK's timeout is."""


def test_fields_are_normalised(monkeypatch) -> None:
    client = FakeClient(json.dumps(GOOD))
    result = extract_invoice(PDF, "application/pdf", client=client)

    assert result.fields["vendor_name"] == "ABC Technologies"
    assert result.fields["invoice_date"] == "2026-04-03"      # day-first to ISO
    assert result.fields["due_date"] == "2026-05-03"
    assert result.fields["amount"] == Decimal("486500.00")    # symbol and commas gone
    assert result.fields["gst_amount"] == Decimal("87570")
    assert result.fields["gstin"] == "27AABCA1234K1Z5"        # uppercased
    assert result.fields["ifsc"] == "HDFC0004512"
    assert result.fields["bank_account"] == "50100294817732"  # spaces gone
    assert result.fields["sender_email"] == "accounts@abctechnologies.com"
    assert result.fields["currency"] == "INR"


def test_confidence_is_carried_through() -> None:
    result = extract_invoice(PDF, "application/pdf", client=FakeClient(json.dumps(GOOD)))
    assert result.confidence["vendor_name"] == pytest.approx(0.98)
    assert result.confidence["bank_account"] == pytest.approx(0.62)

    by_name = {f["name"]: f for f in result.as_field_list()}
    assert by_name["amount"]["value"] == "486500.00"   # Decimal crosses as a string
    assert by_name["amount"]["confidence"] == pytest.approx(0.96)


def test_the_call_matches_the_documented_sdk_shape() -> None:
    client = FakeClient(json.dumps(GOOD))
    extract_invoice(PDF, "application/pdf", client=client)

    sent = client.calls[0]
    assert sent["model"]
    assert sent["timeout"] > 0
    assert sent["response_format"]["mime_type"] == "application/json"
    assert "schema" in sent["response_format"]

    document, text = sent["input"]
    assert document["type"] == "document"
    assert document["mime_type"] == "application/pdf"
    assert document["data"], "the file is sent base64-encoded"
    assert text["type"] == "text"
    assert "null" in text["text"].lower(), "the prompt must forbid guessing"


def test_nulls_are_preserved_rather_than_invented() -> None:
    sparse = {**{k: None for k in GOOD if not k.endswith("_confidence")},
              **{k: 0.0 for k in GOOD if k.endswith("_confidence")}}
    sparse["invoice_number"] = "INV-1"
    sparse["invoice_number_confidence"] = 1.0

    result = extract_invoice(PDF, "application/pdf", client=FakeClient(json.dumps(sparse)))
    assert result.fields["invoice_number"] == "INV-1"
    assert result.fields["amount"] is None
    assert result.fields["gstin"] is None


def test_placeholder_strings_are_treated_as_null() -> None:
    noisy = {**GOOD, "gstin": "N/A", "bank_account": "not visible", "due_date": "-"}
    result = extract_invoice(PDF, "application/pdf", client=FakeClient(json.dumps(noisy)))
    assert result.fields["gstin"] is None
    assert result.fields["bank_account"] is None
    assert result.fields["due_date"] is None


def test_confidence_drops_when_a_value_cannot_be_parsed() -> None:
    """A high confidence must not survive against a value we could not read."""
    broken = {**GOOD, "amount": "not a number", "amount_confidence": 0.99}
    result = extract_invoice(PDF, "application/pdf", client=FakeClient(json.dumps(broken)))
    assert result.fields["amount"] is None
    assert result.confidence["amount"] == 0.0


def test_confidence_is_clamped_to_the_zero_one_range() -> None:
    odd = {**GOOD, "amount_confidence": 7.5, "gstin_confidence": -2}
    result = extract_invoice(PDF, "application/pdf", client=FakeClient(json.dumps(odd)))
    assert result.confidence["amount"] == 1.0
    assert result.confidence["gstin"] == 0.0


def test_transient_errors_are_retried(monkeypatch) -> None:
    monkeypatch.setattr("app.services.extraction.time.sleep", lambda _: None)
    client = FakeClient(FakeTimeout("gateway"), FakeTimeout("gateway"), json.dumps(GOOD))

    result = extract_invoice(PDF, "application/pdf", client=client)
    assert result.fields["invoice_number"] == "ABC/2026/0914"
    assert len(client.calls) == 3, "one call plus two retries"


def test_retries_give_up_after_the_configured_attempts(monkeypatch) -> None:
    monkeypatch.setattr("app.services.extraction.time.sleep", lambda _: None)
    client = FakeClient(FakeTimeout("a"), FakeTimeout("b"), FakeTimeout("c"))

    with pytest.raises(ExtractionFailed):
        extract_invoice(PDF, "application/pdf", client=client)
    assert len(client.calls) == 3


def test_a_non_transient_error_is_not_retried(monkeypatch) -> None:
    monkeypatch.setattr("app.services.extraction.time.sleep", lambda _: None)
    client = FakeClient(ValueError("bad request"))

    with pytest.raises(ExtractionFailed):
        extract_invoice(PDF, "application/pdf", client=client)
    assert len(client.calls) == 1, "a 400-class error must not be retried"


def test_a_malformed_response_is_retried_once_then_fails() -> None:
    client = FakeClient("this is not json", "still not json")

    with pytest.raises(ExtractionFailed) as excinfo:
        extract_invoice(PDF, "application/pdf", client=client)

    assert len(client.calls) == 2, "one schema retry, then give up"
    assert excinfo.value.raw == "still not json", "the raw answer is kept for diagnosis"


def test_a_malformed_response_followed_by_a_good_one_succeeds() -> None:
    client = FakeClient("{not json", json.dumps(GOOD))
    result = extract_invoice(PDF, "application/pdf", client=client)
    assert result.fields["vendor_name"] == "ABC Technologies"
    assert len(client.calls) == 2


def test_the_api_key_never_reaches_a_log(caplog, monkeypatch) -> None:
    monkeypatch.setattr("app.services.extraction.time.sleep", lambda _: None)
    key = __import__("app.config", fromlist=["get_settings"]).get_settings().gemini_api_key

    client = FakeClient(FakeTimeout(f"failed with key {key}"),
                        FakeTimeout(f"failed with key {key}"),
                        FakeTimeout(f"failed with key {key}"))
    with caplog.at_level("WARNING"), pytest.raises(ExtractionFailed):
        extract_invoice(PDF, "application/pdf", client=client)

    assert key, "the test needs a key configured to be meaningful"
    assert key not in caplog.text
