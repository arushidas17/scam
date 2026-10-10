"""
Working out which vendor an invoice is from.

Tried in descending order of trustworthiness: a GSTIN is registered and unique,
a name is typed by whoever made the document, and a sender domain is the
easiest of the three to forge. The method used is returned alongside the match
because the invoice detail page shows the reviewer *how* the vendor was
identified — "matched on sender domain" deserves less trust than "matched on
GSTIN", and hiding that would be misleading.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Vendor
from app.services.risk_constants import FUZZY_AMBIGUITY_MARGIN, FUZZY_NAME_THRESHOLD

if TYPE_CHECKING:  # pragma: no cover
    from typing import Any

MATCH_GSTIN = "gstin"
MATCH_NAME = "name"
MATCH_DOMAIN = "email_domain"
MATCH_NONE = "none"


@dataclass(frozen=True)
class VendorMatch:
    """Who the invoice is from, how we decided, and how sure we are."""

    vendor: Vendor | None
    method: str
    confidence: float
    # Set when a name match was refused because two vendors scored too closely.
    ambiguous_between: tuple[str, ...] = ()

    @property
    def matched(self) -> bool:
        return self.vendor is not None

    def as_dict(self) -> dict[str, Any]:
        return {
            "vendor_id": str(self.vendor.id) if self.vendor else None,
            "vendor_name": self.vendor.name if self.vendor else None,
            "method": self.method,
            "confidence": self.confidence,
            "ambiguous_between": list(self.ambiguous_between),
        }


def domain_of(email: str | None) -> str | None:
    """The domain part of an email address, lowercased."""
    if not email or "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].strip().lower()
    return domain or None


def match_vendor(
    fields: dict[str, Any],
    db: Session,
    *,
    vendors: list[Vendor] | None = None,
) -> VendorMatch:
    """
    Identify the vendor behind a set of extracted fields.

    ``vendors`` is injectable so tests can run without a database.
    """
    candidates = vendors if vendors is not None else list(db.scalars(select(Vendor)).all())
    if not candidates:
        return VendorMatch(None, MATCH_NONE, 0.0)

    # 1. GSTIN: registered and unique, so an exact hit is conclusive.
    gstin = (fields.get("gstin") or "").strip().upper()
    if gstin:
        for vendor in candidates:
            if (vendor.gstin or "").strip().upper() == gstin:
                return VendorMatch(vendor, MATCH_GSTIN, 1.0)

    # 2. Name, fuzzily. token_sort_ratio so "ABC Technologies Pvt Ltd" and
    #    "Pvt Ltd ABC Technologies" compare equal.
    name = (fields.get("vendor_name") or "").strip()
    if name:
        scored = sorted(
            ((fuzz.token_sort_ratio(name.lower(), (v.name or "").lower()), v) for v in candidates),
            key=lambda pair: pair[0],
            reverse=True,
        )
        best_score, best_vendor = scored[0]

        if best_score >= FUZZY_NAME_THRESHOLD:
            runner_up = scored[1][0] if len(scored) > 1 else 0
            # Two vendors this close cannot be told apart from the name alone.
            # Reporting "unknown" is safer than picking the wrong one, because a
            # wrong match would compare against the wrong bank account.
            if best_score - runner_up < FUZZY_AMBIGUITY_MARGIN and len(scored) > 1:
                return VendorMatch(
                    None,
                    MATCH_NONE,
                    0.0,
                    ambiguous_between=(best_vendor.name, scored[1][1].name),
                )
            return VendorMatch(best_vendor, MATCH_NAME, round(best_score / 100, 4))

    # 3. Sender domain: the weakest signal, and the one a lookalike attacks.
    domain = domain_of(fields.get("sender_email"))
    if domain:
        for vendor in candidates:
            if (vendor.email_domain or "").strip().lower() == domain:
                return VendorMatch(vendor, MATCH_DOMAIN, 0.75)

    return VendorMatch(None, MATCH_NONE, 0.0)
