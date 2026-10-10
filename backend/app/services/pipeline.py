"""
The analysis pipeline: fields in, score and explanation out.

Order matters. The vendor is matched first because almost every rule compares
against the vendor's record; the rules then run; the score is arithmetic over
what they returned; and only then is the model asked to put it into words.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Invoice, RiskFlag, Vendor, VendorBankHistory
from app.services.explain import ExplanationResult, explain
from app.services.risk_rules import BankChange, Flag, PastInvoice, RuleContext, run_rules
from app.services.scoring import Score, score_flags
from app.services.vendor_match import VendorMatch, match_vendor

logger = logging.getLogger(__name__)

# Statuses that mean "this invoice never completed extraction", which the
# averages and duplicate checks should not be comparing against.
EXCLUDED_FROM_HISTORY = ("extraction_failed",)


@dataclass(frozen=True)
class Analysis:
    invoice_id: uuid.UUID
    score: Score
    vendor_match: VendorMatch
    explanation: ExplanationResult

    def as_dict(self) -> dict[str, Any]:
        return {
            "invoice_id": str(self.invoice_id),
            **self.score.as_dict(),
            "vendor_match": self.vendor_match.as_dict(),
            "recommendation": self.explanation.as_dict(),
        }


def fields_from_invoice(invoice: Invoice) -> dict[str, Any]:
    """The stored invoice as the flat field dict the rules expect."""
    return {
        "vendor_name": invoice.vendor_name,
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "amount": invoice.amount,
        "gst_amount": invoice.gst_amount,
        "gstin": invoice.gstin,
        "bank_account": invoice.bank_account,
        "ifsc": invoice.ifsc,
        "sender_email": invoice.sender_email,
        "currency": invoice.currency,
    }


def build_context(db: Session, vendor: Vendor | None, current_invoice_id: str | None) -> RuleContext:
    """Gather the vendor's history once, so the rules stay pure functions."""
    if vendor is None:
        return RuleContext(vendor=None, current_invoice_id=current_invoice_id)

    past = db.execute(
        select(Invoice.id, Invoice.invoice_number, Invoice.invoice_date, Invoice.amount)
        .where(
            Invoice.vendor_id == vendor.id,
            Invoice.status.not_in(EXCLUDED_FROM_HISTORY),
        )
    ).all()

    changes = db.scalars(
        select(VendorBankHistory)
        .where(VendorBankHistory.vendor_id == vendor.id)
        .order_by(VendorBankHistory.changed_on.desc())
    ).all()

    return RuleContext(
        vendor=vendor,
        vendor_invoices=[
            PastInvoice(
                id=str(row.id),
                invoice_number=row.invoice_number,
                invoice_date=row.invoice_date,
                amount=row.amount,
            )
            for row in past
        ],
        bank_changes=[BankChange(changed_on=c.changed_on, verified=c.verified) for c in changes],
        current_invoice_id=current_invoice_id,
    )


def analyse_fields(
    fields: dict[str, Any],
    db: Session,
    *,
    current_invoice_id: str | None = None,
    explain_client: Any | None = None,
) -> tuple[Score, VendorMatch, ExplanationResult]:
    """Match, run the rules, score, then explain. No database writes."""
    matched = match_vendor(fields, db)
    context = build_context(db, matched.vendor, current_invoice_id)

    flags: list[Flag] = run_rules(fields, context)
    score = score_flags(flags)

    explanation = explain(
        score.flags,
        vendor_name=matched.vendor.name if matched.vendor else fields.get("vendor_name"),
        amount=fields.get("amount"),
        client=explain_client,
    )

    return score, matched, explanation


def analyse_invoice(
    invoice_id: uuid.UUID | str,
    db: Session,
    *,
    explain_client: Any | None = None,
) -> Analysis:
    """
    Score a stored invoice and persist the result.

    The score, status, vendor link and flag rows are written in one transaction:
    a half-written analysis — a score with no flags to justify it — would be
    worse than none at all.
    """
    invoice = db.get(Invoice, invoice_id if isinstance(invoice_id, uuid.UUID) else uuid.UUID(str(invoice_id)))
    if invoice is None:
        raise LookupError(f"Invoice {invoice_id} could not be found.")

    fields = fields_from_invoice(invoice)
    score, matched, explanation = analyse_fields(
        fields, db, current_invoice_id=str(invoice.id), explain_client=explain_client
    )

    # Re-analysis replaces the previous findings rather than stacking on them.
    for existing in list(invoice.risk_flags):
        db.delete(existing)
    db.flush()

    for flag in score.flags:
        db.add(
            RiskFlag(
                invoice_id=invoice.id,
                code=flag.code,
                title=flag.title,
                message=flag.message,
                points=flag.points,
                evidence=flag.evidence,
            )
        )

    invoice.risk_score = score.score
    invoice.status = score.status
    if matched.vendor is not None:
        invoice.vendor_id = matched.vendor.id

    # The recommendation sits alongside the model's original read, not inside it.
    raw = dict(invoice.raw_extraction or {})
    raw["analysis"] = {
        "vendor_match": matched.as_dict(),
        "recommendation": explanation.as_dict(),
        "points_before_cap": score.raw_total,
    }
    invoice.raw_extraction = raw

    db.commit()
    db.refresh(invoice)

    return Analysis(
        invoice_id=invoice.id,
        score=score,
        vendor_match=matched,
        explanation=explanation,
    )
