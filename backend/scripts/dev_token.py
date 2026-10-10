"""
Mint a Supabase access token for poking at the API by hand.

    python -m scripts.dev_token

Creates (or reuses) a confirmed test user in your Supabase project, signs in as
them, and prints the access token. Development convenience only — it uses the
service key, so never run it against production.
"""

from __future__ import annotations

import sys

import httpx

from app.config import get_settings

EMAIL = "dev.reviewer@fraudguardian.test"
PASSWORD = "fraud-guardian-dev-password-1"


def main() -> int:
    settings = get_settings()
    base = settings.supabase_url.rstrip("/")
    key = settings.supabase_secret_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    with httpx.Client(timeout=20.0) as client:
        # Create the user if they do not exist yet. email_confirm skips the
        # confirmation email, which there is no inbox for here.
        created = client.post(
            f"{base}/auth/v1/admin/users",
            headers=headers,
            json={"email": EMAIL, "password": PASSWORD, "email_confirm": True},
        )
        if created.status_code not in (200, 201) and "already" not in created.text.lower():
            print(f"Could not create the test user: {created.status_code}", file=sys.stderr)
            print(created.text[:300], file=sys.stderr)
            return 1

        signed_in = client.post(
            f"{base}/auth/v1/token",
            params={"grant_type": "password"},
            headers={"apikey": key, "Content-Type": "application/json"},
            json={"email": EMAIL, "password": PASSWORD},
        )

    if signed_in.status_code != 200:
        print(f"Sign-in failed: {signed_in.status_code}", file=sys.stderr)
        print(signed_in.text[:300], file=sys.stderr)
        return 1

    print(signed_in.json()["access_token"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
