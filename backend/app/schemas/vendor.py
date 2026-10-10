import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class VendorRead(BaseModel):
    """A vendor as the API returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    gstin: str
    email_domain: str
    # Bank details are deliberately absent from the list response; they belong
    # on a single-vendor endpoint behind an explicit reveal.
    avg_amount: Decimal
    invoice_count: int
    is_trusted: bool
    created_at: datetime
