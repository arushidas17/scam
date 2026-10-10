"""Columns and statuses the upload flow needs.

Revision ID: 0002_upload
Revises: 0001_initial
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_upload"
down_revision: str | None = "0001_initial"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

# An uploaded invoice is not yet scored, so it is neither normal nor flagged.
# "pending_review" is where it sits between extraction and the risk engine;
# "extraction_failed" records a file we kept but could not read.
NEW_STATUSES = (
    "normal",
    "needs_review",
    "suspicious",
    "pending_review",
    "extraction_failed",
)
OLD_STATUSES = ("normal", "needs_review", "suspicious")


def _status_check(values: tuple[str, ...]) -> str:
    joined = ", ".join(f"'{v}'" for v in values)
    return f"status IN ({joined})"


def upgrade() -> None:
    # The extracted vendor name, kept before any vendor matching happens — an
    # invoice can name a vendor we hold no record of.
    op.add_column("invoices", sa.Column("vendor_name", sa.String(length=200), nullable=True))
    op.add_column("invoices", sa.Column("currency", sa.String(length=8), nullable=True))
    # Why a read failed, so a kept-but-unreadable file can be chased up.
    op.add_column("invoices", sa.Column("extraction_error", sa.Text(), nullable=True))
    # Per-field confidence from the model, separate from the raw response.
    op.add_column(
        "invoices",
        sa.Column("field_confidence", sa.dialects.postgresql.JSONB(), nullable=True),
    )
    op.add_column("invoices", sa.Column("storage_path", sa.Text(), nullable=True))

    op.create_index("ix_invoices_vendor_name", "invoices", ["vendor_name"])

    op.drop_constraint("ck_invoices_status", "invoices", type_="check")
    op.create_check_constraint("ck_invoices_status", "invoices", _status_check(NEW_STATUSES))


def downgrade() -> None:
    # Rows using the new statuses would violate the old constraint.
    op.execute(
        "UPDATE invoices SET status = 'needs_review' "
        "WHERE status IN ('pending_review', 'extraction_failed')"
    )
    op.drop_constraint("ck_invoices_status", "invoices", type_="check")
    op.create_check_constraint("ck_invoices_status", "invoices", _status_check(OLD_STATUSES))

    op.drop_index("ix_invoices_vendor_name", table_name="invoices")
    for column in ("storage_path", "field_confidence", "extraction_error", "currency", "vendor_name"):
        op.drop_column("invoices", column)
