from pydantic import BaseModel


class HealthRead(BaseModel):
    status: str
    database: str
    server_version: str | None = None
