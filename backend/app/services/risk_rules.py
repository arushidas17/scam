"""
The risk rules.

One function per rule. Each takes the extracted fields plus a context object
and returns a Flag or None. Every rule is plain Python with fixed points — no
model is consulted, so the same invoice always scores the same.

Two invariants hold for every rule in here:

* **Never raise.** Real invoices are incomplete, and extraction returns null
  rather than guessing. A rule that cannot see what it needs returns None; it
  does not fire, and it does not blow up the pipeline.
* **No number of its own.** Thresholds and points live in risk_constants.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field as dataclass_field
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

from rapidfuzz.distance import Levenshtein

from app.services import risk_constants as K
from app.services.validation import is_valid_gstin


@dataclass(frozen=True)
class Flag:
    """One finding. ``points`` is what it contributes to the score."""

    code: str
    title: str
    message: str
    points: int
    evidence: dict[str, Any] = dataclass_field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "title": self.title,
            "message": self.message,
            "points": self.points,
            "evidence": self.evidence,
        }


@dataclass
class PastInvoice:
    """The slice of an existing invoice the rules compare against."""

    id: str
    invoice_number: str | None
    invoice_date: date | None
    amount: Decimal | None


@dataclass
class BankChange:
    """When a vendor's stored account was last changed, and whether anyone checked."""

    changed_on: date | None
    verified: bool = False


@dataclass
class RuleContext:
    """
    Everything the rules need, gathered once.

    Passing a plain object rather than a database session keeps every rule a
    pure function, which is what makes them testable with fake data.
    """

    vendor: Any | None = None
    # Settled invoices from the matched vendor, for the average and duplicates.
    vendor_invoices: list[PastInvoice] = dataclass_field(default_factory=list)
    bank_changes: list[BankChange] = dataclass_field(default_factory=list)
    # The invoice being scored, excluded from its own duplicate check.
    current_invoice_id: str | None = None


# --- small helpers -----------------------------------------------------------
def _decimal(value: Any) -> Decimal | None:
    """Anything to Decimal, or None. Never raises."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError, ArithmeticError, TypeError):
        return None


def _date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _digits(value: Any) -> str | None:
    """Account numbers are compared as digits; printed spacing is not meaningful."""
    if value is None:
        return None
    text = "".join(ch for ch in str(value) if ch.isalnum()).upper()
    return text or None


def _domain(email_or_domain: Any) -> str | None:
    if not email_or_domain:
        return None
    text = str(email_or_domain).strip().lower()
    if "@" in text:
        text = text.rsplit("@", 1)[1]
    return text or None


def _differing_characters(a: str, b: str) -> list[dict[str, Any]]:
    """
    Which characters differ, for the side-by-side display.

    Built from Levenshtein edit operations so an insertion or deletion is
    described as such rather than as a run of substitutions.
    """
    out: list[dict[str, Any]] = []
    for op, src_pos, dest_pos in Levenshtein.editops(a, b):
        out.append(
            {
                "operation": op,
                "position": src_pos,
                "on_record": a[src_pos] if op in ("replace", "delete") and src_pos < len(a) else None,
                "on_invoice": b[dest_pos] if op in ("replace", "insert") and dest_pos < len(b) else None,
            }
        )
    return out


# --- rules -------------------------------------------------------------------
def bank_account_changed(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """The invoice asks to be paid somewhere other than the account on record."""
    vendor = ctx.vendor
    if vendor is None:
        return None

    on_invoice = _digits(fields.get("bank_account"))
    on_record = _digits(getattr(vendor, "bank_account", None))
    if not on_invoice or not on_record or on_invoice == on_record:
        return None

    last_change = next(
        (c for c in sorted(
            (c for c in ctx.bank_changes if c.changed_on),
            key=lambda c: c.changed_on,
            reverse=True,
        )),
        None,
    )

    return Flag(
        code="bank_account_changed",
        title="Bank account changed",
        message=(
            f"This invoice asks you to pay an account that does not match the one "
            f"{vendor.name} is on record as using."
        ),
        points=K.POINTS_BANK_ACCOUNT_CHANGED,
        evidence={
            "on_record": on_record,
            "on_invoice": on_invoice,
            "record_last_confirmed_on": (
                last_change.changed_on.isoformat() if last_change and last_change.changed_on else None
            ),
            "record_last_confirmation_verified": last_change.verified if last_change else None,
        },
    )


def duplicate_invoice(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """The same bill, already received: by number, or by amount within a few days."""
    if ctx.vendor is None or not ctx.vendor_invoices:
        return None

    raw_number = fields.get("invoice_number")
    number = str(raw_number).strip().upper() if raw_number is not None else ""
    amount = _decimal(fields.get("amount"))
    invoice_date = _date(fields.get("invoice_date"))

    others = [p for p in ctx.vendor_invoices if p.id != ctx.current_invoice_id]

    # Same number from the same vendor is conclusive.
    if number:
        for past in others:
            if (past.invoice_number or "").strip().upper() == number:
                return _duplicate_flag(past, "invoice_number")

    # Otherwise the same amount inside the window is enough to stop and look.
    if amount is not None and invoice_date is not None:
        window = timedelta(days=K.DUPLICATE_WINDOW_DAYS)
        for past in others:
            if past.amount is None or past.invoice_date is None:
                continue
            if past.amount == amount and abs(past.invoice_date - invoice_date) <= window:
                return _duplicate_flag(past, "amount_and_date")

    return None


def _duplicate_flag(past: PastInvoice, matched_on: str) -> Flag:
    return Flag(
        code="duplicate_invoice",
        title="Duplicate invoice",
        message=(
            "An invoice from this vendor with the same details has already been "
            "received, so paying this one risks paying twice."
        ),
        points=K.POINTS_DUPLICATE_INVOICE,
        evidence={
            "matched_on": matched_on,
            "other_invoice_id": past.id,
            "other_invoice_number": past.invoice_number,
            "other_invoice_date": past.invoice_date.isoformat() if past.invoice_date else None,
            "other_amount": str(past.amount) if past.amount is not None else None,
        },
    )


def lookalike_domain(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """
    The sender's domain is a near-miss of the vendor's own.

    Distance 0 is the real domain and 3 or more is simply a different company;
    it is the one- and two-character variants that are built to be misread.
    """
    vendor = ctx.vendor
    if vendor is None:
        return None

    sender = _domain(fields.get("sender_email"))
    known = _domain(getattr(vendor, "email_domain", None))
    if not sender or not known or sender == known:
        return None

    distance = Levenshtein.distance(known, sender)
    if not (K.LOOKALIKE_MIN_DISTANCE <= distance <= K.LOOKALIKE_MAX_DISTANCE):
        return None

    return Flag(
        code="lookalike_domain",
        title="Lookalike email domain",
        message=(
            f"The sender's domain is {distance} character"
            f"{'' if distance == 1 else 's'} away from the domain on record for "
            f"{vendor.name}, which is how impersonation usually arrives."
        ),
        points=K.POINTS_LOOKALIKE_DOMAIN,
        evidence={
            "on_record": known,
            "on_invoice": sender,
            "edit_distance": distance,
            "differing_characters": _differing_characters(known, sender),
        },
    )


def gstin_invalid_or_mismatched(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """The tax identifier is malformed, or belongs to somebody else."""
    # str() first: extraction normally hands over a string or None, but a
    # corrected field could arrive as a number and a rule must not crash on it.
    raw = fields.get("gstin")
    gstin = str(raw).strip().upper() if raw is not None else ""
    if not gstin:
        return None

    if not is_valid_gstin(gstin):
        return Flag(
            code="gstin_invalid_or_mismatched",
            title="GSTIN invalid",
            message="The GSTIN on this invoice is not a validly formatted tax identifier.",
            points=K.POINTS_GSTIN_INVALID_OR_MISMATCHED,
            evidence={"on_invoice": gstin, "on_record": None, "reason": "format"},
        )

    vendor = ctx.vendor
    stored = getattr(vendor, "gstin", None) if vendor else None
    on_record = str(stored).strip().upper() if stored else ""
    if on_record and on_record != gstin:
        return Flag(
            code="gstin_invalid_or_mismatched",
            title="GSTIN does not match the vendor",
            message=(
                f"The GSTIN on this invoice is not the one recorded against {vendor.name}."
            ),
            points=K.POINTS_GSTIN_INVALID_OR_MISMATCHED,
            evidence={"on_invoice": gstin, "on_record": on_record, "reason": "mismatch"},
        )

    return None


def abnormal_amount(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """
    The total is well outside what this vendor normally bills.

    Needs a real history to mean anything: with only a handful of past invoices
    an "average" is noise, so below ABNORMAL_AMOUNT_MIN_HISTORY the rule is
    skipped entirely rather than firing on thin evidence.
    """
    amount = _decimal(fields.get("amount"))
    if amount is None or amount <= 0 or ctx.vendor is None:
        return None

    history = [
        p.amount
        for p in ctx.vendor_invoices
        if p.id != ctx.current_invoice_id and p.amount is not None and p.amount > 0
    ]
    if len(history) < K.ABNORMAL_AMOUNT_MIN_HISTORY:
        return None

    count = len(history)
    average = sum(history) / count
    if average <= 0:
        return None

    deviation_pct = (amount - average) / average * Decimal(100)

    # Population standard deviation over the vendor's own past invoices.
    variance = sum((value - average) ** 2 for value in history) / count
    std_dev = Decimal(str(math.sqrt(float(variance))))
    sigmas = (amount - average) / std_dev if std_dev > 0 else None

    beyond_sigma = sigmas is not None and sigmas > K.ABNORMAL_AMOUNT_SIGMA
    above_threshold = deviation_pct > K.ABNORMAL_AMOUNT_PCT_THRESHOLD

    if not above_threshold and not beyond_sigma:
        return None

    if beyond_sigma or deviation_pct >= K.ABNORMAL_AMOUNT_PCT_MAX:
        points = K.POINTS_ABNORMAL_AMOUNT_MAX
    else:
        # Graduated between the two anchors; see risk_constants for why.
        raw = K.POINTS_ABNORMAL_AMOUNT_MIN + (
            (deviation_pct - K.ABNORMAL_AMOUNT_PCT_THRESHOLD) / K.ABNORMAL_AMOUNT_PCT_PER_POINT
        )
        points = int(min(Decimal(K.POINTS_ABNORMAL_AMOUNT_MAX), raw))

    return Flag(
        code="abnormal_amount",
        title="Amount above vendor average",
        message=(
            f"At {deviation_pct.quantize(Decimal('1'))}% above this vendor's average "
            "invoice, the total is outside their usual range."
        ),
        points=points,
        evidence={
            "amount": str(amount),
            "vendor_average": str(average.quantize(Decimal("0.01"))),
            "percent_above_average": str(deviation_pct.quantize(Decimal("0.1"))),
            "standard_deviations_above": str(sigmas.quantize(Decimal("0.01"))) if sigmas is not None else None,
            "sample_size": count,
        },
    )


def totals_mismatch(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """
    The tax line does not reconcile against the total.

    The GST shown is checked against every standard rate applied to the
    net amount; if none of them lands within the rounding tolerance, the
    arithmetic on the document does not add up.
    """
    amount = _decimal(fields.get("amount"))
    gst = _decimal(fields.get("gst_amount"))
    if amount is None or gst is None or amount <= 0 or gst < 0:
        return None

    net = amount - gst
    if net <= 0:
        return Flag(
            code="totals_mismatch",
            title="Totals do not reconcile",
            message="The GST shown is not less than the invoice total, so the figures do not add up.",
            points=K.POINTS_TOTALS_MISMATCH,
            evidence={
                "amount": str(amount),
                "gst_amount": str(gst),
                "implied_net": str(net),
                "expected_for_standard_rates": [],
            },
        )

    expected = [(rate, (net * rate).quantize(Decimal("0.01"))) for rate in K.GST_RATES]
    if any(abs(gst - value) <= K.TOTALS_TOLERANCE for _, value in expected):
        return None

    return Flag(
        code="totals_mismatch",
        title="Totals do not reconcile",
        message=(
            "The GST on this invoice does not match any standard rate applied to the "
            "net amount, so the figures do not add up."
        ),
        points=K.POINTS_TOTALS_MISMATCH,
        evidence={
            "amount": str(amount),
            "gst_amount": str(gst),
            "implied_net": str(net),
            "expected_for_standard_rates": [
                {"rate": f"{rate * 100:.0f}%", "gst_would_be": str(value)} for rate, value in expected
            ],
            "tolerance": str(K.TOTALS_TOLERANCE),
        },
    )


def new_vendor(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """Nobody on file matches, so there is no history to check this against."""
    if ctx.vendor is not None:
        return None

    return Flag(
        code="new_vendor",
        title="New vendor, no history",
        message=(
            "No vendor on file matches this invoice, so there is nothing to compare "
            "its bank details or amount against."
        ),
        points=K.POINTS_NEW_VENDOR,
        evidence={
            "vendor_name_on_invoice": fields.get("vendor_name"),
            "gstin_on_invoice": fields.get("gstin"),
            "sender_domain": _domain(fields.get("sender_email")),
        },
    )


def odd_timing(fields: dict[str, Any], ctx: RuleContext) -> Flag | None:
    """Dated on a weekend, or due almost immediately — both skip normal scrutiny."""
    invoice_date = _date(fields.get("invoice_date"))
    if invoice_date is None:
        return None

    due_date = _date(fields.get("due_date"))
    reasons: list[str] = []

    # Monday is 0, so 5 and 6 are Saturday and Sunday.
    weekend = invoice_date.weekday() >= 5
    if weekend:
        reasons.append("the invoice is dated on a weekend")

    days_to_due = (due_date - invoice_date).days if due_date else None
    if days_to_due is not None and days_to_due < K.ODD_TIMING_MIN_DUE_DAYS:
        reasons.append(f"it falls due {days_to_due} day{'' if days_to_due == 1 else 's'} after being issued")

    if not reasons:
        return None

    return Flag(
        code="odd_timing",
        title="Unusual timing",
        message=f"Timing is unusual: {' and '.join(reasons)}.",
        points=K.POINTS_ODD_TIMING,
        evidence={
            "invoice_date": invoice_date.isoformat(),
            "due_date": due_date.isoformat() if due_date else None,
            "invoice_day_of_week": invoice_date.strftime("%A"),
            "days_until_due": days_to_due,
            "weekend": weekend,
        },
    )


# Evaluated in this order; the final list is sorted by points in scoring.py.
ALL_RULES: tuple[Callable[[dict[str, Any], RuleContext], Flag | None], ...] = (
    bank_account_changed,
    duplicate_invoice,
    lookalike_domain,
    gstin_invalid_or_mismatched,
    abnormal_amount,
    totals_mismatch,
    new_vendor,
    odd_timing,
)


def run_rules(fields: dict[str, Any], ctx: RuleContext) -> list[Flag]:
    """
    Run every rule. A rule that raises is treated as not firing.

    The guard is a backstop, not a licence: each rule handles its own missing
    data. But a crash in one rule must never cost the reviewer the other seven.
    """
    flags: list[Flag] = []
    for rule in ALL_RULES:
        try:
            result = rule(fields, ctx)
        except Exception:  # noqa: BLE001 - a broken rule must not break scoring
            import logging

            logging.getLogger(__name__).exception("Risk rule %s failed", rule.__name__)
            continue
        if result is not None:
            flags.append(result)
    return flags
