import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import created_at_column, uuid_pk


class RiskFlag(Base):
    """
    One finding against an invoice.

    ``points`` is what this flag contributed to the invoice's risk score; the
    flags on an invoice are expected to sum to it.
    """

    __tablename__ = "risk_flags"

    id: Mapped[uuid.UUID] = uuid_pk()
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = created_at_column()

    invoice: Mapped["Invoice"] = relationship(back_populates="risk_flags")  # noqa: F821

    def __repr__(self) -> str:
        return f"<RiskFlag {self.code} +{self.points}>"
