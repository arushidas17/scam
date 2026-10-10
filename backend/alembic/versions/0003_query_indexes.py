"""Indexes for the columns the new endpoints filter and sort on.

Revision ID: 0003_indexes
Revises: 0002_upload
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_indexes"
down_revision: str | None = "0002_upload"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # The dashboard counts "today" and builds a 14-day series off created_at,
    # and the invoice list sorts by it as a tie-break.
    op.create_index("ix_invoices_created_at", "invoices", ["created_at"])

    # The list endpoint filters by status and then orders within it; a composite
    # index serves both halves of that query from one structure.
    op.create_index("ix_invoices_status_created_at", "invoices", ["status", "created_at"])
    op.create_index("ix_invoices_status_risk_score", "invoices", ["status", "risk_score"])
    # "Pending and flagged" is the money-at-risk query.
    op.create_index("ix_invoices_decision_status", "invoices", ["decision", "status"])
    # Sorting by amount, and the vendor profile's per-vendor date ordering.
    op.create_index("ix_invoices_amount", "invoices", ["amount"])
    op.create_index("ix_invoices_vendor_id_invoice_date", "invoices", ["vendor_id", "invoice_date"])

    # Top risk reasons groups by code over a date window.
    op.create_index("ix_risk_flags_created_at", "risk_flags", ["created_at"])
    op.create_index("ix_risk_flags_code_created_at", "risk_flags", ["code", "created_at"])
    # The detail page reads an invoice's flags highest-impact first.
    op.create_index("ix_risk_flags_invoice_id_points", "risk_flags", ["invoice_id", "points"])

    # The audit timeline is read per invoice, oldest first.
    op.create_index("ix_audit_log_invoice_id_created_at", "audit_log", ["invoice_id", "created_at"])

    # The vendor list sorts on these.
    op.create_index("ix_vendors_is_trusted", "vendors", ["is_trusted"])
    op.create_index("ix_vendors_avg_amount", "vendors", ["avg_amount"])
    op.create_index("ix_vendors_invoice_count", "vendors", ["invoice_count"])
    # "Changed in the last 30 days" is a per-vendor, date-ordered lookup.
    op.create_index(
        "ix_vendor_bank_history_vendor_id_changed_on",
        "vendor_bank_history",
        ["vendor_id", "changed_on"],
    )


def downgrade() -> None:
    for name, table in (
        ("ix_vendor_bank_history_vendor_id_changed_on", "vendor_bank_history"),
        ("ix_vendors_invoice_count", "vendors"),
        ("ix_vendors_avg_amount", "vendors"),
        ("ix_vendors_is_trusted", "vendors"),
        ("ix_audit_log_invoice_id_created_at", "audit_log"),
        ("ix_risk_flags_invoice_id_points", "risk_flags"),
        ("ix_risk_flags_code_created_at", "risk_flags"),
        ("ix_risk_flags_created_at", "risk_flags"),
        ("ix_invoices_vendor_id_invoice_date", "invoices"),
        ("ix_invoices_amount", "invoices"),
        ("ix_invoices_decision_status", "invoices"),
        ("ix_invoices_status_risk_score", "invoices"),
        ("ix_invoices_status_created_at", "invoices"),
        ("ix_invoices_created_at", "invoices"),
    ):
        op.drop_index(name, table_name=table)
