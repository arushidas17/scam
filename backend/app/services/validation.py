"""
Data-quality checks on extracted invoice fields.

Pure functions, no AI and no database. These answer "does this field look
well-formed?", never "is this invoice fraudulent?" — the risk engine is a
separate concern and must stay that way, because a malformed GSTIN is a
scanning problem while a *changed* GSTIN is a fraud signal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

# 2 state digits, 5 PAN letters, 4 digits, 1 letter, 1 entity char, 'Z', 1 check char.
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
# 4 bank letters, a literal 0, then 6 branch characters.
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


@dataclass(frozen=True)
class Warning_:
    """One data-quality concern. `field` names the input that caused it."""

    field: str
    code: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"field": self.field, "code": self.code, "message": self.message}


def is_valid_gstin(value: str | None) -> bool:
    return bool(value) and bool(GSTIN_RE.match(value.strip().upper()))


def is_valid_ifsc(value: str | None) -> bool:
    return bool(value) and bool(IFSC_RE.match(value.strip().upper()))


def _as_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, ArithmeticError):
        return None


def is_positive_amount(value: Any) -> bool:
    amount = _as_decimal(value)
    return amount is not None and amount > 0


def _as_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def due_date_not_before_invoice_date(invoice_date: Any, due_date: Any) -> bool:
    """True when the dates are consistent, or when either is missing."""
    start = _as_date(invoice_date)
    end = _as_date(due_date)
    if start is None or end is None:
        return True
    return end >= start


def check_fields(fields: dict[str, Any]) -> list[dict[str, str]]:
    """
    Run every sanity check over a set of extracted fields.

    A missing field is not a warning on its own: real invoices are often
    incomplete, and the extractor is instructed to return null rather than
    guess. Only a value that is *present but wrong* earns a warning.
    """
    warnings: list[Warning_] = []

    gstin = fields.get("gstin")
    if gstin and not is_valid_gstin(gstin):
        warnings.append(
            Warning_(
                "gstin",
                "gstin_format",
                "The GSTIN does not match the 15-character format, so it may have been misread.",
            )
        )

    ifsc = fields.get("ifsc")
    if ifsc and not is_valid_ifsc(ifsc):
        warnings.append(
            Warning_(
                "ifsc",
                "ifsc_format",
                "The IFSC code does not match the 11-character format, so it may have been misread.",
            )
        )

    for field, label in (("amount", "amount"), ("gst_amount", "GST amount")):
        value = fields.get(field)
        if value is not None and not is_positive_amount(value):
            warnings.append(
                Warning_(
                    field,
                    f"{field}_not_positive",
                    f"The {label} did not read as a positive number.",
                )
            )

    if not due_date_not_before_invoice_date(
        fields.get("invoice_date"), fields.get("due_date")
    ):
        warnings.append(
            Warning_(
                "due_date",
                "due_before_invoice",
                "The due date falls before the invoice date; one of the two may have been misread.",
            )
        )

    return [w.as_dict() for w in warnings]
