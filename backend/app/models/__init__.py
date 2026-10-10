"""Importing this package registers every table on Base.metadata."""

from app.models.audit_log import AuditLog
from app.models.invoice import Invoice
from app.models.risk_flag import RiskFlag
from app.models.user import User
from app.models.vendor import Vendor, VendorBankHistory

__all__ = ["AuditLog", "Invoice", "RiskFlag", "User", "Vendor", "VendorBankHistory"]
