"""
The dashboard.

Every figure is computed by the database. Loading rows into Python to count
them would mean shipping the whole invoice table over the wire to produce five
integers, and would get slower every week the product is used.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import Integer, String, cast, func, literal_column, select, text
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Invoice, RiskFlag
from app.schemas.common import DatedCount
from app.schemas.dashboard import DashboardStats, RecentAlert, TodayCounts, TopReason

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

FLAGGED_STATUSES = ("needs_review", "suspicious")
# The three bands an invoice ends up in once it has been scored. Invoices still
# mid-pipeline ("pending_review") or unreadable ("extraction_failed") are
# excluded, so the tiles always satisfy total = normal + needs_review +
# suspicious rather than showing a total that does not add up.
SCORED_STATUSES = ("normal", "needs_review", "suspicious")
CHART_DAYS = 14
REASON_WINDOW_DAYS = 30
RECENT_ALERT_LIMIT = 8


def _count_if(condition) -> Integer:
    """COUNT(*) FILTER (WHERE ...), which keeps all four counts in one scan."""
    return func.count().filter(condition)


@router.get("/stats", response_model=DashboardStats, summary="Figures for the dashboard")
def dashboard_stats(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> DashboardStats:
    today = datetime.now(timezone.utc).date()

    # --- today's counts, in one pass over one day's rows -----------------
    counts_row = db.execute(
        select(
            func.count().label("total"),
            _count_if(Invoice.status == "normal").label("normal"),
            _count_if(Invoice.status == "needs_review").label("needs_review"),
            _count_if(Invoice.status == "suspicious").label("suspicious"),
        ).where(
            cast(Invoice.created_at, String).like(f"{today.isoformat()}%"),
            Invoice.status.in_(SCORED_STATUSES),
        )
    ).one()

    # --- money at risk ---------------------------------------------------
    money_at_risk = db.execute(
        select(func.coalesce(func.sum(Invoice.amount), 0)).where(
            Invoice.decision == "pending",
            Invoice.status.in_(FLAGGED_STATUSES),
        )
    ).scalar_one()

    # --- 14-day series ---------------------------------------------------
    # generate_series gives a row per day so quiet days appear as zero rather
    # than dropping out of the chart.
    start = today - timedelta(days=CHART_DAYS - 1)
    series_sql = text(
        """
        SELECT d.day::date AS day,
               COALESCE(c.normal, 0)       AS normal,
               COALESCE(c.needs_review, 0) AS needs_review,
               COALESCE(c.suspicious, 0)   AS suspicious,
               COALESCE(c.total, 0)        AS total
        FROM generate_series(:start, :end, interval '1 day') AS d(day)
        LEFT JOIN (
            SELECT created_at::date AS day,
                   COUNT(*) FILTER (WHERE status = 'normal')       AS normal,
                   COUNT(*) FILTER (WHERE status = 'needs_review') AS needs_review,
                   COUNT(*) FILTER (WHERE status = 'suspicious')   AS suspicious,
                   COUNT(*)                                        AS total
            FROM invoices
            WHERE created_at >= :start AND created_at < (CAST(:end AS date) + 1)
              AND status IN ('normal', 'needs_review', 'suspicious')
            GROUP BY created_at::date
        ) AS c ON c.day = d.day::date
        ORDER BY d.day
        """
    )
    per_day = [
        DatedCount(
            day=row.day,
            normal=row.normal,
            needs_review=row.needs_review,
            suspicious=row.suspicious,
            total=row.total,
        )
        for row in db.execute(series_sql, {"start": start, "end": today}).all()
    ]

    # --- top risk reasons over the last 30 days --------------------------
    reason_window = today - timedelta(days=REASON_WINDOW_DAYS)
    reasons = db.execute(
        select(
            RiskFlag.code,
            func.min(RiskFlag.title).label("title"),
            func.count().label("count"),
        )
        .where(RiskFlag.created_at >= reason_window)
        .group_by(RiskFlag.code)
        .order_by(func.count().desc(), RiskFlag.code)
    ).all()

    # --- the eight highest-risk recent invoices --------------------------
    # The top flag per invoice comes from a lateral join, so one query answers
    # the whole panel rather than one extra query per row.
    alerts_sql = text(
        """
        SELECT i.id,
               -- vendor_name is the name as printed; fall back to the matched
               -- vendor so the panel always shows who the invoice is from.
               COALESCE(i.vendor_name, v.name) AS vendor_name,
               i.invoice_number, i.amount,
               i.risk_score, i.created_at, f.title AS top_flag_title
        FROM invoices i
        LEFT JOIN vendors v ON v.id = i.vendor_id
        LEFT JOIN LATERAL (
            SELECT title FROM risk_flags
            WHERE invoice_id = i.id
            ORDER BY points DESC, code
            LIMIT 1
        ) f ON TRUE
        WHERE i.status IN ('needs_review', 'suspicious')
        ORDER BY i.risk_score DESC NULLS LAST, i.created_at DESC
        LIMIT :limit
        """
    )
    alerts = [
        RecentAlert(
            id=row.id,
            vendor_name=row.vendor_name,
            invoice_number=row.invoice_number,
            amount=str(row.amount),
            risk_score=row.risk_score,
            top_flag_title=row.top_flag_title,
            created_at=row.created_at,
        )
        for row in db.execute(alerts_sql, {"limit": RECENT_ALERT_LIMIT}).all()
    ]

    return DashboardStats(
        today=TodayCounts(
            total=counts_row.total,
            normal=counts_row.normal,
            needs_review=counts_row.needs_review,
            suspicious=counts_row.suspicious,
        ),
        money_at_risk=str(Decimal(money_at_risk)),
        per_day=per_day,
        top_reasons=[TopReason(code=r.code, title=r.title, count=r.count) for r in reasons],
        recent_alerts=alerts,
    )
