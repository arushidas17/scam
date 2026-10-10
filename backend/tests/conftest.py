"""Shared fakes. Nothing here touches the network or the database."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest

from app.services.risk_rules import BankChange, PastInvoice, RuleContext


@dataclass
class FakeVendor:
    """Stands in for a Vendor row without needing a session."""

    id: str = "ven_abc"
    name: str = "ABC Technologies"
    gstin: str = "27AABCA1234K1Z5"
    email_domain: str = "abctechnologies.com"
    bank_account: str = "50100294817732"
    ifsc: str = "HDFC0004512"


@pytest.fixture
def vendor() -> FakeVendor:
    return FakeVendor()


def past_invoices(amounts: list[str], *, start: date | None = None, every_days: int = 30) -> list[PastInvoice]:
    """A tidy run of settled invoices, oldest first."""
    start = start or date(2026, 1, 5)
    return [
        PastInvoice(
            id=f"past-{i}",
            invoice_number=f"ABC/2026/{100 + i}",
            invoice_date=start + timedelta(days=i * every_days),
            amount=Decimal(a),
        )
        for i, a in enumerate(amounts)
    ]


@pytest.fixture
def ctx(vendor: FakeVendor) -> RuleContext:
    """A vendor with eight tidy past invoices averaging 340000."""
    return RuleContext(
        vendor=vendor,
        vendor_invoices=past_invoices(
            ["312000", "298500", "341000", "365000", "327500", "352000", "318000", "338500"]
        ),
        bank_changes=[BankChange(changed_on=date(2025, 8, 22), verified=True)],
        current_invoice_id="current",
    )


@pytest.fixture
def clean_fields() -> dict[str, Any]:
    """An invoice that should fire nothing at all."""
    return {
        "vendor_name": "ABC Technologies",
        "invoice_number": "ABC/2026/0914",
        # A Monday, with normal 30-day terms.
        "invoice_date": date(2026, 10, 5),
        "due_date": date(2026, 11, 4),
        "amount": Decimal("350000.00"),
        "gst_amount": Decimal("53389.83"),   # 18% of the net
        "gstin": "27AABCA1234K1Z5",
        "bank_account": "50100294817732",
        "ifsc": "HDFC0004512",
        "sender_email": "accounts@abctechnologies.com",
        "currency": "INR",
    }


@pytest.fixture
def null_fields() -> dict[str, Any]:
    """Every field missing, which is what a badly scanned invoice looks like."""
    return {
        key: None
        for key in (
            "vendor_name", "invoice_number", "invoice_date", "due_date", "amount",
            "gst_amount", "gstin", "bank_account", "ifsc", "sender_email", "currency",
        )
    }


def fake_gemini(payload: str) -> Any:
    """A client whose interactions.create returns `payload` verbatim."""
    return SimpleNamespace(
        interactions=SimpleNamespace(create=lambda **kw: SimpleNamespace(output_text=payload))
    )


def failing_gemini(exc: Exception | None = None) -> Any:
    """A client that always raises, to exercise the fallback path."""
    def _raise(**kw):
        raise exc or RuntimeError("model unavailable")

    return SimpleNamespace(interactions=SimpleNamespace(create=_raise))


# --- authentication fakes ----------------------------------------------------
TEST_USER_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")


@pytest.fixture(autouse=True, scope="session")
def _clean_up_rows_the_suite_creates():
    """
    Leave the database as the suite found it.

    Several tests go through the real endpoints, which write real rows. Rather
    than relying on every test to tidy up its own, the set of invoice ids is
    snapshotted at the start and anything new is removed at the end — so a
    failing test mid-run cannot leave the seed data polluted either.
    """
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Invoice, Vendor, VendorBankHistory

    try:
        with SessionLocal() as db:
            before = {row for row in db.scalars(select(Invoice.id)).all()}
            history_before = {row for row in db.scalars(select(VendorBankHistory.id)).all()}
            vendors_before = {
                v.id: (v.bank_account, v.ifsc, v.is_trusted)
                for v in db.scalars(select(Vendor)).all()
            }
    except Exception:  # pragma: no cover - the DB may not be reachable
        yield
        return

    yield

    from decimal import Decimal
    from sqlalchemy import func

    with SessionLocal() as db:
        new_invoices = [i for i in db.scalars(select(Invoice.id)).all() if i not in before]
        for invoice_id in new_invoices:
            row = db.get(Invoice, invoice_id)
            if row:
                db.delete(row)

        for history_id in [h for h in db.scalars(select(VendorBankHistory.id)).all()
                           if h not in history_before]:
            row = db.get(VendorBankHistory, history_id)
            if row:
                db.delete(row)

        # Decision tests can move a vendor's stored account; put it back.
        for vendor in db.scalars(select(Vendor)).all():
            snapshot = vendors_before.get(vendor.id)
            if snapshot and (vendor.bank_account, vendor.ifsc, vendor.is_trusted) != snapshot:
                vendor.bank_account, vendor.ifsc, vendor.is_trusted = snapshot
        db.commit()

        # Keep the vendor rollups in step with what is actually stored.
        totals = {
            v: (c, a)
            for v, c, a in db.execute(
                select(Invoice.vendor_id, func.count(Invoice.id),
                       func.coalesce(func.avg(Invoice.amount), 0))
                .where(Invoice.vendor_id.is_not(None))
                .group_by(Invoice.vendor_id)
            ).all()
        }
        for vendor in db.scalars(select(Vendor)).all():
            count, average = totals.get(vendor.id, (0, Decimal("0")))
            vendor.invoice_count = count
            vendor.avg_amount = Decimal(average).quantize(Decimal("0.01"))
        db.commit()


@pytest.fixture(autouse=True, scope="session")
def _ensure_test_user():
    """The audit log references a real users row, so make sure one exists."""
    from app.database import SessionLocal
    from app.models import User

    try:
        with SessionLocal() as db:
            if db.get(User, TEST_USER_ID) is None:
                db.add(User(id=TEST_USER_ID, name="Test Reviewer",
                            email="reviewer@fraudguardian.test", role="reviewer"))
                db.commit()
    except Exception:  # pragma: no cover - the DB may not be reachable
        pass


@pytest.fixture
def auth_user():
    """
    Stand in for a verified Supabase user.

    The dependency is overridden rather than the HTTP call mocked, so tests
    never reach the auth service, and a real users row exists for the audit
    log to reference.
    """
    from app.auth import CurrentUser
    from app.database import SessionLocal
    from app.models import User

    user = CurrentUser(
        id=TEST_USER_ID, email="reviewer@fraudguardian.test",
        name="Test Reviewer", role="reviewer",
    )

    try:
        with SessionLocal() as db:
            if db.get(User, TEST_USER_ID) is None:
                db.add(User(id=TEST_USER_ID, name=user.name, email=user.email, role=user.role))
                db.commit()
    except Exception:  # pragma: no cover - the DB may not be reachable
        pass

    return user


@pytest.fixture
def signed_in(auth_user):
    """A TestClient whose requests are authenticated."""
    from fastapi.testclient import TestClient

    from app.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: auth_user
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def anonymous():
    """A TestClient with no token at all."""
    from fastapi.testclient import TestClient

    from app.auth import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)
    return TestClient(app)


@pytest.fixture(autouse=True)
def stub_explanation(monkeypatch):
    """Keep every test offline; scoring itself stays real."""
    from app.services.explain import ExplanationResult

    stub = lambda flags, **kw: ExplanationResult(  # noqa: E731
        verdict="Stubbed verdict for tests.",
        steps=["Stubbed step one.", "Stubbed step two."],
        generated_by_fallback=True,
    )
    monkeypatch.setattr("app.services.pipeline.explain", stub)
    monkeypatch.setattr("app.routers.payment_checker.explain", stub)
