"""Shapes shared by several endpoints."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.lib_mask import mask_account


class MaskedBank(BaseModel):
    """Bank details as they leave the API by default: last four digits only."""

    account_masked: str
    ifsc: str | None = None

    @classmethod
    def build(cls, account: str | None, ifsc: str | None) -> "MaskedBank":
        return cls(account_masked=mask_account(account), ifsc=ifsc)


class FlagRead(BaseModel):
    code: str
    title: str
    message: str
    points: int
    evidence: dict[str, Any] = Field(default_factory=dict)


class RecommendationRead(BaseModel):
    verdict: str
    steps: list[str]
    generated_by_fallback: bool = False


class VendorSummary(BaseModel):
    id: uuid.UUID | None = None
    name: str | None = None
    gstin: str | None = None
    email_domain: str | None = None
    is_trusted: bool | None = None
    # How the vendor was identified: gstin, name, email_domain, or none.
    match_method: str | None = None
    match_confidence: float | None = None


class AuditEntry(BaseModel):
    id: uuid.UUID
    action: str
    note: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    created_at: datetime


class Page(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


class DatedCount(BaseModel):
    day: date
    normal: int = 0
    needs_review: int = 0
    suspicious: int = 0
    total: int = 0
