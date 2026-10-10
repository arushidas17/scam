"""
Seed the database with fictional vendors and invoices.

Run with ``python -m app.seed``. Idempotent: vendors are matched on their
GSTIN and invoices on (vendor, invoice_number), so running it twice changes
nothing. Pass ``--reset`` to clear seeded data first.

Everything here is invented. The GSTINs, bank accounts and IFSC codes are
correctly *formatted* but belong to no real entity.
"""

from __future__ import annotations

import argparse
import random
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Invoice, RiskFlag, Vendor, VendorBankHistory

# A fixed seed keeps the data identical on every run, so the numbers on screen
# are stable while the front end is being built against them.
RNG = random.Random(20261006)

TODAY = date.today()
SIX_MONTHS = 183


@dataclass(frozen=True)
class VendorSpec:
    name: str
    gstin: str
    email_domain: str
    bank_account: str
    ifsc: str
    typical: int          # the vendor's own average invoice, in rupees
    spread: float         # how tightly its invoices cluster around that
    is_trusted: bool
    invoices: int


# Eight clearly fictional Indian vendors. Each has its own price level, so an
# unusually large invoice stands out against that vendor rather than globally.
VENDORS: tuple[VendorSpec, ...] = (
    VendorSpec("ABC Technologies", "27AABCA1234K1Z5", "abctechnologies.com",
               "50100294817732", "HDFC0004512", 340_000, 0.10, True, 18),
    VendorSpec("Meridian Supplies Pvt Ltd", "27AADCM4821K1ZP", "meridiansupplies.in",
               "50100288110045", "HDFC0001188", 186_000, 0.12, True, 16),
    VendorSpec("Kaveri Packaging Industries", "29AAFCK9087L1ZR", "kaveripack.in",
               "91847263510094", "KKBK0007781", 72_500, 0.15, True, 20),
    VendorSpec("Deccan Freight Carriers", "36AAGCD5512M1ZB", "deccanfreight.in",
               "33027154890061", "ICIC0003304", 48_000, 0.18, False, 19),
    VendorSpec("Shakti Power Systems", "24AAHCS7741N1ZQ", "shaktipower.in",
               "20118834770052", "SBIN0012345", 415_000, 0.09, True, 12),
    VendorSpec("Nilgiri Catering Services", "33AAJCN3398P1ZT", "nilgiricatering.in",
               "60455120983317", "UTIB0001209", 31_500, 0.20, False, 20),
    VendorSpec("Vertex Software Labs", "29AAKCV6620Q1ZH", "vertexlabs.io",
               "77210045691138", "IDFB0040101", 268_000, 0.11, True, 14),
    VendorSpec("Coastal Marine Supplies", "32AALCC8814R1ZD", "coastalmarine.in",
               "41900276653028", "PUNB0221500", 124_000, 0.14, False, 15),
)

# Older invoices that should not be clean, so the dashboard has something to
# show. Keyed by vendor name; each entry says how far back to place it and what
# the finding was. Points sum to the risk score, the invariant the UI relies on.
FLAGGED = (
    {
        "vendor": "Kaveri Packaging Industries",
        "days_ago": 96,
        "multiplier": 3.4,
        "status": "suspicious",
        "sender_domain": "kaveripak.in",      # one character short of the real one
        "bank_account": "58871203349902",     # not the account on record
        "flags": [
            ("bank_account_changed", "Bank account changed", 40,
             "The payout account on this invoice does not match the one this vendor was last paid on."),
            ("lookalike_domain", "Lookalike email domain", 28,
             "The sender's domain differs from the vendor's registered domain by one character."),
            ("amount_above_average", "Amount above vendor average", 17,
             "The total sits well outside this vendor's usual range."),
        ],
    },
    {
        "vendor": "Deccan Freight Carriers",
        "days_ago": 134,
        "multiplier": 2.8,
        "status": "suspicious",
        "sender_domain": None,
        "bank_account": "70044119928375",
        "flags": [
            ("bank_account_changed", "Bank account changed", 38,
             "The payout account on this invoice does not match the one this vendor was last paid on."),
            ("urgency_pressure", "Urgent payment pressure", 19,
             "The covering email pushed for same-day payment."),
            ("amount_above_average", "Amount above vendor average", 14,
             "The total sits well outside this vendor's usual range."),
        ],
    },
    {
        "vendor": "Nilgiri Catering Services",
        "days_ago": 61,
        "multiplier": 2.1,
        "status": "needs_review",
        "sender_domain": None,
        "bank_account": None,
        "flags": [
            ("amount_above_average", "Amount above vendor average", 31,
             "The total sits well outside this vendor's usual range."),
            ("tax_mismatch", "Tax total does not reconcile", 18,
             "The GST shown does not match any standard rate applied to the total."),
        ],
    },
    {
        "vendor": "Coastal Marine Supplies",
        "days_ago": 150,
        "multiplier": 1.1,
        "status": "needs_review",
        "sender_domain": None,
        "bank_account": None,
        "flags": [
            ("duplicate_invoice", "Duplicate invoice", 34,
             "An invoice with the same vendor and total was already received this month."),
            ("ifsc_changed", "IFSC changed since last payment", 12,
             "The branch code differs from the one used for the last settled payment."),
        ],
    },
    {
        "vendor": "Meridian Supplies Pvt Ltd",
        "days_ago": 118,
        "multiplier": 1.3,
        "status": "needs_review",
        "sender_domain": None,
        "bank_account": None,
        "flags": [
            ("gstin_mismatch", "GSTIN mismatch", 25,
             "The GSTIN on this invoice does not match the one recorded against the vendor."),
            ("new_vendor_contact", "New contact address", 17,
             "This invoice came from an address not seen from this vendor before."),
        ],
    },
)

PREFIXES = {
    "ABC Technologies": "ABC",
    "Meridian Supplies Pvt Ltd": "MS",
    "Kaveri Packaging Industries": "KP",
    "Deccan Freight Carriers": "DFC",
    "Shakti Power Systems": "SPS",
    "Nilgiri Catering Services": "NCS",
    "Vertex Software Labs": "VSL",
    "Coastal Marine Supplies": "CMS",
}


def _money(value: float) -> Decimal:
    """Round to paise. Money is Decimal end to end; floats never reach the DB."""
    return Decimal(str(round(value, 2)))


def _amount_for(spec: VendorSpec) -> Decimal:
    """An amount clustered around this vendor's own typical invoice."""
    value = RNG.gauss(spec.typical, spec.typical * spec.spread)
    value = max(spec.typical * 0.45, value)
    return _money(round(value / 50) * 50)


def upsert_vendors(db: Session) -> dict[str, Vendor]:
    """Create any vendor whose GSTIN is not already present."""
    existing = {v.gstin: v for v in db.scalars(select(Vendor)).all()}
    vendors: dict[str, Vendor] = {}

    for spec in VENDORS:
        vendor = existing.get(spec.gstin)
        if vendor is None:
            vendor = Vendor(
                name=spec.name,
                gstin=spec.gstin,
                email_domain=spec.email_domain,
                bank_account=spec.bank_account,
                ifsc=spec.ifsc,
                is_trusted=spec.is_trusted,
            )
            db.add(vendor)
            db.flush()
        vendors[spec.name] = vendor

    return vendors


def seed_bank_history(db: Session, vendors: dict[str, Vendor]) -> int:
    """
    A couple of vendors changed details in the past.

    ABC Technologies is deliberately left out: the demo depends on its account
    being unchanged, so a later change stands out against a clean record.
    """
    changes = (
        ("Kaveri Packaging Industries", 92, "48820017734411", "91847263510094",
         "ICIC0001122", "KKBK0007781", False),
        ("Deccan Freight Carriers", 130, "19002284471150", "33027154890061",
         "SBIN0009981", "ICIC0003304", True),
        ("Nilgiri Catering Services", 240, "88130024410097", "60455120983317",
         "UTIB0009087", "UTIB0001209", True),
    )

    added = 0
    for name, days_ago, old_acc, new_acc, old_ifsc, new_ifsc, verified in changes:
        vendor = vendors[name]
        changed_on = TODAY - timedelta(days=days_ago)
        already = db.scalar(
            select(func.count())
            .select_from(VendorBankHistory)
            .where(
                VendorBankHistory.vendor_id == vendor.id,
                VendorBankHistory.changed_on == changed_on,
            )
        )
        if already:
            continue
        db.add(
            VendorBankHistory(
                vendor_id=vendor.id,
                old_account=old_acc,
                new_account=new_acc,
                old_ifsc=old_ifsc,
                new_ifsc=new_ifsc,
                changed_on=changed_on,
                verified=verified,
            )
        )
        added += 1

    return added


def build_plan() -> list[dict]:
    """
    Decide every invoice up front, before touching the database.

    The whole plan is drawn from the seeded RNG in one fixed order, so it is
    identical on every run. That is what makes the seed idempotent: inserting
    is then just "add the rows whose numbers are not already there". Drawing
    inside the insert loop would shift the random sequence as soon as one row
    was skipped, and the second run would invent different invoices.
    """
    flagged_by_vendor: dict[str, list[dict]] = {}
    for entry in FLAGGED:
        flagged_by_vendor.setdefault(entry["vendor"], []).append(entry)

    plan: list[dict] = []

    for spec in VENDORS:
        prefix = PREFIXES[spec.name]
        specials = list(flagged_by_vendor.get(spec.name, []))
        step = SIX_MONTHS / spec.invoices

        for i in range(spec.invoices):
            jitter = RNG.randint(0, 3)
            amount = _amount_for(spec)
            baseline_score = RNG.randint(0, 12)

            days_ago = max(1, min(SIX_MONTHS, int(SIX_MONTHS - i * step) - jitter))
            invoice_date = TODAY - timedelta(days=days_ago)
            # No randomness in the number: it has to be stable across runs for
            # the "already present?" check to mean anything.
            number = f"{prefix}/{invoice_date.year}/{1000 + i * 7}"

            status = "normal"
            sender = f"accounts@{spec.email_domain}"
            bank_account = spec.bank_account
            flags: list[tuple[str, str, int, str]] = []

            # Attach a prepared finding to whichever invoice falls nearest its date.
            if specials and abs(days_ago - specials[0]["days_ago"]) <= step:
                entry = specials.pop(0)
                amount = _money(float(amount) * entry["multiplier"])
                status = entry["status"]
                flags = entry["flags"]
                if entry["sender_domain"]:
                    sender = f"accounts@{entry['sender_domain']}"
                if entry["bank_account"]:
                    bank_account = entry["bank_account"]

            plan.append(
                {
                    "vendor_name": spec.name,
                    "number": number,
                    "invoice_date": invoice_date,
                    "amount": amount,
                    "gstin": spec.gstin,
                    "bank_account": bank_account,
                    "ifsc": spec.ifsc,
                    "sender": sender,
                    # A flagged invoice scores exactly what its flags found.
                    "risk_score": sum(p for _, _, p, _ in flags) if flags else baseline_score,
                    "status": status,
                    "flags": flags,
                }
            )

    return plan


def seed_invoices(db: Session, vendors: dict[str, Vendor]) -> tuple[int, int]:
    """Insert the planned invoices that are not already stored."""
    present = {
        (vendor_id, number)
        for vendor_id, number in db.execute(
            select(Invoice.vendor_id, Invoice.invoice_number)
        ).all()
    }

    new_invoices = 0
    new_flags = 0

    for row in build_plan():
        vendor = vendors[row["vendor_name"]]
        if (vendor.id, row["number"]) in present:
            continue
        present.add((vendor.id, row["number"]))

        invoice = Invoice(
            vendor_id=vendor.id,
            # The name as it would appear on the document.
            vendor_name=vendor.name,
            invoice_number=row["number"],
            invoice_date=row["invoice_date"],
            due_date=row["invoice_date"] + timedelta(days=30),
            amount=row["amount"],
            gst_amount=_money(float(row["amount"]) * 0.18),
            gstin=row["gstin"],
            bank_account=row["bank_account"],
            ifsc=row["ifsc"],
            sender_email=row["sender"],
            file_url=None,
            raw_extraction=None,
            risk_score=row["risk_score"],
            status=row["status"],
            decision="pending",
        )
        db.add(invoice)
        db.flush()
        new_invoices += 1

        for code, title, points, message in row["flags"]:
            db.add(
                RiskFlag(
                    invoice_id=invoice.id,
                    code=code,
                    title=title,
                    message=message,
                    points=points,
                    evidence={"seeded": True, "vendor": row["vendor_name"]},
                )
            )
            new_flags += 1

    return new_invoices, new_flags


def refresh_vendor_aggregates(db: Session) -> None:
    """Recompute avg_amount and invoice_count from the invoices actually stored."""
    rows = db.execute(
        select(
            Invoice.vendor_id,
            func.count(Invoice.id),
            func.coalesce(func.avg(Invoice.amount), 0),
        )
        .where(Invoice.vendor_id.is_not(None))
        .group_by(Invoice.vendor_id)
    ).all()

    totals = {vendor_id: (count, avg) for vendor_id, count, avg in rows}

    for vendor in db.scalars(select(Vendor)).all():
        count, avg = totals.get(vendor.id, (0, Decimal("0")))
        vendor.invoice_count = count
        vendor.avg_amount = Decimal(avg).quantize(Decimal("0.01"))


def reset(db: Session) -> None:
    """Remove seeded rows. Cascades clear risk_flags and bank history."""
    db.query(RiskFlag).delete(synchronize_session=False)
    db.query(Invoice).delete(synchronize_session=False)
    db.query(VendorBankHistory).delete(synchronize_session=False)
    db.query(Vendor).delete(synchronize_session=False)
    db.commit()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed Fraud Guardian demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="delete existing vendors and invoices first"
    )
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        if args.reset:
            reset(db)
            print("Cleared existing vendors, invoices, flags and bank history.")

        vendors = upsert_vendors(db)
        history = seed_bank_history(db, vendors)
        invoices, flags = seed_invoices(db, vendors)
        refresh_vendor_aggregates(db)
        db.commit()

        counts = {
            "vendors": db.scalar(select(func.count()).select_from(Vendor)),
            "vendor_bank_history": db.scalar(select(func.count()).select_from(VendorBankHistory)),
            "invoices": db.scalar(select(func.count()).select_from(Invoice)),
            "risk_flags": db.scalar(select(func.count()).select_from(RiskFlag)),
        }

    print(f"Added this run: {len(vendors)} vendors checked, {invoices} invoices, "
          f"{flags} risk flags, {history} bank changes.")
    print("Row counts:")
    for table, count in counts.items():
        print(f"  {table:<22} {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
