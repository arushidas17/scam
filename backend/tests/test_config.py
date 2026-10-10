"""The URL rewrite is the one bit of config logic worth pinning down."""

import pytest

from app.config import Settings


def _settings(url: str) -> Settings:
    return Settings(
        DATABASE_URL=url,
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SECRET_KEY="x",
        GEMINI_API_KEY="y",
    )


@pytest.mark.parametrize(
    "given",
    [
        "postgresql://u:p@host:5432/postgres",
        "postgres://u:p@host:5432/postgres",
        "postgresql+psycopg://u:p@host:5432/postgres",
    ],
)
def test_driver_is_always_psycopg3(given: str) -> None:
    assert _settings(given).sqlalchemy_url.startswith("postgresql+psycopg://")


def test_surrounding_whitespace_is_trimmed() -> None:
    """A trailing space in .env is invisible but breaks authentication."""
    url = _settings("  postgresql://u:secret@host:5432/postgres  ").sqlalchemy_url
    assert url == "postgresql+psycopg://u:secret@host:5432/postgres"


def test_password_special_characters_survive_the_rewrite() -> None:
    url = _settings("postgresql://u:pa ss@host:5432/postgres").sqlalchemy_url
    # The space is encoded rather than left to corrupt the authority section.
    assert "pa%20ss@host" in url


def test_host_and_database_are_preserved() -> None:
    url = _settings(
        "postgresql://user:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    ).sqlalchemy_url
    assert "@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" in url
