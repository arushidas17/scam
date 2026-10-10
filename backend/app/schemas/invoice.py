import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AuditEntry, FlagRead, RecommendationRead, VendorSummary

# AnalysisResponse predates common.py; FlagRead is the same shape as the
# RiskFlagRead it used to declare, so it is aliased rather than duplicated.
RiskFlagRead = FlagRead


class ExtractedField(BaseModel):
    """One field the model read, with how sure it was."""

    name: str
    value: Any = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)


class DataWarning(BaseModel):
    """A data-quality concern. Not a fraud signal."""

    field: str
    code: str
    message: str


class VendorMatchRead(BaseModel):
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    # How the vendor was identified: gstin, name, email_domain, or none.
    method: str
    confidence: float
    ambiguous_between: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    invoice_id: uuid.UUID
    risk_score: int
    status: str
    flags: list[RiskFlagRead]
    points_before_cap: int
    capped: bool
    vendor_match: VendorMatchRead
    recommendation: RecommendationRead


class UploadResponse(BaseModel):
    invoice_id: uuid.UUID
    status: str
    decision: str
    fields: list[ExtractedField]
    warnings: list[DataWarning]
    document_url: str | None = None
    # Present once the risk engine has run, which upload does automatically.
    analysis: AnalysisResponse | None = None
    # Present only when extraction failed and the file was kept for a retry.
    error: str | None = None


class InvoiceFieldsUpdate(BaseModel):
    """
    The user's corrections from the review form.

    Every field is optional: the form submits only what changed. ``None`` is a
    meaningful value here (the user clearing a field the model got wrong), so
    callers must use ``exclude_unset`` to tell "not sent" from "set to null".
    """

    model_config = ConfigDict(extra="forbid")

    vendor_name: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    amount: str | float | int | None = None
    gst_amount: str | float | int | None = None
    gstin: str | None = None
    bank_account: str | None = None
    ifsc: str | None = None
    sender_email: str | None = None
    currency: str | None = None


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    invoice_number: str
    invoice_date: date | None = None
    due_date: date | None = None
    amount: Decimal
    gst_amount: Decimal | None = None
    gstin: str | None = None
    bank_account: str | None = None
    ifsc: str | None = None
    sender_email: str | None = None
    currency: str | None = None
    risk_score: int | None = None
    status: str
    decision: str
    created_at: datetime


class InvoiceUpdateResponse(BaseModel):
    invoice: InvoiceRead
    warnings: list[DataWarning]
    changed_fields: list[str]


# --- list --------------------------------------------------------------------
class InvoiceListItem(BaseModel):
    """A row in the invoice table. Bank details are masked here."""

    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    invoice_number: str
    invoice_date: date | None = None
    due_date: date | None = None
    amount: str
    currency: str | None = None
    risk_score: int | None = None
    status: str
    decision: str
    top_flag_title: str | None = None
    bank_account_masked: str
    created_at: datetime


class StatusCounts(BaseModel):
    all: int = 0
    normal: int = 0
    needs_review: int = 0
    suspicious: int = 0


class InvoiceListResponse(BaseModel):
    rows: list[InvoiceListItem]
    total: int
    # Summed amount of every row matching the filters, not just this page.
    total_value: str
    page: int
    page_size: int
    pages: int
    # Counts for every tab, so the front end needs no second call.
    counts: StatusCounts


# --- detail ------------------------------------------------------------------
class InvoiceDetail(BaseModel):
    """
    The full invoice.

    This is the one response that carries unmasked bank accounts: the reviewer's
    job on this page is to compare the account on the invoice with the one on
    record, digit by digit, and masking would make that impossible.
    """

    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    invoice_number: str
    invoice_date: date | None = None
    due_date: date | None = None
    amount: str
    gst_amount: str | None = None
    gstin: str | None = None
    bank_account: str | None = None
    ifsc: str | None = None
    sender_email: str | None = None
    currency: str | None = None
    risk_score: int | None = None
    status: str
    decision: str
    created_at: datetime

    flags: list["FlagRead"] = Field(default_factory=list)
    recommendation: "RecommendationRead | None" = None
    vendor: "VendorSummary | None" = None
    vendor_bank_account: str | None = None
    vendor_ifsc: str | None = None
    document_url: str | None = None
    timeline: list["AuditEntry"] = Field(default_factory=list)

    previous_invoice_id: uuid.UUID | None = None
    next_invoice_id: uuid.UUID | None = None
    queue_position: int | None = None
    queue_total: int | None = None


# --- decision ----------------------------------------------------------------
class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["approve", "reject", "escalate"]
    note: str | None = None
    # Required when approving something already marked suspicious.
    verified: bool = False


class DecisionResponse(BaseModel):
    invoice: InvoiceListItem
    audit_entry: "AuditEntry"
    # Set when approving confirmed a bank-account change on the vendor record.
    vendor_bank_updated: bool = False
