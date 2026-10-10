"""Invoice upload and field correction."""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import Invoice
from app.schemas.invoice import (
    AnalysisResponse,
    InvoiceFieldsUpdate,
    InvoiceRead,
    InvoiceUpdateResponse,
    UploadResponse,
)
from app.services import filetype, storage
from app.services.extraction import ExtractionFailed, extract_invoice, raw_payload
from app.services.normalise import (
    normalise_amount,
    normalise_code,
    normalise_date,
    normalise_email,
    normalise_text,
    to_date,
)
from app.services.pipeline import analyse_invoice
from app.services.validation import check_fields

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["invoices"])

# Applied to a user's correction so a hand-typed value is stored exactly like
# an extracted one.
NORMALISERS = {
    "vendor_name": normalise_text,
    "invoice_number": normalise_text,
    "invoice_date": normalise_date,
    "due_date": normalise_date,
    "amount": normalise_amount,
    "gst_amount": normalise_amount,
    "gstin": normalise_code,
    "bank_account": normalise_code,
    "ifsc": normalise_code,
    "sender_email": normalise_email,
    "currency": normalise_code,
}

DATE_FIELDS = ("invoice_date", "due_date")


async def _read_upload(file: UploadFile, limit: int) -> bytes:
    """
    Read the body, refusing anything over the limit.

    Read in chunks and stop at the limit rather than trusting
    ``content-length``: the header is client-supplied, so a small declared size
    must not let a large body through.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"That file is larger than {limit // (1024 * 1024)}MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _fields_for_validation(source: dict[str, Any]) -> dict[str, Any]:
    """check_fields wants plain values, not Decimals or dates."""
    return {
        key: (str(value) if isinstance(value, Decimal) else value)
        for key, value in source.items()
    }


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an invoice, store it, and read its fields",
)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> UploadResponse:
    settings = get_settings()

    data = await _read_upload(file, settings.max_upload_bytes)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file was empty."
        )

    # The real type, from the bytes — not the filename or the declared header.
    mime_type = filetype.sniff(data)
    if mime_type not in filetype.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"That file is not a {filetype.describe_allowed()}. "
                "The file's contents were checked, not its name."
            ),
        )

    # Store first: if extraction then fails, the document is still safe.
    # Everything below is blocking I/O — Supabase Storage over sync httpx, the
    # Gemini SDK, and the risk engine. Running it directly in this async
    # endpoint would park the event loop and stall every other request in the
    # process, so each slow step is handed to the threadpool.
    try:
        await run_in_threadpool(storage.ensure_bucket)
        stored = await run_in_threadpool(storage.upload, data, mime_type)
    except storage.StorageError as exc:
        logger.error("Storage upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The file could not be stored. Nothing was saved; try again.",
        ) from exc

    document_url = await run_in_threadpool(storage.signed_url, stored.path)

    try:
        result = await run_in_threadpool(extract_invoice, data, mime_type)
    except ExtractionFailed as exc:
        # Keep the file and record the failure, so nothing is silently lost.
        invoice = Invoice(
            invoice_number=f"UNREAD-{uuid.uuid4().hex[:8].upper()}",
            amount=Decimal("0"),
            file_url=document_url,
            storage_path=stored.path,
            raw_extraction=raw_payload(exc.raw),
            extraction_error=str(exc),
            risk_score=None,
            status="extraction_failed",
            decision="pending",
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "message": str(exc),
                "invoice_id": str(invoice.id),
                "document_url": document_url,
                "status": invoice.status,
            },
        ) from exc

    fields = result.fields
    warnings = check_fields(_fields_for_validation(fields))

    invoice = Invoice(
        # Vendor matching is a later task; the name is kept as printed.
        vendor_id=None,
        vendor_name=fields.get("vendor_name"),
        # An invoice with no readable number still has to be stored and chased.
        invoice_number=fields.get("invoice_number") or f"UNNUMBERED-{uuid.uuid4().hex[:8].upper()}",
        invoice_date=to_date(fields.get("invoice_date")),
        due_date=to_date(fields.get("due_date")),
        amount=fields.get("amount") if fields.get("amount") is not None else Decimal("0"),
        gst_amount=fields.get("gst_amount"),
        gstin=fields.get("gstin"),
        bank_account=fields.get("bank_account"),
        ifsc=fields.get("ifsc"),
        sender_email=fields.get("sender_email"),
        currency=fields.get("currency") or "INR",
        file_url=document_url,
        storage_path=stored.path,
        raw_extraction=raw_payload(result),
        field_confidence=result.confidence,
        risk_score=None,            # the risk engine has not run
        status="pending_review",
        decision="pending",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Score it straight away, so an uploaded invoice comes back ready to review.
    # A failure here must not lose the upload: the row and the file are already
    # saved, and /invoices/{id}/analyse can be called again.
    analysis = None
    try:
        analysis = AnalysisResponse(
            **(await run_in_threadpool(analyse_invoice, invoice.id, db)).as_dict()
        )
        db.refresh(invoice)
    except Exception:  # noqa: BLE001
        logger.exception("Analysis failed for invoice %s; it was stored unscored.", invoice.id)

    return UploadResponse(
        invoice_id=invoice.id,
        status=invoice.status,
        decision=invoice.decision,
        fields=result.as_field_list(),
        warnings=warnings,
        document_url=document_url,
        analysis=analysis,
    )


@router.patch(
    "/{invoice_id}/fields",
    response_model=InvoiceUpdateResponse,
    summary="Save the reviewer's corrections to the extracted fields",
)
def update_invoice_fields(
    invoice_id: uuid.UUID,
    payload: InvoiceFieldsUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> InvoiceUpdateResponse:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That invoice could not be found."
        )

    # exclude_unset so an omitted field is left alone, while an explicit null
    # clears a value the model got wrong.
    submitted = payload.model_dump(exclude_unset=True)
    if not submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields were submitted."
        )

    changed: list[str] = []
    for key, raw_value in submitted.items():
        value = NORMALISERS[key](raw_value) if raw_value is not None else None
        if key in DATE_FIELDS:
            value = to_date(value) if value else None
        # Every extracted field is optional: real documents are routinely
        # incomplete, and a reviewer must be able to save one that is. The two
        # columns below are NOT NULL in the schema, so a cleared value falls
        # back to the same placeholder the upload path already uses for a
        # document these could not be read from.
        if key == "invoice_number" and not value:
            value = f"UNNUMBERED-{uuid.uuid4().hex[:8].upper()}"
        if key == "amount" and value is None:
            # Zero rather than null, because the column is NOT NULL. The risk
            # engine treats a non-positive amount as "nothing to compare", so
            # this does not score as a suspiciously cheap invoice.
            value = Decimal("0")
        if getattr(invoice, key) != value:
            setattr(invoice, key, value)
            changed.append(key)

    # raw_extraction is deliberately untouched: the model's original answer and
    # the corrected values must stay comparable.
    db.commit()
    db.refresh(invoice)

    warnings = check_fields(
        _fields_for_validation(
            {
                "gstin": invoice.gstin,
                "ifsc": invoice.ifsc,
                "amount": invoice.amount,
                "gst_amount": invoice.gst_amount,
                "invoice_date": invoice.invoice_date,
                "due_date": invoice.due_date,
            }
        )
    )

    return InvoiceUpdateResponse(
        invoice=InvoiceRead.model_validate(invoice),
        warnings=warnings,
        changed_fields=changed,
    )


@router.post(
    "/{invoice_id}/analyse",
    response_model=AnalysisResponse,
    summary="Score an invoice against the risk rules",
)
def analyse(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> AnalysisResponse:
    """
    Re-run the risk engine over a stored invoice.

    Safe to call repeatedly: the previous flags are replaced, not added to, so
    re-analysing after a correction gives the score the corrected fields earn.
    """
    try:
        analysis = analyse_invoice(invoice_id, db)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That invoice could not be found."
        ) from exc

    return AnalysisResponse(**analysis.as_dict())
