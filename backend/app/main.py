"""Fraud Guardian API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    dashboard,
    health,
    invoice_queries,
    invoices,
    payment_checker,
    vendor_queries,
)

settings = get_settings()

app = FastAPI(
    title="Fraud Guardian API",
    version="0.1.0",
    summary="Invoice and payment fraud detection for finance teams.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    # Named explicitly rather than "*": with allow_credentials the spec forbids
    # the wildcard, and some stacks answer a credentialed preflight with 400
    # when it is used.
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)

app.include_router(health.router)          # public
app.include_router(dashboard.router)
# The upload/extraction routes, then the read side. Both carry the /invoices
# prefix; FastAPI matches in registration order, so the literal "/upload" path
# is registered before "/{invoice_id}" and cannot be swallowed by it.
app.include_router(invoices.router)
app.include_router(invoice_queries.router)
app.include_router(vendor_queries.router)
app.include_router(payment_checker.router)
