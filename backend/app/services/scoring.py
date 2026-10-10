"""
Turning flags into a score.

Deliberately trivial: the score is the sum of the points the rules awarded,
capped, and mapped to a band. Keeping this arithmetic in one small, boring
function is what lets anyone re-derive a score by hand from the flag list.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services import risk_constants as K
from app.services.risk_rules import Flag


@dataclass(frozen=True)
class Score:
    score: int
    status: str
    flags: list[Flag]
    # The sum before the cap, kept so a capped score is visibly capped.
    raw_total: int

    @property
    def capped(self) -> bool:
        return self.raw_total > self.score

    def as_dict(self) -> dict[str, Any]:
        return {
            "risk_score": self.score,
            "status": self.status,
            "flags": [flag.as_dict() for flag in self.flags],
            "points_before_cap": self.raw_total,
            "capped": self.capped,
        }


def status_for_score(score: int) -> str:
    """0-30 normal, 31-60 needs review, 61-100 suspicious."""
    if score <= K.STATUS_NORMAL_MAX:
        return K.STATUS_NORMAL
    if score <= K.STATUS_NEEDS_REVIEW_MAX:
        return K.STATUS_NEEDS_REVIEW
    return K.STATUS_SUSPICIOUS


def score_flags(flags: list[Flag]) -> Score:
    """
    Sum, cap, band, and order.

    Flags come back highest-impact first so the reviewer reads the reason that
    actually drove the score before the incidental ones. Ties fall back to the
    rule's own name, so the order is stable rather than dependent on dict
    iteration.
    """
    raw_total = sum(flag.points for flag in flags)
    score = min(raw_total, K.SCORE_CAP)

    ordered = sorted(flags, key=lambda f: (-f.points, f.code))

    return Score(score=score, status=status_for_score(score), flags=ordered, raw_total=raw_total)
