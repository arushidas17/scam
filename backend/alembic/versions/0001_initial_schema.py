"""Initial schema: six tables, UUID keys, NUMERIC money, RLS enabled.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

# Every table holds bank details or decisions about money. Supabase publishes
# public tables through PostgREST, so each one gets RLS enabled with no policy:
# that denies the anon and authenticated roles outright while leaving the table
# fully readable to the owner this backend connects as.
TABLES = (
    "users",
    "vendors",
    "vendor_bank_history",
    "invoices",
    "risk_flags",
    "audit_log",
)


def upgrade() -> None:
    op.create_table(
        "users",
        # Not generated here: this carries the Supabase auth user id.
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=40), server_default="reviewer", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "vendors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("gstin", sa.String(length=15), nullable=False),
        sa.Column("email_domain", sa.String(length=255), nullable=False),
        sa.Column("bank_account", sa.String(length=34), nullable=True),
        sa.Column("ifsc", sa.String(length=11), nullable=True),
        sa.Column("avg_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("invoice_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_trusted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gstin", name="uq_vendors_gstin"),
    )
    op.create_index("ix_vendors_name", "vendors", ["name"])
    op.create_index("ix_vendors_gstin", "vendors", ["gstin"])
    op.create_index("ix_vendors_email_domain", "vendors", ["email_domain"])

    op.create_table(
        "vendor_bank_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("old_account", sa.String(length=34), nullable=True),
        sa.Column("new_account", sa.String(length=34), nullable=True),
        sa.Column("old_ifsc", sa.String(length=11), nullable=True),
        sa.Column("new_ifsc", sa.String(length=11), nullable=True),
        sa.Column("changed_on", sa.Date(), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["vendor_id"], ["vendors.id"], ondelete="CASCADE",
            name="fk_vendor_bank_history_vendor_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vendor_bank_history_vendor_id", "vendor_bank_history", ["vendor_id"])
    op.create_index("ix_vendor_bank_history_changed_on", "vendor_bank_history", ["changed_on"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        # Nullable: an invoice can arrive from a vendor with no record, and
        # that absence is itself a signal.
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invoice_number", sa.String(length=100), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("gst_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("gstin", sa.String(length=15), nullable=True),
        sa.Column("bank_account", sa.String(length=34), nullable=True),
        sa.Column("ifsc", sa.String(length=11), nullable=True),
        sa.Column("sender_email", sa.String(length=320), nullable=True),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column("raw_extraction", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("risk_score", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="normal", nullable=False),
        sa.Column("decision", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["vendor_id"], ["vendors.id"], ondelete="SET NULL",
            name="fk_invoices_vendor_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "risk_score >= 0 AND risk_score <= 100", name="ck_invoices_risk_score_range"
        ),
        sa.CheckConstraint(
            "status IN ('normal', 'needs_review', 'suspicious')", name="ck_invoices_status"
        ),
        sa.CheckConstraint(
            "decision IN ('pending', 'approved', 'rejected', 'escalated')",
            name="ck_invoices_decision",
        ),
    )
    op.create_index("ix_invoices_vendor_id", "invoices", ["vendor_id"])
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"])
    op.create_index("ix_invoices_invoice_date", "invoices", ["invoice_date"])
    op.create_index("ix_invoices_sender_email", "invoices", ["sender_email"])
    op.create_index("ix_invoices_risk_score", "invoices", ["risk_score"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_decision", "invoices", ["decision"])

    op.create_table(
        "risk_flags",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("points", sa.Integer(), server_default="0", nullable=False),
        sa.Column("evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["invoices.id"], ondelete="CASCADE",
            name="fk_risk_flags_invoice_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_risk_flags_invoice_id", "risk_flags", ["invoice_id"])
    op.create_index("ix_risk_flags_code", "risk_flags", ["code"])

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
        # SET NULL, not CASCADE: the trail must outlive a deleted account.
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["invoices.id"], ondelete="CASCADE",
            name="fk_audit_log_invoice_id",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL", name="fk_audit_log_user_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_invoice_id", "audit_log", ["invoice_id"])
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])

    # RLS on with no policies denies every role that reaches these tables
    # through Supabase's data API (anon, authenticated). The owner this backend
    # connects as is unaffected, which is exactly the split we want.
    #
    # Deliberately NOT "FORCE ROW LEVEL SECURITY": that would apply the denial
    # to the owner too, leaving this backend dependent on its role keeping the
    # BYPASSRLS attribute. Plain ENABLE needs no such assumption.
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')

    op.drop_table("audit_log")
    op.drop_table("risk_flags")
    op.drop_table("invoices")
    op.drop_table("vendor_bank_history")
    op.drop_table("vendors")
    op.drop_table("users")
