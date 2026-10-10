"""
Masking, in one place.

Every response that carries a bank account goes through here, so there is a
single answer to "what does the API reveal?". Invoice detail is the one
documented exception: a reviewer has to compare the two numbers digit by digit,
and showing them four digits of each would make the comparison impossible.
"""

from __future__ import annotations


def mask_account(value: str | None) -> str:
    """Last four digits only."""
    if not value:
        return "—"
    digits = "".join(ch for ch in str(value) if ch.isalnum())
    if len(digits) <= 4:
        return digits
    return f"•••• •••• {digits[-4:]}"
