"""
The endpoints the front end calls.

Gemini is stubbed by the autouse fixture in conftest; these use the real
database and the real risk engine.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest


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


@pytest.fixture(autouse=True)
def _needs_db(db_available: bool) -> None:
    if not db_available:
        pytest.skip("database not reachable")


@pytest.fixture
def abc_vendor():
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Vendor

    with SessionLocal() as db:
        vendor = db.scalars(select(Vendor).where(Vendor.name == "ABC Technologies")).first()
        if vendor is None:
            pytest.skip("seed data not present; run python -m app.seed")
        return {
            "id": vendor.id, "name": vendor.name, "gstin": vendor.gstin,
            "bank_account": vendor.bank_account, "ifsc": vendor.ifsc,
            "email_domain": vendor.email_domain, "is_trusted": vendor.is_trusted,
        }


def _make_invoice(**overrides):
    """A throwaway invoice row; the caller deletes it."""
    from app.database import SessionLocal
    from app.models import Invoice

    defaults = dict(
        vendor_id=None,
        vendor_name="ABC Technologies",
        invoice_number=f"T/{uuid.uuid4().hex[:8].upper()}",
        invoice_date=date(2026, 10, 5),
        due_date=date(2026, 11, 4),
        amount=Decimal("250000.00"),
        gst_amount=Decimal("38135.59"),
        gstin="27AABCA1234K1Z5",
        bank_account="50100294817732",
        ifsc="HDFC0004512",
        sender_email="accounts@abctechnologies.com",
        currency="INR",
        status="normal",
        decision="pending",
        risk_score=5,
        raw_extraction={"model": "test", "response": {}},
    )
    defaults.update(overrides)

    with SessionLocal() as db:
        invoice = Invoice(**defaults)
        db.add(invoice)
        db.commit()
        return invoice.id


def _delete_invoice(invoice_id) -> None:
    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        row = db.get(Invoice, invoice_id)
        if row:
            db.delete(row)
            db.commit()


@pytest.fixture
def temp_invoice():
    created: list = []

    def _make(**overrides):
        invoice_id = _make_invoice(**overrides)
        created.append(invoice_id)
        return invoice_id

    yield _make

    for invoice_id in created:
        _delete_invoice(invoice_id)


# --- dashboard ---------------------------------------------------------------
def test_dashboard_stats_has_every_panel(signed_in) -> None:
    body = signed_in.get("/dashboard/stats").json()

    assert set(body["today"]) == {"total", "normal", "needs_review", "suspicious"}
    assert body["today"]["total"] == (
        body["today"]["normal"] + body["today"]["needs_review"] + body["today"]["suspicious"]
    )
    assert isinstance(body["money_at_risk"], str), "amounts are strings, never floats"
    Decimal(body["money_at_risk"])

    assert len(body["per_day"]) == 14, "a row per day, including quiet ones"
    days = [row["day"] for row in body["per_day"]]
    assert days == sorted(days)

    for reason in body["top_reasons"]:
        assert reason["count"] > 0 and reason["code"] and reason["title"]

    assert len(body["recent_alerts"]) <= 8
    scores = [a["risk_score"] for a in body["recent_alerts"] if a["risk_score"] is not None]
    assert scores == sorted(scores, reverse=True), "highest risk first"
    for alert in body["recent_alerts"]:
        assert isinstance(alert["amount"], str)


# --- invoice list ------------------------------------------------------------
def test_list_defaults_to_15_per_page(signed_in) -> None:
    body = signed_in.get("/invoices").json()
    assert body["page_size"] == 15
    assert len(body["rows"]) <= 15
    assert body["page"] == 1
    assert set(body["counts"]) == {"all", "normal", "needs_review", "suspicious"}


def test_list_masks_bank_accounts(signed_in) -> None:
    rows = signed_in.get("/invoices").json()["rows"]
    assert rows
    for row in rows:
        assert "bank_account" not in row, "only the masked form is exposed here"
        assert row["bank_account_masked"].startswith("•") or row["bank_account_masked"] == "—"
        assert isinstance(row["amount"], str)


def test_list_filters_by_status(signed_in) -> None:
    body = signed_in.get("/invoices", params={"status": "suspicious"}).json()
    assert all(row["status"] == "suspicious" for row in body["rows"])
    assert body["total"] == body["counts"]["suspicious"]


def test_tab_counts_ignore_the_status_filter(signed_in) -> None:
    """The tabs must not change as the user clicks between them."""
    unfiltered = signed_in.get("/invoices").json()["counts"]
    filtered = signed_in.get("/invoices", params={"status": "normal"}).json()["counts"]
    assert unfiltered == filtered


def test_list_searches_vendor_and_invoice_number(signed_in) -> None:
    by_vendor = signed_in.get("/invoices", params={"search": "ABC Technologies"}).json()
    assert by_vendor["total"] >= 1
    assert all("abc" in (r["vendor_name"] or "").lower() for r in by_vendor["rows"])

    number = by_vendor["rows"][0]["invoice_number"]
    by_number = signed_in.get("/invoices", params={"search": number}).json()
    assert any(r["invoice_number"] == number for r in by_number["rows"])


def test_search_with_no_matches_is_empty_not_an_error(signed_in) -> None:
    body = signed_in.get("/invoices", params={"search": "zzz-no-such-vendor"}).json()
    assert body["total"] == 0
    assert body["rows"] == []


@pytest.mark.parametrize("sort", ["invoice_date", "amount", "risk_score", "vendor"])
@pytest.mark.parametrize("order", ["asc", "desc"])
def test_sorting_on_every_allowed_column(signed_in, sort: str, order: str) -> None:
    rows = signed_in.get("/invoices", params={"sort": sort, "order": order}).json()["rows"]
    key = {
        "invoice_date": lambda r: r["invoice_date"] or "",
        "amount": lambda r: Decimal(r["amount"]),
        "risk_score": lambda r: r["risk_score"] if r["risk_score"] is not None else -1,
        "vendor": lambda r: (r["vendor_name"] or "").lower(),
    }[sort]
    values = [key(r) for r in rows]
    assert values == sorted(values, reverse=(order == "desc"))


def test_an_unknown_sort_column_is_rejected(signed_in) -> None:
    """Sorting is chosen from a fixed list, never built from the query string."""
    for attempt in ("bank_account", "id; drop table invoices", "raw_extraction", ""):
        response = signed_in.get("/invoices", params={"sort": attempt})
        assert response.status_code == 422, attempt


def test_an_unknown_order_is_rejected(signed_in) -> None:
    assert signed_in.get("/invoices", params={"order": "sideways"}).status_code == 422


def test_an_unknown_status_is_rejected(signed_in) -> None:
    assert signed_in.get("/invoices", params={"status": "exploded"}).status_code == 422


def test_an_inverted_date_range_is_rejected(signed_in) -> None:
    response = signed_in.get(
        "/invoices", params={"date_from": "2026-10-10", "date_to": "2026-10-01"}
    )
    assert response.status_code == 422


def test_pagination_walks_without_repeating(signed_in) -> None:
    first = signed_in.get("/invoices", params={"page": 1, "page_size": 5}).json()
    second = signed_in.get("/invoices", params={"page": 2, "page_size": 5}).json()

    assert first["page_size"] == 5 and len(first["rows"]) == 5
    assert first["total"] == second["total"]
    assert {r["id"] for r in first["rows"]} & {r["id"] for r in second["rows"]} == set()
    assert first["pages"] == (first["total"] + 4) // 5


def test_page_size_is_capped(signed_in) -> None:
    assert signed_in.get("/invoices", params={"page_size": 500}).status_code == 422


def test_a_page_beyond_the_end_clamps(signed_in) -> None:
    body = signed_in.get("/invoices", params={"page": 9999, "page_size": 5}).json()
    assert body["page"] == body["pages"]


def test_date_filtering(signed_in) -> None:
    body = signed_in.get(
        "/invoices", params={"date_from": "2026-09-01", "date_to": "2026-09-30"}
    ).json()
    for row in body["rows"]:
        assert "2026-09-01" <= row["invoice_date"] <= "2026-09-30"


# --- invoice detail ----------------------------------------------------------
def test_detail_returns_the_account_in_full(signed_in, temp_invoice) -> None:
    """The one endpoint that does not mask: the reviewer has to compare digits."""
    invoice_id = temp_invoice(bank_account="91847263510094")
    body = signed_in.get(f"/invoices/{invoice_id}").json()

    assert body["bank_account"] == "91847263510094"
    assert "•" not in body["bank_account"]
    assert isinstance(body["amount"], str)
    assert "timeline" in body and isinstance(body["timeline"], list)
    assert "flags" in body


def test_detail_orders_flags_highest_impact_first(signed_in, temp_invoice, abc_vendor) -> None:
    invoice_id = temp_invoice(
        vendor_id=abc_vendor["id"], bank_account="91847263510094",
        sender_email="accounts@abctechnoIogies.com", status="suspicious", risk_score=70,
    )
    signed_in.post(f"/invoices/{invoice_id}/analyse")
    flags = signed_in.get(f"/invoices/{invoice_id}").json()["flags"]
    points = [f["points"] for f in flags]
    assert points == sorted(points, reverse=True)
    assert all("evidence" in f for f in flags)


def test_detail_carries_the_queue_neighbours(signed_in, temp_invoice) -> None:
    temp_invoice(status="suspicious", risk_score=90, decision="pending")
    middle = temp_invoice(status="suspicious", risk_score=80, decision="pending")
    temp_invoice(status="suspicious", risk_score=70, decision="pending")

    body = signed_in.get(f"/invoices/{middle}").json()
    assert body["queue_total"] >= 3
    assert body["queue_position"] is not None
    assert body["previous_invoice_id"] is not None
    assert body["next_invoice_id"] is not None


def test_detail_404_for_an_unknown_id(signed_in) -> None:
    assert signed_in.get(f"/invoices/{uuid.uuid4()}").status_code == 404


# --- decisions ---------------------------------------------------------------
def test_approving_a_suspicious_invoice_without_verified_fails(signed_in, temp_invoice) -> None:
    invoice_id = temp_invoice(status="suspicious", risk_score=87)

    response = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "approve", "verified": False}
    )
    assert response.status_code == 422
    assert "verified" in response.json()["detail"].lower()

    # And the invoice is untouched.
    assert signed_in.get(f"/invoices/{invoice_id}").json()["decision"] == "pending"


def test_approving_a_suspicious_invoice_with_verified_succeeds(signed_in, temp_invoice) -> None:
    invoice_id = temp_invoice(status="suspicious", risk_score=87)
    response = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "approve", "verified": True}
    )
    assert response.status_code == 200
    assert response.json()["invoice"]["decision"] == "approved"


def test_approving_a_normal_invoice_needs_no_verification(signed_in, temp_invoice) -> None:
    invoice_id = temp_invoice(status="normal")
    response = signed_in.post(f"/invoices/{invoice_id}/decision", json={"action": "approve"})
    assert response.status_code == 200


@pytest.mark.parametrize("action", ["reject", "escalate"])
def test_a_note_is_required_to_reject_or_escalate(signed_in, temp_invoice, action: str) -> None:
    invoice_id = temp_invoice()

    blank = signed_in.post(f"/invoices/{invoice_id}/decision", json={"action": action, "note": "   "})
    assert blank.status_code == 422

    missing = signed_in.post(f"/invoices/{invoice_id}/decision", json={"action": action})
    assert missing.status_code == 422

    ok = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": action, "note": "Could not verify."}
    )
    assert ok.status_code == 200


def test_deciding_twice_is_refused(signed_in, temp_invoice) -> None:
    """A decision records what a person decided; overwriting would erase that."""
    invoice_id = temp_invoice(status="normal")

    first = signed_in.post(f"/invoices/{invoice_id}/decision", json={"action": "approve"})
    assert first.status_code == 200

    second = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "reject", "note": "changed my mind"}
    )
    assert second.status_code == 409
    assert "already" in second.json()["detail"].lower()


def test_a_decision_writes_an_audit_entry(signed_in, temp_invoice, auth_user) -> None:
    invoice_id = temp_invoice()
    body = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "escalate", "note": "Second pair of eyes."}
    ).json()

    assert body["audit_entry"]["action"] == "invoice_escalated"
    assert body["audit_entry"]["note"] == "Second pair of eyes."
    assert body["audit_entry"]["user_email"] == auth_user.email

    timeline = signed_in.get(f"/invoices/{invoice_id}").json()["timeline"]
    assert any(e["action"] == "invoice_escalated" for e in timeline)


def test_an_unknown_action_is_rejected(signed_in, temp_invoice) -> None:
    invoice_id = temp_invoice()
    assert signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "shred"}
    ).status_code == 422


def test_deciding_an_unknown_invoice_is_404(signed_in) -> None:
    response = signed_in.post(f"/invoices/{uuid.uuid4()}/decision", json={"action": "approve"})
    assert response.status_code == 404


def test_approving_a_bank_change_updates_the_vendor(signed_in, temp_invoice, abc_vendor) -> None:
    """An approved change is a confirmed one, so the vendor record follows."""
    from app.database import SessionLocal
    from app.models import Vendor, VendorBankHistory

    original_account = abc_vendor["bank_account"]
    new_account = "77665544332211"

    invoice_id = temp_invoice(
        vendor_id=abc_vendor["id"], bank_account=new_account, ifsc="KKBK0007781",
        status="suspicious", risk_score=87,
    )
    # Analysing raises the bank_account_changed flag the decision looks for.
    signed_in.post(f"/invoices/{invoice_id}/analyse")

    try:
        body = signed_in.post(
            f"/invoices/{invoice_id}/decision",
            json={"action": "approve", "verified": True, "note": "Confirmed by phone."},
        ).json()

        assert body["vendor_bank_updated"] is True

        with SessionLocal() as db:
            vendor = db.get(Vendor, abc_vendor["id"])
            assert vendor.bank_account == new_account
            assert vendor.ifsc == "KKBK0007781"

            history = (
                db.query(VendorBankHistory)
                .filter(VendorBankHistory.vendor_id == abc_vendor["id"])
                .order_by(VendorBankHistory.changed_on.desc())
                .all()
            )
            latest = history[0]
            assert latest.new_account == new_account
            assert latest.old_account == original_account
            assert latest.verified is True, "an approved change is a confirmed one"
    finally:
        # Put the vendor back exactly as it was.
        with SessionLocal() as db:
            vendor = db.get(Vendor, abc_vendor["id"])
            vendor.bank_account = original_account
            vendor.ifsc = abc_vendor["ifsc"]
            db.query(VendorBankHistory).filter(
                VendorBankHistory.vendor_id == abc_vendor["id"],
                VendorBankHistory.new_account == new_account,
            ).delete(synchronize_session=False)
            db.commit()


def test_rejecting_a_bank_change_leaves_the_vendor_alone(signed_in, temp_invoice, abc_vendor) -> None:
    from app.database import SessionLocal
    from app.models import Vendor

    invoice_id = temp_invoice(
        vendor_id=abc_vendor["id"], bank_account="99887766554433",
        status="suspicious", risk_score=87,
    )
    signed_in.post(f"/invoices/{invoice_id}/analyse")

    body = signed_in.post(
        f"/invoices/{invoice_id}/decision", json={"action": "reject", "note": "Not authorised."}
    ).json()

    assert body["vendor_bank_updated"] is False
    with SessionLocal() as db:
        assert db.get(Vendor, abc_vendor["id"]).bank_account == abc_vendor["bank_account"]


# --- vendors -----------------------------------------------------------------
def test_vendor_list_shape(signed_in) -> None:
    body = signed_in.get("/vendors").json()
    assert body["rows"]
    assert set(body["counts"]) == {"all", "trusted", "new", "flagged"}

    row = body["rows"][0]
    for key in (
        "name", "gstin", "email_domain", "invoice_count", "average_amount",
        "last_invoice_date", "flagged_count", "is_trusted", "bank_changed_recently",
    ):
        assert key in row
    assert isinstance(row["average_amount"], str)
    assert "bank_account" not in row, "the list never carries an account number"


@pytest.mark.parametrize("which", ["all", "trusted", "new", "flagged"])
def test_vendor_filters(signed_in, which: str) -> None:
    body = signed_in.get("/vendors", params={"filter": which}).json()
    assert body["total"] == body["counts"][which]
    if which == "trusted":
        assert all(r["is_trusted"] for r in body["rows"])
    if which == "flagged":
        assert all(r["flagged_count"] > 0 for r in body["rows"])


def test_vendor_search(signed_in) -> None:
    body = signed_in.get("/vendors", params={"search": "ABC"}).json()
    assert body["total"] >= 1
    assert any("abc" in r["name"].lower() for r in body["rows"])


def test_an_unknown_vendor_sort_is_rejected(signed_in) -> None:
    assert signed_in.get("/vendors", params={"sort": "bank_account"}).status_code == 422


def test_vendor_detail(signed_in, abc_vendor) -> None:
    body = signed_in.get(f"/vendors/{abc_vendor['id']}").json()

    assert body["name"] == "ABC Technologies"
    assert set(body["stats"]) == {
        "total_invoices", "total_value", "average_amount", "flagged_count"
    }
    assert isinstance(body["stats"]["total_value"], str)
    # Masked here: there is no digit-by-digit comparison on this page.
    assert body["bank"]["account_masked"].startswith("•")
    assert abc_vendor["bank_account"] not in str(body)
    assert isinstance(body["trend"], list)
    for point in body["trend"]:
        assert isinstance(point["amount"], str)
        assert "outlier" in point
    for change in body["bank_history"]:
        assert change["old_account_masked"].startswith("•") or change["old_account_masked"] == "—"


def test_vendor_detail_404(signed_in) -> None:
    assert signed_in.get(f"/vendors/{uuid.uuid4()}").status_code == 404


def test_trust_toggle_writes_an_audit_entry(signed_in, abc_vendor, auth_user) -> None:
    from app.database import SessionLocal
    from app.models import Vendor

    original = abc_vendor["is_trusted"]
    try:
        body = signed_in.patch(
            f"/vendors/{abc_vendor['id']}/trust", json={"is_trusted": not original}
        ).json()
        assert body["is_trusted"] is (not original)
        assert body["audit_entry"]["action"] in ("vendor_trusted", "vendor_untrusted")
        assert body["audit_entry"]["user_email"] == auth_user.email

        with SessionLocal() as db:
            assert db.get(Vendor, abc_vendor["id"]).is_trusted is (not original)
    finally:
        signed_in.patch(f"/vendors/{abc_vendor['id']}/trust", json={"is_trusted": original})


def test_trust_404(signed_in) -> None:
    response = signed_in.patch(f"/vendors/{uuid.uuid4()}/trust", json={"is_trusted": True})
    assert response.status_code == 404


# --- payment checker ---------------------------------------------------------
def test_checker_scores_a_lookalike_bank_change(signed_in, abc_vendor) -> None:
    body = signed_in.post(
        "/payment-checker/analyse",
        json={
            "from_email": "rajesh@abctechnoIogies.com",
            "subject": "URGENT: updated bank details",
            "body": (
                "Please note we have changed our bank. Remit to new account "
                "9184 7263 5100 94, IFSC KKBK0007781, today itself. "
                "Keep this strictly confidential."
            ),
        },
    ).json()

    assert body["request_type"] == "bank_change"
    assert body["risk_score"] == sum(f["points"] for f in body["flags"])
    assert body["status"] in ("needs_review", "suspicious")

    codes = {f["code"] for f in body["flags"]}
    assert "urgency_language" in codes
    assert any(f["points"] == 15 for f in body["flags"] if f["code"] == "urgency_language")

    # The offsets must index into the text the response returns.
    assert body["highlights"]
    for hit in body["highlights"]:
        assert body["text"][hit["start"] : hit["end"]] == hit["phrase"]
        assert hit["reason"]

    # The account found in the text is masked; this screen compares nothing.
    assert body["extracted_account"].startswith("•")
    assert body["extracted_ifsc"] == "KKBK0007781"
    assert body["recommendation"]["verdict"]


def test_checker_is_calm_about_a_harmless_message(signed_in, abc_vendor) -> None:
    body = signed_in.post(
        "/payment-checker/analyse",
        json={
            "from_email": f"accounts@{abc_vendor['email_domain']}",
            "subject": "Invoice ABC/2026/0820 receipt",
            "body": "Thank you for settling the invoice last week. No change to any of our details.",
        },
    ).json()

    assert body["risk_score"] == 0
    assert body["status"] == "normal"
    assert body["flags"] == []
    assert body["highlights"] == []


def test_checker_flags_an_unknown_sender_as_a_new_vendor(signed_in) -> None:
    body = signed_in.post(
        "/payment-checker/analyse",
        json={
            "from_email": "someone@nobody-we-know-at-all.example",
            "subject": "Payment",
            "body": "Please pay the attached invoice.",
        },
    ).json()
    assert "new_vendor" in {f["code"] for f in body["flags"]}


def test_checker_requires_a_sender_and_a_body(signed_in) -> None:
    assert signed_in.post(
        "/payment-checker/analyse", json={"from_email": "", "body": "hello"}
    ).status_code == 422
    assert signed_in.post(
        "/payment-checker/analyse", json={"from_email": "a@b.in", "body": "   "}
    ).status_code == 422


def test_checker_reuses_the_same_scorer(signed_in, abc_vendor) -> None:
    """The score must be the sum of the flags, exactly as elsewhere."""
    body = signed_in.post(
        "/payment-checker/analyse",
        json={
            "from_email": "x@abctechnoIogies.com",
            "subject": "urgent",
            "body": "new account 9184 7263 5100 94 immediately",
        },
    ).json()
    assert body["risk_score"] == sum(f["points"] for f in body["flags"])
    assert body["risk_score"] <= 100
