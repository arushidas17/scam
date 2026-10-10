"""
Reading invoice fields out of a PDF or image with Gemini.

The SDK surface here follows the current docs (google-genai 2.x):

    client.interactions.create(
        model=...,
        input=[{"type": "document", "data": <base64>, "mime_type": ...},
               {"type": "text", "text": <prompt>}],
        response_format={"type": "text",
                         "mime_type": "application/json",
                         "schema": Model.model_json_schema()},
        timeout=...,
    )
    interaction.output_text   # the JSON string

Older ``client.models.generate_content(contents=..., config=...)`` tutorials
do not match this SDK.
"""

from __future__ import annotations

import base64
import json
import logging
import random
import re
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.config import get_settings
from app.services.normalise import (
    normalise_amount,
    normalise_code,
    normalise_date,
    normalise_email,
    normalise_text,
)

logger = logging.getLogger(__name__)

# The fields we ask for, in the order they are presented to the model.
FIELD_NAMES = (
    "vendor_name",
    "invoice_number",
    "invoice_date",
    "due_date",
    "amount",
    "gst_amount",
    "gstin",
    "bank_account",
    "ifsc",
    "sender_email",
    "currency",
)

PROMPT = """You are reading a single supplier invoice for an accounts-payable team.

Return ONLY what is actually printed on the document.

Rules, in order of importance:
1. If a value is not visible on the document, return null for it. Never infer,
   complete or guess a value. A null is always better than a plausible guess —
   a wrong bank account here causes a real payment to go to the wrong place.
2. Copy values exactly as printed, including leading zeros and punctuation.
   Do not reformat dates, do not convert currencies, do not do arithmetic.
3. amount is the final total payable, not a subtotal or a line item.
4. gst_amount is the total tax charged, if it is shown separately.
5. bank_account is the account the invoice asks to be paid into.
6. sender_email is the email address the invoice came from or asks you to
   reply to, if one is printed.
7. currency is the ISO code if you can tell (INR, USD, EUR), else null.

For every field also give a confidence between 0 and 1:
  1.0  the value is printed clearly and unambiguously
  0.6  legible but partly ambiguous, or you had to choose between candidates
  0.3  barely legible, or inferred from layout rather than a clear label
  0.0  not present (pair this with a null value)

Return JSON only."""


# Deliberately flat, with a parallel "<field>_confidence" key rather than a
# nested {value, confidence} object per field: a flat model produces a schema
# with no $defs/$ref, so it survives whatever JSON-schema subset the API
# accepts. The flat shape is reassembled into {value, confidence} in
# ExtractionResult.as_field_list before it leaves this module.
#
# The class docstring is omitted on purpose — Pydantic copies it into the
# schema's "description", which is sent to the model as part of the contract.
class ExtractionSchema(BaseModel):

    vendor_name: str | None = None
    vendor_name_confidence: float = 0.0
    invoice_number: str | None = None
    invoice_number_confidence: float = 0.0
    invoice_date: str | None = None
    invoice_date_confidence: float = 0.0
    due_date: str | None = None
    due_date_confidence: float = 0.0
    amount: str | None = None
    amount_confidence: float = 0.0
    gst_amount: str | None = None
    gst_amount_confidence: float = 0.0
    gstin: str | None = None
    gstin_confidence: float = 0.0
    bank_account: str | None = None
    bank_account_confidence: float = 0.0
    ifsc: str | None = None
    ifsc_confidence: float = 0.0
    sender_email: str | None = None
    sender_email_confidence: float = 0.0
    currency: str | None = None
    currency_confidence: float = 0.0

    @field_validator("*", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        """Models sometimes answer "N/A" or "" where they were asked for null."""
        if isinstance(value, str) and value.strip().lower() in {
            "", "null", "none", "n/a", "na", "not visible", "not provided", "-",
        }:
            return None
        return value

    @field_validator(
        *[f"{name}_confidence" for name in FIELD_NAMES], mode="before"
    )
    @classmethod
    def _clamp_confidence(cls, value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, number))


class ExtractionFailed(RuntimeError):
    """The document could not be read into the expected shape."""

    def __init__(self, message: str, *, raw: str | None = None) -> None:
        super().__init__(message)
        self.raw = raw


@dataclass
class ExtractionResult:
    """Normalised fields, their confidence, and the untouched model response."""

    fields: dict[str, Any] = field(default_factory=dict)
    confidence: dict[str, float] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    def as_field_list(self) -> list[dict[str, Any]]:
        """{name, value, confidence} per field, which is what the UI wants."""
        return [
            {
                "name": name,
                "value": _jsonable(self.fields.get(name)),
                "confidence": self.confidence.get(name, 0.0),
            }
            for name in FIELD_NAMES
        ]


def _jsonable(value: Any) -> Any:
    """Decimals cross the wire as strings so no precision is lost."""
    return str(value) if hasattr(value, "quantize") else value


def _redact(text: str) -> str:
    """Never let the API key reach a log line."""
    key = get_settings().gemini_api_key
    cleaned = text.replace(key, "<redacted>") if key else text
    return re.sub(r"AIza[0-9A-Za-z_\-]{10,}", "<redacted>", cleaned)


def _normalise(parsed: ExtractionSchema) -> ExtractionResult:
    """Model output to storable values."""
    data = parsed.model_dump()

    fields: dict[str, Any] = {
        "vendor_name": normalise_text(data["vendor_name"]),
        "invoice_number": normalise_text(data["invoice_number"]),
        "invoice_date": normalise_date(data["invoice_date"]),
        "due_date": normalise_date(data["due_date"]),
        "amount": normalise_amount(data["amount"]),
        "gst_amount": normalise_amount(data["gst_amount"]),
        "gstin": normalise_code(data["gstin"]),
        "ifsc": normalise_code(data["ifsc"]),
        # Spaces are printed inside account numbers; the digits are the value.
        "bank_account": normalise_code(data["bank_account"]),
        "sender_email": normalise_email(data["sender_email"]),
        "currency": normalise_code(data["currency"]),
    }

    confidence = {name: data[f"{name}_confidence"] for name in FIELD_NAMES}

    # A value the model offered but that could not be parsed is not trustworthy,
    # so its confidence drops to zero rather than staying high against a null.
    for name, value in fields.items():
        if value is None and data.get(name) is not None:
            confidence[name] = 0.0

    return ExtractionResult(fields=fields, confidence=confidence, raw=data)


def _is_transient(exc: Exception) -> bool:
    """Timeouts, rate limits and 5xx are worth another go; a 400 is not."""
    name = type(exc).__name__
    if any(token in name for token in ("Timeout", "Connection", "RateLimit", "ServerError")):
        return True
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if isinstance(status, int):
        return status == 429 or 500 <= status < 600
    return False


def _call_model(client: Any, document: bytes, mime_type: str, settings: Any) -> str:
    """One request. Returns the raw JSON string the model produced."""
    interaction = client.interactions.create(
        model=settings.gemini_model,
        input=[
            {
                "type": "document",
                "data": base64.b64encode(document).decode("ascii"),
                "mime_type": mime_type,
            },
            {"type": "text", "text": PROMPT},
        ],
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": ExtractionSchema.model_json_schema(),
        },
        timeout=settings.gemini_timeout_seconds,
    )
    return interaction.output_text


def _build_client(settings: Any) -> Any:
    from google import genai

    return genai.Client(api_key=settings.gemini_api_key)


def extract_invoice(
    document: bytes,
    mime_type: str,
    *,
    client: Any | None = None,
) -> ExtractionResult:
    """
    Read an invoice.

    Retries transient failures with exponential backoff, and retries exactly
    once more when the model answers with something that does not match the
    schema. Raises ExtractionFailed when it still cannot be read, so the caller
    can keep the file and record the failure rather than losing it.

    ``client`` is injectable so tests never touch the network.
    """
    settings = get_settings()
    client = client or _build_client(settings)

    attempts = max(1, settings.gemini_max_attempts)
    last_error: Exception | None = None
    last_raw: str | None = None
    schema_retry_used = False

    attempt = 0
    while attempt < attempts:
        attempt += 1
        try:
            raw_text = _call_model(client, document, mime_type, settings)
        except Exception as exc:  # noqa: BLE001 - the SDK raises many types
            last_error = exc
            if not _is_transient(exc) or attempt >= attempts:
                logger.error(
                    "Gemini call failed on attempt %s/%s: %s: %s",
                    attempt, attempts, type(exc).__name__, _redact(str(exc)),
                )
                raise ExtractionFailed(
                    "The document could not be read. The extraction service did not respond."
                ) from exc

            # Exponential backoff with jitter, so retries do not synchronise.
            delay = (2 ** (attempt - 1)) + random.uniform(0, 0.4)
            logger.warning(
                "Gemini call failed on attempt %s/%s (%s); retrying in %.1fs",
                attempt, attempts, type(exc).__name__, delay,
            )
            time.sleep(delay)
            continue

        last_raw = raw_text
        try:
            parsed = ExtractionSchema.model_validate_json(raw_text or "")
        except (ValidationError, ValueError) as exc:
            last_error = exc
            # One extra go at a malformed answer; a second failure is reported.
            if not schema_retry_used:
                schema_retry_used = True
                attempts += 1
                logger.warning(
                    "Model returned a response that did not match the schema; retrying once."
                )
                continue

            logger.error(
                "Model response did not match the schema after a retry: %s",
                _redact(str(exc))[:500],
            )
            raise ExtractionFailed(
                "The document was read, but the extracted fields did not match the "
                "expected format. The file has been kept so it can be retried.",
                raw=raw_text,
            ) from exc

        return _normalise(parsed)

    raise ExtractionFailed(
        "The document could not be read.",
        raw=last_raw,
    ) from last_error


def raw_payload(result_or_raw: ExtractionResult | str | None) -> dict[str, Any]:
    """What goes into invoices.raw_extraction, kept untouched thereafter."""
    if isinstance(result_or_raw, ExtractionResult):
        return {"model": get_settings().gemini_model, "response": result_or_raw.raw}
    if isinstance(result_or_raw, str):
        try:
            return {"model": get_settings().gemini_model, "response": json.loads(result_or_raw)}
        except (TypeError, ValueError):
            return {"model": get_settings().gemini_model, "response_text": result_or_raw}
    return {"model": get_settings().gemini_model, "response": None}
