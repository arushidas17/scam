import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import created_at_column, uuid_pk

# Kept as plain strings rather than a Postgres ENUM: adding a value later is a
# data change, not a migration that locks the table.
INVOICE_STATUSES = (
    "normal",
    "needs_review",
    "suspicious",
    # Uploaded and read, but not yet scored by the risk engine.
    "pending_review",
    # File kept, but the model could not produce usable fields.
    "extraction_failed",
)
INVOICE_DECISIONS = ("pending", "approved", "rejected", "escalated")


class Invoice(Base):
    """One received invoice, its extracted fields, and where it stands."""

    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint(
            "risk_score >= 0 AND risk_score <= 100", name="ck_invoices_risk_score_range"
        ),
        CheckConstraint(
            "status IN ('normal', 'needs_review', 'suspicious', "
            "'pending_review', 'extraction_failed')",
            name="ck_invoices_status",
        ),
        CheckConstraint(
            "decision IN ('pending', 'approved', 'rejected', 'escalated')",
            name="ck_invoices_decision",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()

    # Nullable: an invoice can arrive from a vendor we have never seen, and
    # that absence is itself a risk signal.
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # The vendor as printed on the document, kept before any matching happens.
    vendor_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    gst_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(34), nullable=True)
    ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    sender_email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)

    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    field_confidence: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Whatever the extractor returned, kept verbatim so a scoring change can be
    # replayed against the original read.
    raw_extraction: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    risk_score: Mapped[int | None] = mapped_column(nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="normal", index=True
    )
    decision: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending", index=True
    )
    created_at: Mapped[datetime] = created_at_column()

    vendor: Mapped["Vendor | None"] = relationship(back_populates="invoices")  # noqa: F821
    risk_flags: Mapped[list["RiskFlag"]] = relationship(  # noqa: F821
        back_populates="invoice", cascade="all, delete-orphan"
    )
    audit_entries: Mapped[list["AuditLog"]] = relationship(  # noqa: F821
        back_populates="invoice", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number} {self.status}>"
