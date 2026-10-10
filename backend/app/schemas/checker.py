from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FlagRead, RecommendationRead, VendorSummary


class CheckerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_email: str
    subject: str | None = None
    body: str


class PhraseHighlight(BaseModel):
    kind: str
    phrase: str
    # Offsets into the combined subject + body text returned as `text`.
    start: int
    end: int
    reason: str


class CheckerResponse(BaseModel):
    risk_score: int
    status: str
    # bank_change, payment_request or other.
    request_type: str
    sender_domain: str | None = None
    vendor: VendorSummary | None = None
    extracted_account: str | None = None
    extracted_ifsc: str | None = None
    flags: list[FlagRead] = Field(default_factory=list)
    recommendation: RecommendationRead
    highlights: list[PhraseHighlight] = Field(default_factory=list)
    # The exact text the offsets index into.
    text: str
