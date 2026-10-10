"""
Writing the explanation.

This is the *only* place the model is used in the risk path, and it is used
after the score exists, purely to put the findings into sentences. It is never
asked for a score, a severity or a probability — those come from risk_rules,
which is what makes a score reproducible.

Two things are deliberately withheld from the prompt:

* **The score.** A model handed "87" will write a justification for 87, which
  reads like reasoning but is post-hoc. It sees only what fired.
* **Bank account numbers.** They are never needed to write advice, and the
  cheapest way to avoid leaking them to a third party is not to send them.
"""

from __future__ import annotations

import json
import logging
import random
import re
import time
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.services.extraction import _is_transient
from app.services.risk_rules import Flag

logger = logging.getLogger(__name__)

# Anything that looks like a long run of digits is an account number.
_ACCOUNT_LIKE = re.compile(r"\b\d[\d\s-]{7,}\d\b")

PROMPT = """You are writing the review note for an accounts-payable team in India
who are about to decide whether to pay an invoice.

You are given the checks that FIRED on this invoice, the vendor name, and the
amount. You are NOT given a risk score, and you must not invent one. Do not use
the words "score", "probability", "likelihood", or any percentage of certainty.

Write:
1. "verdict": ONE sentence saying what the team should do. Be direct and
   concrete. If payout details are in question, say plainly that the payment
   should not be released until they are confirmed.
2. "steps": between 2 and 4 numbered verification steps, each a single
   sentence, each specific to the checks that actually fired. Do not pad with
   generic advice.

The single most important instruction:
Whenever a step involves contacting the vendor, it must say to use the phone
number already held in your own vendor records, and must say explicitly NOT to
use any phone number, email address or link taken from the invoice or the
email it arrived with. Those details are controlled by whoever sent the
document, so using them means confirming the fraud with the fraudster.

Write plainly, for a busy person. No jargon. Return JSON only."""


class Explanation(BaseModel):
    verdict: str
    steps: list[str]


@dataclass(frozen=True)
class ExplanationResult:
    verdict: str
    steps: list[str]
    # True when the model could not be reached and the template was used.
    generated_by_fallback: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "steps": list(self.steps),
            "generated_by_fallback": self.generated_by_fallback,
        }


def _redact(text: str) -> str:
    key = get_settings().gemini_api_key
    cleaned = text.replace(key, "<redacted>") if key else text
    return re.sub(r"AIza[0-9A-Za-z_\-]{10,}", "<redacted>", cleaned)


def _safe_flag_summary(flags: list[Flag]) -> list[dict[str, str]]:
    """
    What the model is allowed to see about each flag.

    Only the code, the title and the human message — never ``points`` (which
    would let it reconstruct the score) and never ``evidence`` (which holds
    account numbers). Messages are scrubbed of anything account-shaped as a
    second line of defence, in case a rule's wording ever changes.
    """
    return [
        {
            "check": flag.code,
            "title": flag.title,
            "finding": _ACCOUNT_LIKE.sub("[redacted]", flag.message),
        }
        for flag in flags
    ]


def fallback_explanation(flags: list[Flag], vendor_name: str | None) -> ExplanationResult:
    """
    A template built from the flags themselves.

    The score must never depend on the model being reachable, so this is a real
    answer rather than a placeholder: every step below is the action a reviewer
    should take for that finding.
    """
    who = vendor_name or "the vendor"
    codes = {flag.code for flag in flags}
    steps: list[str] = []

    if {"bank_account_changed", "lookalike_domain"} & codes:
        steps.append(
            f"Call {who} on the phone number already held in your vendor records — "
            "never a number or address taken from the invoice or the email it arrived with — "
            "and confirm the payment details with a named contact."
        )
    if "lookalike_domain" in codes:
        steps.append(
            "Compare the sender's domain against the one on record character by character, "
            "and start a fresh email to the address on record rather than replying to this one."
        )
    if "duplicate_invoice" in codes:
        steps.append(
            "Open the matching invoice already on file and confirm which one, if either, is still owed."
        )
    if "abnormal_amount" in codes:
        steps.append(
            "Check the amount against the purchase order or contract before releasing anything."
        )
    if "gstin_invalid_or_mismatched" in codes:
        steps.append("Verify the GSTIN against the GST portal and against your own vendor record.")
    if "totals_mismatch" in codes:
        steps.append("Ask the vendor to reissue the invoice with the tax and total reconciled.")
    if "new_vendor" in codes:
        steps.append(
            "Confirm this vendor was approved through your onboarding process before any first payment."
        )
    if "odd_timing" in codes:
        steps.append("Query the payment deadline; a same-day due date is not a normal term.")

    if not steps:
        steps.append("No checks were raised. Approve through the usual process.")

    if not flags:
        verdict = "Nothing was flagged on this invoice; it can follow the normal approval path."
    elif "bank_account_changed" in codes:
        verdict = (
            "Do not release this payment until the account details have been confirmed "
            f"with {who} by phone."
        )
    else:
        verdict = (
            f"Hold this invoice for a second check before paying {who}; "
            "the points below need confirming first."
        )

    # The contract is 2 to 4 steps.
    return ExplanationResult(verdict=verdict, steps=steps[:4], generated_by_fallback=True)


def _build_client(settings: Any) -> Any:
    from google import genai

    return genai.Client(api_key=settings.gemini_api_key)


def explain(
    flags: list[Flag],
    *,
    vendor_name: str | None,
    amount: Any = None,
    client: Any | None = None,
) -> ExplanationResult:
    """
    Ask the model to write the note, falling back to a template on any failure.

    This never raises: a scored invoice with a templated explanation is a
    working product, while an exception here would lose a score that was
    already correctly computed.
    """
    settings = get_settings()

    if not flags:
        return fallback_explanation(flags, vendor_name)

    payload = {
        "vendor_name": vendor_name,
        "amount": str(amount) if amount is not None else None,
        "checks_that_fired": _safe_flag_summary(flags),
    }

    try:
        client = client or _build_client(settings)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not build the explanation client: %s", _redact(str(exc)))
        return fallback_explanation(flags, vendor_name)

    attempts = max(1, settings.gemini_max_attempts)
    for attempt in range(1, attempts + 1):
        try:
            interaction = client.interactions.create(
                model=settings.gemini_model,
                input=[{"type": "text", "text": PROMPT + "\n\n" + json.dumps(payload, indent=2)}],
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": Explanation.model_json_schema(),
                },
                timeout=settings.gemini_timeout_seconds,
            )
            parsed = Explanation.model_validate_json(interaction.output_text or "")
        except (ValidationError, ValueError) as exc:
            logger.warning(
                "Explanation did not match the schema (attempt %s/%s): %s",
                attempt, attempts, _redact(str(exc))[:300],
            )
            if attempt >= attempts:
                break
            continue
        except Exception as exc:  # noqa: BLE001 - the SDK raises many types
            logger.warning(
                "Explanation call failed (attempt %s/%s): %s: %s",
                attempt, attempts, type(exc).__name__, _redact(str(exc))[:300],
            )
            # A timeout or a 503 is worth another go; a bad request is not, and
            # the template is a perfectly good answer either way.
            if attempt >= attempts or not _is_transient(exc):
                break
            time.sleep((2 ** (attempt - 1)) + random.uniform(0, 0.3))
            continue

        steps = [s.strip() for s in parsed.steps if s and s.strip()]
        if not parsed.verdict.strip() or len(steps) < 2:
            logger.warning("Explanation came back too thin; using the template instead.")
            break

        return ExplanationResult(
            verdict=parsed.verdict.strip(), steps=steps[:4], generated_by_fallback=False
        )

    return fallback_explanation(flags, vendor_name)
