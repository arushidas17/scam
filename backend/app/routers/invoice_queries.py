"""
Invoice list, detail and decision.

Kept apart from the upload router so the read/decide side and the
ingest side can be read independently.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.lib_mask import mask_account
from app.models import AuditLog, Invoice, RiskFlag, User, Vendor, VendorBankHistory
from app.schemas.common import AuditEntry, FlagRead, RecommendationRead, VendorSummary
from app.schemas.invoice import (
    DecisionRequest,
    DecisionResponse,
    InvoiceDetail,
    InvoiceListItem,
    InvoiceListResponse,
    StatusCounts,
)
from app.services import storage

router = APIRouter(prefix="/invoices", tags=["invoices"])

# Sorting is chosen from this map, never built from the query string: letting a
# caller name a column would be an injection surface and would expose internals.
SORT_COLUMNS = {
    "invoice_date": Invoice.invoice_date,
    "amount": Invoice.amount,
    "risk_score": Invoice.risk_score,
    "vendor": Invoice.vendor_name,
}
DEFAULT_PAGE_SIZE = 15
MAX_PAGE_SIZE = 100

# The queue a reviewer works through, and its order.
QUEUE_STATUSES = ("needs_review", "suspicious")

DECISION_ACTIONS = {"approve": "approved", "reject": "rejected", "escalate": "escalated"}


def _list_item(row: Any) -> InvoiceListItem:
    # vendor_name holds the name as printed on the document, which is absent on
    # rows created before extraction existed. Falling back to the matched
    # vendor's own name means the UI always has something to show.
    name = row.vendor_name or (row.vendor.name if row.vendor else None)
    return InvoiceListItem(
        id=row.id,
        vendor_id=row.vendor_id,
        vendor_name=name,
        invoice_number=row.invoice_number,
        invoice_date=row.invoice_date,
        due_date=row.due_date,
        amount=str(row.amount),
        currency=row.currency,
        risk_score=row.risk_score,
        status=row.status,
        decision=row.decision,
        top_flag_title=getattr(row, "top_flag_title", None),
        bank_account_masked=mask_account(row.bank_account),
        created_at=row.created_at,
    )


@router.get("", response_model=InvoiceListResponse, summary="Search, filter and page the invoices")
def list_invoices(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    status_filter: str | None = Query(
        None, alias="status", description="normal, needs_review or suspicious"
    ),
    search: str | None = Query(None, description="Matches vendor name or invoice number"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    sort: Literal["invoice_date", "amount", "risk_score", "vendor"] = "invoice_date",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> InvoiceListResponse:
    if status_filter is not None and status_filter not in ("normal", "needs_review", "suspicious"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="status must be one of: normal, needs_review, suspicious.",
        )
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )

    # Filters that apply to the tab counts as well as the rows.
    conditions = []
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            or_(Invoice.vendor_name.ilike(term), Invoice.invoice_number.ilike(term))
        )
    if date_from:
        conditions.append(Invoice.invoice_date >= date_from)
    if date_to:
        conditions.append(Invoice.invoice_date <= date_to)

    base = and_(*conditions) if conditions else text("TRUE")

    # Counts are taken before the status filter, so the tabs stay stable while
    # the user clicks between them.
    counts_row = db.execute(
        select(
            func.count().label("all"),
            func.count().filter(Invoice.status == "normal").label("normal"),
            func.count().filter(Invoice.status == "needs_review").label("needs_review"),
            func.count().filter(Invoice.status == "suspicious").label("suspicious"),
        ).where(base)
    ).one()

    row_conditions = list(conditions)
    if status_filter:
        row_conditions.append(Invoice.status == status_filter)
    where = and_(*row_conditions) if row_conditions else text("TRUE")

    totals = db.execute(
        select(
            func.count().label("total"),
            func.coalesce(func.sum(Invoice.amount), 0).label("total_value"),
        ).where(where)
    ).one()
    total = totals.total
    pages = max(1, (total + page_size - 1) // page_size)
    safe_page = min(page, pages)

    column = SORT_COLUMNS[sort]
    direction = column.asc() if order == "asc" else column.desc()

    rows = db.execute(
        select(Invoice)
        .options(selectinload(Invoice.vendor))
        .where(where)
        # NULLS LAST so unscored invoices do not crowd the top of a risk sort.
        # Invoice.id is the final tie-break: seeded rows share both an
        # invoice_date and a created_at, and without a unique key Postgres is
        # free to order ties differently per query, which lets the same row
        # appear on two pages.
        .order_by(direction.nullslast(), Invoice.created_at.desc(), Invoice.id)
        .offset((safe_page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    # One extra query for the top flag of the rows on this page.
    titles: dict[uuid.UUID, str] = {}
    if rows:
        flag_rows = db.execute(
            text(
                """
                SELECT DISTINCT ON (invoice_id) invoice_id, title
                FROM risk_flags
                WHERE invoice_id = ANY(:ids)
                ORDER BY invoice_id, points DESC, code
                """
            ),
            {"ids": [r.id for r in rows]},
        ).all()
        titles = {r.invoice_id: r.title for r in flag_rows}

    items = []
    for row in rows:
        item = _list_item(row)
        item.top_flag_title = titles.get(row.id)
        items.append(item)

    return InvoiceListResponse(
        rows=items,
        total=total,
        total_value=str(totals.total_value),
        page=safe_page,
        page_size=page_size,
        pages=pages,
        counts=StatusCounts(
            all=counts_row.all,
            normal=counts_row.normal,
            needs_review=counts_row.needs_review,
            suspicious=counts_row.suspicious,
        ),
    )


def _queue_neighbours(db: Session, invoice: Invoice) -> tuple[uuid.UUID | None, uuid.UUID | None, int | None, int]:
    """
    Where this invoice sits in the review queue.

    The queue is every undecided flagged invoice, riskiest first — the order a
    reviewer actually works through.
    """
    queue = db.execute(
        select(Invoice.id)
        .where(Invoice.status.in_(QUEUE_STATUSES), Invoice.decision == "pending")
        .order_by(Invoice.risk_score.desc().nullslast(), Invoice.created_at.desc())
    ).scalars().all()

    total = len(queue)
    if invoice.id not in queue:
        return None, None, None, total

    index = queue.index(invoice.id)
    previous_id = queue[index - 1] if index > 0 else None
    next_id = queue[index + 1] if index < total - 1 else None
    return previous_id, next_id, index + 1, total


def _timeline(db: Session, invoice_id: uuid.UUID) -> list[AuditEntry]:
    rows = db.execute(
        select(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .where(AuditLog.invoice_id == invoice_id)
        .order_by(AuditLog.created_at.asc())
    ).all()
    return [
        AuditEntry(
            id=entry.id,
            action=entry.action,
            note=entry.note,
            user_name=who.name if who else None,
            user_email=who.email if who else None,
            created_at=entry.created_at,
        )
        for entry, who in rows
    ]


@router.get("/{invoice_id}", response_model=InvoiceDetail, summary="One invoice, in full")
def get_invoice_detail(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> InvoiceDetail:
    invoice = db.execute(
        select(Invoice)
        .options(selectinload(Invoice.risk_flags), selectinload(Invoice.vendor))
        .where(Invoice.id == invoice_id)
    ).scalar_one_or_none()

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That invoice could not be found."
        )

    analysis = (invoice.raw_extraction or {}).get("analysis") or {}
    match = analysis.get("vendor_match") or {}
    recommendation = analysis.get("recommendation")

    vendor = invoice.vendor
    vendor_summary = VendorSummary(
        id=vendor.id if vendor else None,
        name=vendor.name if vendor else invoice.vendor_name,
        gstin=vendor.gstin if vendor else None,
        email_domain=vendor.email_domain if vendor else None,
        is_trusted=vendor.is_trusted if vendor else None,
        match_method=match.get("method"),
        match_confidence=match.get("confidence"),
    )

    previous_id, next_id, position, queue_total = _queue_neighbours(db, invoice)

    return InvoiceDetail(
        id=invoice.id,
        vendor_id=invoice.vendor_id,
        vendor_name=invoice.vendor_name or (vendor.name if vendor else None),
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        amount=str(invoice.amount),
        gst_amount=str(invoice.gst_amount) if invoice.gst_amount is not None else None,
        gstin=invoice.gstin,
        # Unmasked here, and only here: the comparison is the whole job.
        bank_account=invoice.bank_account,
        ifsc=invoice.ifsc,
        sender_email=invoice.sender_email,
        currency=invoice.currency,
        risk_score=invoice.risk_score,
        status=invoice.status,
        decision=invoice.decision,
        created_at=invoice.created_at,
        flags=[
            FlagRead(
                code=f.code, title=f.title, message=f.message, points=f.points,
                evidence=f.evidence or {},
            )
            for f in sorted(invoice.risk_flags, key=lambda f: (-f.points, f.code))
        ],
        recommendation=RecommendationRead(**recommendation) if recommendation else None,
        vendor=vendor_summary,
        vendor_bank_account=vendor.bank_account if vendor else None,
        vendor_ifsc=vendor.ifsc if vendor else None,
        # Signed fresh on every read, so a stale link is never handed out.
        document_url=storage.signed_url(invoice.storage_path) if invoice.storage_path else None,
        timeline=_timeline(db, invoice.id),
        previous_invoice_id=previous_id,
        next_invoice_id=next_id,
        queue_position=position,
        queue_total=queue_total,
    )


@router.post(
    "/{invoice_id}/decision",
    response_model=DecisionResponse,
    summary="Approve, reject or escalate an invoice",
)
def decide_invoice(
    invoice_id: uuid.UUID,
    payload: DecisionRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> DecisionResponse:
    invoice = db.execute(
        select(Invoice).options(selectinload(Invoice.risk_flags)).where(Invoice.id == invoice_id)
    ).scalar_one_or_none()

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That invoice could not be found."
        )

    # A decision is a record of what a person decided; overwriting one would
    # erase that, so it is refused rather than silently replaced.
    if invoice.decision != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This invoice was already {invoice.decision}. A decision cannot be changed.",
        )

    note = (payload.note or "").strip()
    if payload.action in ("reject", "escalate") and not note:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"A note is required when you {payload.action} an invoice.",
        )

    # The control that actually stops the fraud: you cannot wave through an
    # invoice we flagged as suspicious without confirming you checked it.
    if payload.action == "approve" and invoice.status == "suspicious" and not payload.verified:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "This invoice is marked suspicious. Confirm you have verified the bank "
                "details with the vendor by phone before approving."
            ),
        )

    vendor_bank_updated = False
    bank_flag = next((f for f in invoice.risk_flags if f.code == "bank_account_changed"), None)

    # Everything below lands in one transaction: an invoice marked approved with
    # no audit row, or a vendor whose account moved with no history entry, would
    # each be worse than the whole thing failing.
    invoice.decision = DECISION_ACTIONS[payload.action]

    audit = AuditLog(
        invoice_id=invoice.id,
        user_id=user.id,
        action=f"invoice_{DECISION_ACTIONS[payload.action]}",
        note=note or None,
    )
    db.add(audit)

    if payload.action == "approve" and bank_flag is not None and invoice.vendor_id:
        vendor = db.get(Vendor, invoice.vendor_id)
        if vendor is not None and invoice.bank_account and vendor.bank_account != invoice.bank_account:
            # Approving a bank-account change is confirming it, so the vendor
            # record follows and the history records who confirmed it.
            db.add(
                VendorBankHistory(
                    vendor_id=vendor.id,
                    old_account=vendor.bank_account,
                    new_account=invoice.bank_account,
                    old_ifsc=vendor.ifsc,
                    new_ifsc=invoice.ifsc,
                    changed_on=datetime.now(timezone.utc).date(),
                    verified=True,
                )
            )
            vendor.bank_account = invoice.bank_account
            if invoice.ifsc:
                vendor.ifsc = invoice.ifsc
            vendor_bank_updated = True
            db.add(
                AuditLog(
                    invoice_id=invoice.id,
                    user_id=user.id,
                    action="vendor_bank_account_updated",
                    note=f"Approved change to the account ending {invoice.bank_account[-4:]}.",
                )
            )

    db.commit()
    db.refresh(invoice)
    db.refresh(audit)

    return DecisionResponse(
        invoice=_list_item(invoice),
        audit_entry=AuditEntry(
            id=audit.id,
            action=audit.action,
            note=audit.note,
            user_name=user.name,
            user_email=user.email,
            created_at=audit.created_at,
        ),
        vendor_bank_updated=vendor_bank_updated,
    )
