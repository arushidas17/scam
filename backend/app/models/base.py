"""Column helpers shared by every table."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def uuid_pk() -> Mapped[uuid.UUID]:
    """UUID primary key, generated application-side so inserts need no round trip."""
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


def created_at_column() -> Mapped[datetime]:
    """Server-set creation stamp, so the database is the clock."""
    return mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
