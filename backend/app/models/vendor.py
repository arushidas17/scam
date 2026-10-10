import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import created_at_column, uuid_pk


class Vendor(Base):
    """A supplier, and the details every incoming invoice is checked against."""

    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    gstin: Mapped[str] = mapped_column(String(15), nullable=False, unique=True, index=True)
    email_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    bank_account: Mapped[str | None] = mapped_column(String(34), nullable=True)
    ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)

    # Money is NUMERIC everywhere; a float would quietly lose paise.
    avg_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    invoice_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_trusted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = created_at_column()

    bank_history: Mapped[list["VendorBankHistory"]] = relationship(
        back_populates="vendor", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="vendor")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Vendor {self.name}>"


class VendorBankHistory(Base):
    """Every time a vendor's payout details moved, and whether anyone checked."""

    __tablename__ = "vendor_bank_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_account: Mapped[str | None] = mapped_column(String(34), nullable=True)
    new_account: Mapped[str | None] = mapped_column(String(34), nullable=True)
    old_ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    new_ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    changed_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = created_at_column()

    vendor: Mapped["Vendor"] = relationship(back_populates="bank_history")
