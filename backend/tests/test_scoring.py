"""Scoring is deliberately boring arithmetic. These pin it down."""

from __future__ import annotations

import pytest

from app.services import risk_constants as K
from app.services.risk_rules import Flag
from app.services.scoring import score_flags, status_for_score


def flag(code: str, points: int) -> Flag:
    return Flag(code=code, title=code, message=code, points=points)


@pytest.mark.parametrize(
    "score, expected",
    [
        (0, "normal"), (30, "normal"),
        (31, "needs_review"), (60, "needs_review"),
        (61, "suspicious"), (87, "suspicious"), (100, "suspicious"),
    ],
)
def test_bands(score: int, expected: str) -> None:
    assert status_for_score(score) == expected


def test_no_flags_scores_zero() -> None:
    result = score_flags([])
    assert result.score == 0
    assert result.status == "normal"
    assert result.flags == []


def test_the_score_is_the_sum_of_the_points() -> None:
    result = score_flags([flag("a", 40), flag("b", 30), flag("c", 17)])
    assert result.score == 87
    assert result.raw_total == 87
    assert result.capped is False


def test_the_score_is_capped_at_100() -> None:
    result = score_flags([flag("a", 40), flag("b", 35), flag("c", 30), flag("d", 25)])
    assert result.raw_total == 130
    assert result.score == K.SCORE_CAP == 100
    assert result.capped is True, "a capped score is visibly capped"


def test_flags_come_back_highest_impact_first() -> None:
    result = score_flags([flag("small", 10), flag("big", 40), flag("medium", 25)])
    assert [f.code for f in result.flags] == ["big", "medium", "small"]


def test_ties_are_ordered_stably() -> None:
    """Equal points fall back to the code, so the order never shifts between runs."""
    result = score_flags([flag("zulu", 15), flag("alpha", 15)])
    assert [f.code for f in result.flags] == ["alpha", "zulu"]
