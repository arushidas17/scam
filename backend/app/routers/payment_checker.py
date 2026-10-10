"""
The payment-request checker.

A pasted email is turned into the same flat field dict an extracted invoice
produces, then put through the *same* rule functions and the *same* scorer. The
only addition is urgency_language, which has no meaning for an uploaded
document. Nothing about scoring is reimplemented here.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.lib_mask import mask_account
from app.models import Vendor, VendorBankHistory
from app.schemas.checker import CheckerRequest, CheckerResponse, PhraseHighlight
from app.schemas.common import FlagRead, RecommendationRead, VendorSummary
from rapidfuzz.distance import Levenshtein

from app.services.checker_rules import find_phrases, urgency_language
from app.services.explain import explain
from app.services.risk_rules import (
    BankChange,
    RuleContext,
    bank_account_changed,
    lookalike_domain,
    new_vendor,
)
from app.services.scoring import score_flags
from app.services.vendor_match import match_vendor

router = APIRouter(prefix="/payment-checker", tags=["payment-checker"])

# The invoice rules that still make sense without an invoice. Everything
# dropped here needs a document: an amount to compare, a number to duplicate,
# dates to find odd.
APPLICABLE_RULES = (bank_account_changed, lookalike_domain, new_vendor, urgency_language)

ACCOUNT_RE = re.compile(r"\b\d[\d\s-]{8,22}\d\b")
IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

BANK_CHANGE_HINTS = (
    "new account", "new bank", "updated bank", "updated account", "changed our bank",
    "change our bank", "bank details", "account details", "beneficiary", "remit to",
    "kindly update", "update our records",
)
PAYMENT_HINTS = ("invoice", "payment", "remit", "transfer", "pay ", "outstanding", "due")


def _domain_of(email: str) -> str | None:
    match = re.search(r"@([^\s>]+)$", (email or "").strip().lower())
    return match.group(1) if match else None


def _first_account(text: str) -> str | None:
    for match in ACCOUNT_RE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if len(digits) >= 9:
            return digits
    return None


def _request_type(text: str, account: str | None, ifsc: str | None) -> str:
    lowered = text.lower()
    if account or ifsc or any(hint in lowered for hint in BANK_CHANGE_HINTS):
        return "bank_change"
    if any(hint in lowered for hint in PAYMENT_HINTS):
        return "payment_request"
    return "other"


@router.post("/analyse", response_model=CheckerResponse, summary="Check a pasted payment request")
def analyse_request(
    payload: CheckerRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> CheckerResponse:
    sender = (payload.from_email or "").strip()
    body = (payload.body or "").strip()

    if not sender or not body:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Both the sender address and the message body are required.",
        )

    subject = (payload.subject or "").strip()
    # Offsets are returned against this exact string, so the front end can
    # highlight without having to rebuild it the same way.
    text = f"{subject}\n{body}" if subject else body

    sender_domain = _domain_of(sender)
    account = _first_account(text)
    ifsc_match = IFSC_RE.search(text.upper())
    ifsc = ifsc_match.group(0) if ifsc_match else None

    # The message, shaped like an invoice so the existing rules apply unchanged.
    fields = {
        "vendor_name": None,
        "sender_email": sender,
        "bank_account": account,
        "ifsc": ifsc,
        "gstin": None,
        "amount": None,
        "message_text": text,
    }

    # A name mentioned in the text is a weaker signal than a domain, but it is
    # how an unknown-domain impersonation still names who it is pretending to be.
    vendors = db.query(Vendor).all()
    lowered = text.lower()
    named = next((v for v in vendors if v.name and v.name.lower() in lowered), None)
    if named is not None:
        fields["vendor_name"] = named.name

    matched = match_vendor(fields, db, vendors=vendors)
    vendor = matched.vendor or named

    # A lookalike domain is, by definition, one that matches no vendor. Without
    # this step the endpoint could never raise lookalike_domain at all: the rule
    # needs to know *who* is being impersonated before it can compare domains.
    if vendor is None and sender_domain:
        near = [
            (Levenshtein.distance((v.email_domain or "").lower(), sender_domain), v)
            for v in vendors
            if v.email_domain and v.email_domain.lower() != sender_domain
        ]
        near = [(d, v) for d, v in near if 1 <= d <= 2]
        if near:
            near.sort(key=lambda pair: pair[0])
            vendor = near[0][1]

    bank_changes = []
    if vendor is not None:
        bank_changes = [
            BankChange(changed_on=h.changed_on, verified=h.verified)
            for h in db.query(VendorBankHistory)
            .filter(VendorBankHistory.vendor_id == vendor.id)
            .order_by(VendorBankHistory.changed_on.desc())
            .all()
        ]

    ctx = RuleContext(vendor=vendor, bank_changes=bank_changes)

    # The same functions the invoice pipeline uses, and the same scorer.
    flags = []
    for rule in APPLICABLE_RULES:
        try:
            result = rule(fields, ctx)
        except Exception:  # noqa: BLE001 - a broken rule must not lose the others
            continue
        if result is not None:
            flags.append(result)

    score = score_flags(flags)

    explanation = explain(
        score.flags,
        vendor_name=vendor.name if vendor else None,
        amount=None,
    )

    highlights = [PhraseHighlight(**hit) for hit in find_phrases(text)]

    return CheckerResponse(
        risk_score=score.score,
        status=score.status,
        request_type=_request_type(text, account, ifsc),
        sender_domain=sender_domain,
        vendor=(
            VendorSummary(
                id=vendor.id,
                name=vendor.name,
                gstin=vendor.gstin,
                email_domain=vendor.email_domain,
                is_trusted=vendor.is_trusted,
                match_method=matched.method,
                match_confidence=matched.confidence,
            )
            if vendor is not None
            else None
        ),
        # Masked: there is no digit-by-digit comparison to do on this screen.
        extracted_account=mask_account(account) if account else None,
        extracted_ifsc=ifsc,
        flags=[
            FlagRead(
                code=f.code, title=f.title, message=f.message, points=f.points,
                evidence=f.evidence or {},
            )
            for f in score.flags
        ],
        recommendation=RecommendationRead(**explanation.as_dict()),
        highlights=highlights,
        text=text,
    )
