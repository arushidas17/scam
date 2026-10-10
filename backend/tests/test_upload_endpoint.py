"""
POST /invoices/upload and PATCH /invoices/{id}/fields.

Gemini and Supabase Storage are both replaced with fakes, so these run with no
network. They do use the real database.
"""

import json
import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import storage
from app.services.extraction import ExtractionFailed
from tests.test_extraction import GOOD

PDF = b"%PDF-1.4\n" + b"x" * 400
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 400
JPEG = b"\xff\xd8\xff\xe0" + b"x" * 400


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


@pytest.fixture(autouse=True)
def fake_explanation(monkeypatch):
    """
    Upload now scores the invoice automatically, which calls the explanation
    model. Stub it so these tests stay offline; the scoring itself is real.
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


@pytest.fixture(autouse=True)
def fake_storage(monkeypatch):
    """Never touch Supabase Storage from a test."""
    uploaded: dict[str, bytes] = {}

    def _upload(data, mime_type, path=None):
        key = path or f"{uuid.uuid4()}.bin"
        uploaded[key] = data
        return storage.StoredFile(path=key, mime_type=mime_type, size_bytes=len(data))

    monkeypatch.setattr(storage, "ensure_bucket", lambda: None)
    monkeypatch.setattr(storage, "upload", _upload)
    monkeypatch.setattr(storage, "signed_url", lambda path, expires_in=None: f"https://example.test/{path}?token=fake")
    monkeypatch.setattr(storage, "delete", lambda path: None)
    return uploaded


def _fake_gemini(payload: str):
    """A client whose interactions.create returns `payload`."""
    return SimpleNamespace(
        interactions=SimpleNamespace(create=lambda **kw: SimpleNamespace(output_text=payload))
    )


@pytest.fixture
def good_extraction(monkeypatch):
    monkeypatch.setattr(
        "app.routers.invoices.extract_invoice",
        lambda data, mime, **kw: __import__(
            "app.services.extraction", fromlist=["extract_invoice"]
        ).extract_invoice(data, mime, client=_fake_gemini(json.dumps(GOOD))),
    )


def _skip_without_db(db_available: bool) -> None:
    if not db_available:
        pytest.skip("database not reachable")


# --- rejection paths, which need no database ---------------------------------

def test_a_text_file_is_rejected_even_with_a_pdf_name(client: TestClient) -> None:
    """The bytes decide, not the filename or the declared content type."""
    response = client.post(
        "/invoices/upload",
        files={"file": ("invoice.pdf", b"just some text", "application/pdf")},
    )
    assert response.status_code == 415
    assert "contents were checked" in response.json()["detail"]


def test_an_oversized_file_is_rejected(client: TestClient) -> None:
    oversized = b"%PDF-1.4" + b"x" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/invoices/upload",
        files={"file": ("big.pdf", oversized, "application/pdf")},
    )
    assert response.status_code == 413
    assert "10MB" in response.json()["detail"]


def test_an_empty_file_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/invoices/upload", files={"file": ("empty.pdf", b"", "application/pdf")}
    )
    assert response.status_code == 400


# --- the happy path ----------------------------------------------------------

@pytest.mark.parametrize("name, body", [("a.pdf", PDF), ("b.png", PNG), ("c.jpg", JPEG)])
def test_accepted_types_are_stored_and_extracted(
    client: TestClient, db_available: bool, good_extraction, name: str, body: bytes
) -> None:
    _skip_without_db(db_available)
    response = client.post("/invoices/upload", files={"file": (name, body, "application/octet-stream")})
    assert response.status_code == 201, response.text

    payload = response.json()
    # The risk engine runs straight after extraction, so the status is now the
    # band the score earned rather than the "pending_review" it was stored with.
    assert payload["status"] in ("normal", "needs_review", "suspicious")
    assert payload["decision"] == "pending"
    assert payload["analysis"] is not None, "an uploaded invoice comes back scored"
    assert payload["analysis"]["risk_score"] == sum(
        f["points"] for f in payload["analysis"]["flags"]
    )
    assert payload["document_url"].startswith("https://")
    assert len(payload["fields"]) == 11
    assert {f["name"] for f in payload["fields"]} >= {"vendor_name", "amount", "gstin"}
    for field in payload["fields"]:
        assert 0.0 <= field["confidence"] <= 1.0


def test_the_saved_row_matches_what_was_returned(
    client: TestClient, db_available: bool, good_extraction
) -> None:
    _skip_without_db(db_available)
    payload = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()

    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        invoice = db.get(Invoice, uuid.UUID(payload["invoice_id"]))
        assert invoice is not None
        assert invoice.decision == "pending"
        # The pipeline has run, so these are now populated.
        assert invoice.risk_score is not None
        assert invoice.status == payload["analysis"]["status"]
        assert invoice.vendor_name == "ABC Technologies"
        assert str(invoice.amount) == "486500.00"
        assert invoice.gstin == "27AABCA1234K1Z5"
        # The untouched model answer is kept for comparison later.
        assert invoice.raw_extraction["response"]["amount"] == GOOD["amount"]
        assert invoice.field_confidence["amount"] == pytest.approx(0.96)


def test_warnings_are_reported_separately_from_fields(
    client: TestClient, db_available: bool, monkeypatch
) -> None:
    _skip_without_db(db_available)
    bad = {**GOOD, "gstin": "NOTAGSTIN", "ifsc": "NOPE"}
    monkeypatch.setattr(
        "app.routers.invoices.extract_invoice",
        lambda data, mime, **kw: __import__(
            "app.services.extraction", fromlist=["extract_invoice"]
        ).extract_invoice(data, mime, client=_fake_gemini(json.dumps(bad))),
    )
    payload = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()
    codes = {w["code"] for w in payload["warnings"]}
    assert {"gstin_format", "ifsc_format"} <= codes


# --- extraction failure ------------------------------------------------------

def test_a_failed_extraction_returns_422_but_keeps_the_file(
    client: TestClient, db_available: bool, monkeypatch
) -> None:
    _skip_without_db(db_available)

    def _fail(data, mime, **kw):
        raise ExtractionFailed("could not be read", raw="garbage")

    monkeypatch.setattr("app.routers.invoices.extract_invoice", _fail)

    response = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")})
    assert response.status_code == 422

    detail = response.json()["detail"]
    assert detail["invoice_id"], "a row is kept so nothing is silently lost"
    assert detail["document_url"], "the stored file is still reachable"
    assert detail["status"] == "extraction_failed"

    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        invoice = db.get(Invoice, uuid.UUID(detail["invoice_id"]))
        assert invoice.status == "extraction_failed"
        assert invoice.extraction_error
        assert invoice.storage_path


# --- PATCH /invoices/{id}/fields ---------------------------------------------

def test_corrections_are_saved_and_raw_extraction_is_untouched(
    client: TestClient, db_available: bool, good_extraction
) -> None:
    _skip_without_db(db_available)
    invoice_id = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()["invoice_id"]

    response = client.patch(
        f"/invoices/{invoice_id}/fields",
        json={"vendor_name": "  ABC   Technologies Pvt Ltd ", "amount": "₹ 5,00,000", "gstin": "27aabca1234k1z5"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert set(body["changed_fields"]) == {"vendor_name", "amount"}, "gstin was already that value"
    assert body["invoice"]["vendor_name"] == "ABC Technologies Pvt Ltd"
    # NUMERIC(14,2) round-trips with its scale, so the string carries paise.
    assert Decimal(body["invoice"]["amount"]) == Decimal("500000")

    from app.database import SessionLocal
    from app.models import Invoice

    with SessionLocal() as db:
        invoice = db.get(Invoice, uuid.UUID(invoice_id))
        # The original model output must survive the correction.
        assert invoice.raw_extraction["response"]["amount"] == GOOD["amount"]
        assert invoice.raw_extraction["response"]["vendor_name"] == "ABC Technologies"


def test_an_explicit_null_clears_a_field(
    client: TestClient, db_available: bool, good_extraction
) -> None:
    _skip_without_db(db_available)
    invoice_id = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()["invoice_id"]

    response = client.patch(f"/invoices/{invoice_id}/fields", json={"gstin": None})
    assert response.status_code == 200
    assert response.json()["invoice"]["gstin"] is None


def test_every_field_can_be_cleared(
    client: TestClient, db_available: bool, good_extraction
) -> None:
    """
    Every extracted field is optional, because real documents are incomplete.

    `amount` and `invoice_number` are NOT NULL in the schema, so clearing them
    falls back to the same placeholders the upload path already uses for a
    document they could not be read from — rather than refusing the save and
    stranding the reviewer.
    """
    _skip_without_db(db_available)
    invoice_id = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()["invoice_id"]

    # The fields a receipt genuinely lacks clear to null.
    optional = client.patch(
        f"/invoices/{invoice_id}/fields",
        json={"bank_account": None, "ifsc": None, "sender_email": None, "gstin": None},
    )
    assert optional.status_code == 200
    for field in ("bank_account", "ifsc", "sender_email", "gstin"):
        assert optional.json()["invoice"][field] is None

    # The two NOT NULL columns are accepted and fall back rather than erroring.
    amount = client.patch(f"/invoices/{invoice_id}/fields", json={"amount": None})
    assert amount.status_code == 200
    assert Decimal(amount.json()["invoice"]["amount"]) == Decimal("0")

    number = client.patch(f"/invoices/{invoice_id}/fields", json={"invoice_number": None})
    assert number.status_code == 200
    assert number.json()["invoice"]["invoice_number"].startswith("UNNUMBERED-")


def test_patching_an_unknown_invoice_is_404(client: TestClient, db_available: bool) -> None:
    _skip_without_db(db_available)
    response = client.patch(f"/invoices/{uuid.uuid4()}/fields", json={"gstin": "27AABCA1234K1Z5"})
    assert response.status_code == 404


def test_unknown_fields_are_rejected(client: TestClient, db_available: bool, good_extraction) -> None:
    _skip_without_db(db_available)
    invoice_id = client.post("/invoices/upload", files={"file": ("a.pdf", PDF, "x")}).json()["invoice_id"]
    assert client.patch(f"/invoices/{invoice_id}/fields", json={"risk_score": 0}).status_code == 422
