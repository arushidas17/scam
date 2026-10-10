"""Settings, read once from the environment."""

from functools import lru_cache
from urllib.parse import quote, urlsplit, urlunsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(alias="DATABASE_URL")
    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_secret_key: str = Field(alias="SUPABASE_SECRET_KEY")
    gemini_api_key: str = Field(alias="GEMINI_API_KEY")

    # Browser origins allowed to call this API. Vite moves to 5174 (and up)
    # when 5173 is already taken, and a rejected preflight looks like a server
    # outage from the front end, so both are allowed out of the box. Override
    # with CORS_ORIGINS in .env as a comma-separated list.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string as well as a real list."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # --- Gemini -------------------------------------------------------------
    # Named here so the model can be changed in one place when it moves on.
    #
    # gemini-3.8-flash was the original choice but has been unavailable or
    # rate-limited for long stretches; 3.7 returns InternalServerError and 3.6
    # is rate-limited on this key. 3.1-flash-lite reads an invoice in ~10s and
    # extracts the same fields, so it is the default until the newer models
    # have capacity again. Override with GEMINI_MODEL in .env.
    gemini_model: str = "gemini-3.1-flash-lite"
    # Short enough that an unresponsive model surfaces as a clear error in
    # about a minute, rather than appearing to hang for five.
    gemini_timeout_seconds: float = 45.0
    gemini_max_attempts: int = 3  # one call plus two retries

    # --- Supabase Storage ---------------------------------------------------
    # Private bucket. Nothing in it is ever served without a signed URL.
    storage_bucket: str = "invoices"
    signed_url_ttl_seconds: int = 900  # 15 minutes
    max_upload_bytes: int = 10 * 1024 * 1024

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        """
        Trim surrounding whitespace on every secret.

        A trailing space on a value in .env is invisible in an editor but is
        sent verbatim as part of the password, which fails authentication with
        a misleading "password authentication failed".
        """
        return v.strip() if isinstance(v, str) else v

    @property
    def sqlalchemy_url(self) -> str:
        """
        SQLAlchemy needs the driver named explicitly, or it reaches for
        psycopg2. Supabase hands out a plain ``postgresql://`` URL, so point it
        at psycopg 3 here rather than editing the value in .env.
        """
        parts = urlsplit(self.database_url.strip())

        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+psycopg"

        # Rebuild the authority so a password containing reserved characters
        # (a space, @, /, ?) survives being put back into a URL.
        user = quote(parts.username or "", safe="")
        password = quote((parts.password or "").strip(), safe="")
        host = parts.hostname or ""
        netloc = f"{user}:{password}@{host}" if password else f"{user}@{host}"
        if parts.port:
            netloc = f"{netloc}:{parts.port}"

        return urlunsplit((scheme, netloc, parts.path, parts.query, parts.fragment))


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
