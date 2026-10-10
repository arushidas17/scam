"""
The one rule that only makes sense for a pasted message.

It lives here rather than in risk_rules because it has no meaning for an
uploaded invoice: an invoice has no covering text to apply pressure in. It
returns the same Flag type, so scoring.score_flags handles it unchanged — there
is no second copy of the scoring logic anywhere.
"""

from __future__ import annotations

import re
from typing import Any

from app.services.risk_rules import Flag

POINTS_URGENCY_LANGUAGE = 15

# Grouped so the UI can say *why* a phrase was marked, not merely that it was.
PHRASE_GROUPS: dict[str, tuple[str, ...]] = {
    "urgency": (
        "urgent", "urgently", "immediately", "right away", "as soon as possible",
        "asap", "today itself", "process today", "by end of day",
        "before close of business", "time sensitive", "time-sensitive",
        "cannot wait", "final notice", "last reminder", "same day", "today",
    ),
    "secrecy": (
        "confidential", "strictly confidential", "do not discuss", "do not call",
        "don't call", "keep this between", "discreet", "do not inform",
        "no need to inform", "without involving", "only you",
    ),
    "new_account": (
        "new account", "new bank", "updated bank", "updated account",
        "changed our bank", "change our bank", "bank details have changed",
        "account details have changed", "revised bank", "new beneficiary",
        "kindly update", "update our records", "remit to", "wire to",
    ),
}

REASONS = {
    "urgency": "Pressure to pay quickly is used to push a request past the normal checks.",
    "secrecy": "A request to keep this quiet is meant to stop you verifying it with anyone else.",
    "new_account": "A change of payout details is the most common invoice-fraud tactic.",
}


def find_phrases(text: str) -> list[dict[str, Any]]:
    """
    Every matched phrase with its character offsets, so the front end can
    highlight it in the original text without re-scanning.

    Overlaps are dropped longest-first, so "strictly confidential" wins over
    "confidential" rather than producing two marks on the same words.
    """
    if not text:
        return []

    lowered = text.lower()
    hits: list[dict[str, Any]] = []

    for kind, phrases in PHRASE_GROUPS.items():
        for phrase in phrases:
            start = lowered.find(phrase)
            while start != -1:
                # Whole words only: "today" should not match inside "todays".
                before_ok = start == 0 or not lowered[start - 1].isalnum()
                end = start + len(phrase)
                after_ok = end >= len(lowered) or not lowered[end].isalnum()
                if before_ok and after_ok:
                    hits.append(
                        {
                            "kind": kind,
                            "phrase": text[start:end],
                            "start": start,
                            "end": end,
                            "reason": REASONS[kind],
                        }
                    )
                start = lowered.find(phrase, start + 1)

    hits.sort(key=lambda h: (h["start"], -(h["end"] - h["start"])))

    kept: list[dict[str, Any]] = []
    for hit in hits:
        if not any(hit["start"] < k["end"] and k["start"] < hit["end"] for k in kept):
            kept.append(hit)

    return sorted(kept, key=lambda h: h["start"])


def urgency_language(fields: dict[str, Any], ctx: Any) -> Flag | None:
    """
    Pressure, secrecy or a payout change in the wording itself.

    ``fields["message_text"]`` is the subject and body joined. Like every rule,
    missing input means it cannot run, so it returns None.
    """
    text = fields.get("message_text")
    if not text or not isinstance(text, str):
        return None

    hits = find_phrases(text)
    if not hits:
        return None

    by_kind: dict[str, list[str]] = {}
    for hit in hits:
        by_kind.setdefault(hit["kind"], []).append(hit["phrase"])

    described = ", ".join(
        f"{kind.replace('_', ' ')} ({len(phrases)})" for kind, phrases in sorted(by_kind.items())
    )

    return Flag(
        code="urgency_language",
        title="Pressure or secrecy in the wording",
        message=(
            "The message uses language designed to rush or quieten the request: "
            f"{described}."
        ),
        points=POINTS_URGENCY_LANGUAGE,
        evidence={
            "matches": [{k: hit[k] for k in ("kind", "phrase", "start", "end")} for hit in hits],
            "counts": {kind: len(phrases) for kind, phrases in by_kind.items()},
        },
    )
