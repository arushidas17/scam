from __future__ import annotations

import uuid
# `date` is aliased because TrendPoint has a field of that name, which would
# otherwise shadow the type inside the class body.
from datetime import date as Date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AuditEntry, MaskedBank


class VendorListItem(BaseModel):
    id: uuid.UUID
    name: str
    gstin: str
    email_domain: str
    invoice_count: int
    average_amount: str
    last_invoice_date: Date | None = None
    flagged_count: int
    is_trusted: bool
    bank_changed_recently: bool
    last_bank_change_on: Date | None = None


class VendorListResponse(BaseModel):
    rows: list[VendorListItem]
    total: int
    page: int
    page_size: int
    pages: int
    counts: dict[str, int] = Field(default_factory=dict)


class VendorStats(BaseModel):
    total_invoices: int
    total_value: str
    average_amount: str
    flagged_count: int


class TrendPoint(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str
    date: Date | None = None
    amount: str
    risk_score: int | None = None
    status: str
    # Well away from this vendor's average AND flagged: both, so a marker in a
    # risk colour never contradicts the invoice's own status.
    outlier: bool = False


class BankChangeEntry(BaseModel):
    id: uuid.UUID
    old_account_masked: str
    new_account_masked: str
    old_ifsc: str | None = None
    new_ifsc: str | None = None
    changed_on: Date
    verified: bool


class VendorDetail(BaseModel):
    id: uuid.UUID
    name: str
    gstin: str
    email_domain: str
    is_trusted: bool
    first_seen: datetime
    stats: VendorStats
    trend: list[TrendPoint] = Field(default_factory=list)
    trend_average: str
    # Masked, unlike invoice detail: there is no comparison to make here.
    bank: MaskedBank
    bank_history: list[BankChangeEntry] = Field(default_factory=list)


class TrustUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_trusted: bool
    note: str | None = None


class TrustResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_trusted: bool
    audit_entry: AuditEntry
