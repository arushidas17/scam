from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import DatedCount


class TodayCounts(BaseModel):
    total: int = 0
    normal: int = 0
    needs_review: int = 0
    suspicious: int = 0


class TopReason(BaseModel):
    code: str
    title: str
    count: int


class RecentAlert(BaseModel):
    id: uuid.UUID
    vendor_name: str | None = None
    invoice_number: str
    # A string, so no amount is ever rounded through a float.
    amount: str
    risk_score: int | None = None
    top_flag_title: str | None = None
    created_at: datetime


class DashboardStats(BaseModel):
    today: TodayCounts
    # Summed amount of pending invoices flagged needs_review or suspicious.
    money_at_risk: str
    per_day: list[DatedCount]
    top_reasons: list[TopReason]
    recent_alerts: list[RecentAlert]
