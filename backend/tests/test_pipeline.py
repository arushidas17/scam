"""
The pipeline and the /analyse endpoint, against the real database with a
mocked Gemini client.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app

@pytest.fixture(autouse=True)
def stub_explanation(monkeypatch):
    """
    The /analyse endpoint builds its own model client, so stub the explanation
    for every test in this module. Scoring itself is left entirely real.
    """
    from app.services.explain import ExplanationResult

    monkeypatch.setattr(
        "app.services.pipeline.explain",
        lambda flags, **kw: ExplanationResult(
            verdict="Stubbed verdict for tests.",
            steps=["Stubbed step one.", "Stubbed step two."],
            generated_by_fallback=True,
        ),
    )


@pytest.fixture(scope="module")
def client() -> TestClient:
    """
    Authenticated client.

    These routes are behind the auth dependency; it is overridden rather than
    the token verified, so the tests stay offline.
    """
    from app.auth import CurrentUser, get_current_user
    from tests.conftest import TEST_USER_ID

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email="reviewer@fraudguardian.test",
        name="Test Reviewer", role="reviewer",
    )
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(scope="module")
def db_available() -> bool:
    from sqlalchemy import text

    from app.database import engine

    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return True
    except Exception:
        return False


def _skip(db_available: bool) -> None:
    if not db_available:
        pytest.skip("database not reachable")


@pytest.fixture
def seeded_vendor(db_available: bool):
    _skip(db_available)
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Vendor

    with SessionLocal() as db:
        vendor = db.scalars(select(Vendor).where(Vendor.name == "ABC Technologies")).first()
        if vendor is None:
            pytest.skip("seed data not present; run python -m app.seed")
        return {
            "id": vendor.id,
            "name": vendor.name,
            "gstin": vendor.gstin,
            "bank_account": vendor.bank_account,
            "email_domain": vendor.email_domain,
        }


@pytest.fixture
def temp_invoice(seeded_vendor, db_available: bool):
    """An invoice with a changed bank account, cleaned up afterwards."""
    _skip(db_available)
    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        invoice = Invoice(
            vendor_id=None,
            vendor_name=seeded_vendor["name"],
            invoice_number=f"TEST/{uuid.uuid4().hex[:8].upper()}",
            invoice_date=date(2026, 10, 5),
            due_date=date(2026, 11, 4),
            amount=Decimal("900000.00"),
            gst_amount=Decimal("137288.14"),
            gstin=seeded_vendor["gstin"],
            bank_account="91847263510094",
            ifsc="KKBK0007781",
            sender_email=f"accounts@{seeded_vendor['email_domain']}",
            currency="INR",
            status="pending_review",
            decision="pending",
            raw_extraction={"model": "test", "response": {}},
        )
        db.add(invoice)
        db.commit()
        invoice_id = invoice.id

    yield invoice_id

    with SessionLocal() as db:
        row = db.get(Invoice, invoice_id)
        if row:
            db.delete(row)
            db.commit()


def test_analyse_scores_persists_and_links_the_vendor(temp_invoice, seeded_vendor) -> None:
    from app.database import SessionLocal
    from app.models import Invoice
    from app.services.pipeline import analyse_invoice

    with SessionLocal() as db:
        analysis = analyse_invoice(temp_invoice, db)

    assert analysis.score.score > 0
    assert analysis.score.flags
    # The score is re-derivable from the flags it came with.
    assert sum(f.points for f in analysis.score.flags) == analysis.score.raw_total

    with SessionLocal() as db:
        invoice = db.get(Invoice, temp_invoice)
        assert invoice.risk_score == analysis.score.score
        assert invoice.status == analysis.score.status
        assert invoice.vendor_id == seeded_vendor["id"], "matched on GSTIN"
        assert len(invoice.risk_flags) == len(analysis.score.flags)
        assert {f.code for f in invoice.risk_flags} == {f.code for f in analysis.score.flags}
        assert invoice.raw_extraction["analysis"]["vendor_match"]["method"] == "gstin"


def test_re_analysing_replaces_the_flags_rather_than_stacking(temp_invoice) -> None:
    from app.database import SessionLocal
    from app.models import Invoice
    from app.services.pipeline import analyse_invoice

    with SessionLocal() as db:
        first = analyse_invoice(temp_invoice, db)
    with SessionLocal() as db:
        second = analyse_invoice(temp_invoice, db)

    assert first.score.score == second.score.score

    with SessionLocal() as db:
        invoice = db.get(Invoice, temp_invoice)
        assert len(invoice.risk_flags) == len(second.score.flags)


def test_correcting_the_account_lowers_the_score(temp_invoice, seeded_vendor) -> None:
    """A correction followed by re-analysis gives the score the new fields earn."""
    from app.database import SessionLocal
    from app.models import Invoice
    from app.services.pipeline import analyse_invoice

    with SessionLocal() as db:
        before = analyse_invoice(temp_invoice, db)

    with SessionLocal() as db:
        invoice = db.get(Invoice, temp_invoice)
        invoice.bank_account = seeded_vendor["bank_account"]
        db.commit()

    with SessionLocal() as db:
        after = analyse_invoice(temp_invoice, db)

    assert after.score.score == before.score.score - 40
    assert "bank_account_changed" not in {f.code for f in after.score.flags}


def test_the_analyse_endpoint_returns_the_breakdown(client: TestClient, temp_invoice) -> None:
    response = client.post(f"/invoices/{temp_invoice}/analyse")
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["risk_score"] == sum(f["points"] for f in body["flags"])
    assert body["status"] in ("normal", "needs_review", "suspicious")
    assert body["vendor_match"]["method"] == "gstin"
    assert body["recommendation"]["verdict"]
    assert 2 <= len(body["recommendation"]["steps"]) <= 4
    # Flags arrive highest-impact first.
    points = [f["points"] for f in body["flags"]]
    assert points == sorted(points, reverse=True)


def test_analysing_an_unknown_invoice_is_404(client: TestClient, db_available: bool) -> None:
    _skip(db_available)
    assert client.post(f"/invoices/{uuid.uuid4()}/analyse").status_code == 404


def test_evidence_survives_the_round_trip(client: TestClient, temp_invoice) -> None:
    body = client.post(f"/invoices/{temp_invoice}/analyse").json()
    bank = next(f for f in body["flags"] if f["code"] == "bank_account_changed")
    assert bank["evidence"]["on_record"]
    assert bank["evidence"]["on_invoice"] == "91847263510094"
    assert bank["points"] == 40


def test_a_receipt_with_no_bank_details_analyses_through_the_endpoint(
    client: TestClient, db_available: bool, seeded_vendor
) -> None:
    """
    A retail cash receipt: no bank account, no IFSC, no sender email, no GSTIN.

    It must store, score and come back through the API without error — the
    rules that need those values simply do not fire.
    """
    _skip(db_available)
    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        receipt = Invoice(
            vendor_id=None,
            vendor_name="Sundaram General Stores",
            invoice_number=f"RCPT-{uuid.uuid4().hex[:6].upper()}",
            invoice_date=date(2026, 10, 5),
            due_date=None,
            amount=Decimal("1250.00"),
            gst_amount=None,
            gstin=None,
            bank_account=None,
            ifsc=None,
            sender_email=None,
            currency="INR",
            status="pending_review",
            decision="pending",
            raw_extraction={"model": "test", "response": {}},
        )
        db.add(receipt)
        db.commit()
        receipt_id = receipt.id

    try:
        response = client.post(f"/invoices/{receipt_id}/analyse")
        assert response.status_code == 200, response.text

        body = response.json()
        assert body["risk_score"] == sum(f["points"] for f in body["flags"])
        assert body["status"] in ("normal", "needs_review", "suspicious")

        fired = {f["code"] for f in body["flags"]}
        assert "bank_account_changed" not in fired
        assert "ifsc_changed" not in fired
        assert "lookalike_domain" not in fired
        assert "gstin_invalid_or_mismatched" not in fired

        # And it reads back cleanly, with the absent fields as null.
        detail = client.get(f"/invoices/{receipt_id}").json()
        assert detail["bank_account"] is None
        assert detail["ifsc"] is None
        assert detail["sender_email"] is None
        assert detail["gstin"] is None
        assert detail["amount"] == "1250.00"
    finally:
        with SessionLocal() as db:
            row = db.get(Invoice, receipt_id)
            if row:
                db.delete(row)
                db.commit()


def test_clearing_optional_fields_is_accepted(
    client: TestClient, db_available: bool, temp_invoice
) -> None:
    """A reviewer can blank a field the document does not contain."""
    _skip(db_available)
    response = client.patch(
        f"/invoices/{temp_invoice}/fields",
        json={"bank_account": None, "ifsc": None, "sender_email": None, "gstin": None},
    )
    assert response.status_code == 200, response.text

    invoice = response.json()["invoice"]
    assert invoice["bank_account"] is None
    assert invoice["ifsc"] is None
    assert invoice["sender_email"] is None
    assert invoice["gstin"] is None
    # No format warnings for fields that are simply absent.
    assert [w for w in response.json()["warnings"] if w["field"] in ("gstin", "ifsc")] == []
