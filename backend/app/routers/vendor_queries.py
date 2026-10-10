"""Vendor list, profile and the trusted toggle."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.lib_mask import mask_account
from app.models import AuditLog, Invoice, Vendor, VendorBankHistory
from app.schemas.common import AuditEntry, MaskedBank
from app.schemas.vendor_detail import (
    BankChangeEntry,
    TrendPoint,
    TrustResponse,
    TrustUpdate,
    VendorDetail,
    VendorListItem,
    VendorListResponse,
    VendorStats,
)

router = APIRouter(prefix="/vendors", tags=["vendors"])

RECENT_BANK_CHANGE_DAYS = 30
NEW_VENDOR_DAYS = 60
# Away from the vendor's own average by this much to count as an outlier.
OUTLIER_RATIO = Decimal("0.35")

SORT_COLUMNS = {
    "name": "v.name",
    "invoice_count": "invoice_count",
    "average_amount": "average_amount",
    "last_invoice_date": "last_invoice_date",
    "flagged_count": "flagged_count",
}
DEFAULT_PAGE_SIZE = 15
MAX_PAGE_SIZE = 100

# One statement builds every per-vendor figure the list shows. Doing this in
# Python would mean a query per vendor, per column.
_VENDOR_ROLLUP = """
SELECT v.id, v.name, v.gstin, v.email_domain, v.is_trusted, v.created_at,
       COALESCE(i.invoice_count, 0)                  AS invoice_count,
       COALESCE(i.average_amount, 0)                 AS average_amount,
       i.last_invoice_date                           AS last_invoice_date,
       COALESCE(i.flagged_count, 0)                  AS flagged_count,
       b.last_change_on                              AS last_bank_change_on
FROM vendors v
LEFT JOIN (
    SELECT vendor_id,
           COUNT(*)                                               AS invoice_count,
           AVG(amount)                                            AS average_amount,
           MAX(invoice_date)                                      AS last_invoice_date,
           COUNT(*) FILTER (WHERE status IN ('needs_review','suspicious')) AS flagged_count
    FROM invoices
    WHERE vendor_id IS NOT NULL
    GROUP BY vendor_id
) i ON i.vendor_id = v.id
LEFT JOIN (
    SELECT vendor_id, MAX(changed_on) AS last_change_on
    FROM vendor_bank_history GROUP BY vendor_id
) b ON b.vendor_id = v.id
"""


def _matches_filter(row, which: str, today: date) -> bool:
    if which == "trusted":
        return bool(row.is_trusted)
    if which == "flagged":
        return row.flagged_count > 0
    if which == "new":
        first_seen = row.created_at.date() if isinstance(row.created_at, datetime) else row.created_at
        return row.invoice_count <= 1 or (today - first_seen).days <= NEW_VENDOR_DAYS
    return True


@router.get("", response_model=VendorListResponse, summary="Search and filter the vendors")
def list_vendors(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    search: str | None = Query(None, description="Matches name, domain or GSTIN"),
    filter_: Literal["all", "trusted", "new", "flagged"] = Query("all", alias="filter"),
    sort: Literal["name", "invoice_count", "average_amount", "last_invoice_date", "flagged_count"] = "name",
    order: Literal["asc", "desc"] = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> VendorListResponse:
    params: dict[str, object] = {}
    where = ""
    if search and search.strip():
        where = " WHERE (v.name ILIKE :term OR v.email_domain ILIKE :term OR v.gstin ILIKE :term)"
        params["term"] = f"%{search.strip()}%"

    # Sorting is chosen from a fixed map, never interpolated from user input.
    column = SORT_COLUMNS[sort]
    direction = "ASC" if order == "asc" else "DESC"
    sql = f"{_VENDOR_ROLLUP}{where} ORDER BY {column} {direction} NULLS LAST, v.name ASC"

    rows = db.execute(text(sql), params).all()
    today = datetime.now(timezone.utc).date()

    counts = {
        key: sum(1 for r in rows if _matches_filter(r, key, today))
        for key in ("all", "trusted", "new", "flagged")
    }

    selected = [r for r in rows if _matches_filter(r, filter_, today)]
    total = len(selected)
    pages = max(1, (total + page_size - 1) // page_size)
    safe_page = min(page, pages)
    window = selected[(safe_page - 1) * page_size : safe_page * page_size]

    recent_cutoff = today - timedelta(days=RECENT_BANK_CHANGE_DAYS)

    return VendorListResponse(
        rows=[
            VendorListItem(
                id=r.id,
                name=r.name,
                gstin=r.gstin,
                email_domain=r.email_domain,
                invoice_count=r.invoice_count,
                average_amount=str(Decimal(r.average_amount).quantize(Decimal("0.01"))),
                last_invoice_date=r.last_invoice_date,
                flagged_count=r.flagged_count,
                is_trusted=r.is_trusted,
                bank_changed_recently=bool(
                    r.last_bank_change_on and r.last_bank_change_on >= recent_cutoff
                ),
                last_bank_change_on=r.last_bank_change_on,
            )
            for r in window
        ],
        total=total,
        page=safe_page,
        page_size=page_size,
        pages=pages,
        counts=counts,
    )


@router.get("/{vendor_id}", response_model=VendorDetail, summary="One vendor, with history")
def get_vendor_detail(
    vendor_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> VendorDetail:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That vendor could not be found."
        )

    stats_row = db.execute(
        select(
            func.count().label("total_invoices"),
            func.coalesce(func.sum(Invoice.amount), 0).label("total_value"),
            func.coalesce(func.avg(Invoice.amount), 0).label("average_amount"),
            func.count().filter(Invoice.status.in_(("needs_review", "suspicious"))).label("flagged"),
        ).where(Invoice.vendor_id == vendor_id)
    ).one()

    average = Decimal(stats_row.average_amount).quantize(Decimal("0.01"))

    trend_rows = db.execute(
        select(
            Invoice.id, Invoice.invoice_number, Invoice.invoice_date,
            Invoice.amount, Invoice.risk_score, Invoice.status,
        )
        .where(Invoice.vendor_id == vendor_id)
        .order_by(Invoice.invoice_date.asc().nullslast(), Invoice.created_at.asc())
    ).all()

    trend = [
        TrendPoint(
            invoice_id=r.id,
            invoice_number=r.invoice_number,
            date=r.invoice_date,
            amount=str(r.amount),
            risk_score=r.risk_score,
            status=r.status,
            # Both conditions: far from average *and* flagged, so an outlier
            # marker in a risk colour always agrees with the invoice's status.
            outlier=bool(
                average > 0
                and abs(Decimal(r.amount) - average) / average > OUTLIER_RATIO
                and r.status != "normal"
            ),
        )
        for r in trend_rows
    ]

    history = db.execute(
        select(VendorBankHistory)
        .where(VendorBankHistory.vendor_id == vendor_id)
        .order_by(VendorBankHistory.changed_on.desc())
    ).scalars().all()

    return VendorDetail(
        id=vendor.id,
        name=vendor.name,
        gstin=vendor.gstin,
        email_domain=vendor.email_domain,
        is_trusted=vendor.is_trusted,
        first_seen=vendor.created_at,
        stats=VendorStats(
            total_invoices=stats_row.total_invoices,
            total_value=str(Decimal(stats_row.total_value).quantize(Decimal("0.01"))),
            average_amount=str(average),
            flagged_count=stats_row.flagged,
        ),
        trend=trend,
        trend_average=str(average),
        bank=MaskedBank.build(vendor.bank_account, vendor.ifsc),
        bank_history=[
            BankChangeEntry(
                id=h.id,
                old_account_masked=mask_account(h.old_account),
                new_account_masked=mask_account(h.new_account),
                old_ifsc=h.old_ifsc,
                new_ifsc=h.new_ifsc,
                changed_on=h.changed_on,
                verified=h.verified,
            )
            for h in history
        ],
    )


@router.patch("/{vendor_id}/trust", response_model=TrustResponse, summary="Set the trusted flag")
def set_vendor_trust(
    vendor_id: uuid.UUID,
    payload: TrustUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> TrustResponse:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That vendor could not be found."
        )

    vendor.is_trusted = payload.is_trusted
    # Trust is a judgement about who gets paid, so who changed it is recorded.
    audit = AuditLog(
        invoice_id=None,
        user_id=user.id,
        action="vendor_trusted" if payload.is_trusted else "vendor_untrusted",
        note=(payload.note or "").strip() or f"{vendor.name} marked "
        f"{'trusted' if payload.is_trusted else 'not trusted'}.",
    )
    db.add(audit)
    db.commit()
    db.refresh(vendor)
    db.refresh(audit)

    return TrustResponse(
        id=vendor.id,
        name=vendor.name,
        is_trusted=vendor.is_trusted,
        audit_entry=AuditEntry(
            id=audit.id,
            action=audit.action,
            note=audit.note,
            user_name=user.name,
            user_email=user.email,
            created_at=audit.created_at,
        ),
    )
