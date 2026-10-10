from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.health import HealthRead

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthRead)
def health(db: Session = Depends(get_db)):
    """
    Liveness plus a real database round trip.

    Returns 503 when the database is unreachable, so a load balancer or the
    front end can tell "running but broken" from "healthy".
    """
    try:
        version = db.execute(text("show server_version")).scalar_one()
    except Exception:
        # The exception text can carry the DSN, so it is not echoed back.
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unreachable"},
        )

    return HealthRead(status="ok", database="connected", server_version=version)
