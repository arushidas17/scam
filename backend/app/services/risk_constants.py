"""
Every threshold and point value the risk engine uses.

Tuning happens here and nowhere else: a rule module should read a constant, not
carry a number of its own. Scores are reproducible because these are fixed —
the AI never contributes a point.
"""

from __future__ import annotations

from decimal import Decimal

# --- points per rule ---------------------------------------------------------
POINTS_BANK_ACCOUNT_CHANGED = 40
POINTS_DUPLICATE_INVOICE = 35
POINTS_LOOKALIKE_DOMAIN = 30
POINTS_GSTIN_INVALID_OR_MISMATCHED = 25
POINTS_TOTALS_MISMATCH = 15
POINTS_NEW_VENDOR = 10
POINTS_ODD_TIMING = 10

# abnormal_amount is graduated rather than a single value: the rule is worth
# 15 points at the moment it starts applying and 25 at its most severe.
#
#   15  the amount is ABNORMAL_AMOUNT_PCT_THRESHOLD above the vendor average
#   25  the amount is beyond ABNORMAL_AMOUNT_SIGMA standard deviations, or
#       at/above ABNORMAL_AMOUNT_PCT_MAX
#
# Between the two percentage anchors it rises one point per
# ABNORMAL_AMOUNT_PCT_PER_POINT points of deviation, so an amount 42% above
# average scores 15 + (42 - 30) / 6 = 17. A step function would have made every
# overspend from 31% to 299% look identical, which is not what a reviewer needs.
POINTS_ABNORMAL_AMOUNT_MIN = 15
POINTS_ABNORMAL_AMOUNT_MAX = 25
ABNORMAL_AMOUNT_PCT_THRESHOLD = Decimal("30")   # below this the rule does not fire
ABNORMAL_AMOUNT_PCT_MAX = Decimal("90")         # 3x the threshold: full points
ABNORMAL_AMOUNT_PCT_PER_POINT = Decimal("6")    # (90 - 30) / (25 - 15)
ABNORMAL_AMOUNT_SIGMA = Decimal("3")
# Below this many past invoices there is no meaningful average to compare to.
ABNORMAL_AMOUNT_MIN_HISTORY = 5

# --- other thresholds --------------------------------------------------------
# A near-identical invoice from the same vendor inside this window is a duplicate.
DUPLICATE_WINDOW_DAYS = 7
# Rounding on a printed invoice should not fire a flag.
TOTALS_TOLERANCE = Decimal("1")
# Standard GST rates an invoice's tax line is checked against.
GST_RATES = (Decimal("0"), Decimal("0.05"), Decimal("0.12"), Decimal("0.18"), Decimal("0.28"))
# A due date this soon after the invoice date is pressure, not terms.
ODD_TIMING_MIN_DUE_DAYS = 2

# A domain this far from the vendor's own is a lookalike; 0 is the real thing
# and 3+ is simply a different company.
LOOKALIKE_MIN_DISTANCE = 1
LOOKALIKE_MAX_DISTANCE = 2

# --- vendor matching ---------------------------------------------------------
# rapidfuzz token_sort_ratio, 0-100.
FUZZY_NAME_THRESHOLD = 88
# If the top two candidates are this close, the match is ambiguous and refused:
# guessing between two vendors is worse than reporting an unknown one.
FUZZY_AMBIGUITY_MARGIN = 5

# --- score bands -------------------------------------------------------------
SCORE_CAP = 100
STATUS_NORMAL_MAX = 30       # 0-30
STATUS_NEEDS_REVIEW_MAX = 60  # 31-60, then 61-100 suspicious

STATUS_NORMAL = "normal"
STATUS_NEEDS_REVIEW = "needs_review"
STATUS_SUSPICIOUS = "suspicious"
