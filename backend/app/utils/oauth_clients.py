from __future__ import annotations

import requests
from flask import current_app


class OAuthNotConfiguredError(RuntimeError):
    """Raised when a provider's OAuth env vars are missing."""


def _require(*values: str) -> bool:
    return all(bool(v) for v in values)


def google_is_configured() -> bool:
    cfg = current_app.config
    return _require(cfg["GOOGLE_CLIENT_ID"], cfg["GOOGLE_CLIENT_SECRET"])


def github_is_configured() -> bool:
    cfg = current_app.config
    return _require(cfg["GITHUB_CLIENT_ID"], cfg["GITHUB_CLIENT_SECRET"])


def google_authorize_url(state: str) -> str:
    cfg = current_app.config
    if not google_is_configured():
        raise OAuthNotConfiguredError("google")
    params = {
        "client_id": cfg["GOOGLE_CLIENT_ID"],
        "redirect_uri": cfg["GOOGLE_REDIRECT_URI"],
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }
    query = "&".join(f"{k}={requests.utils.quote(v)}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def github_authorize_url(state: str) -> str:
    cfg = current_app.config
    if not github_is_configured():
        raise OAuthNotConfiguredError("github")
    params = {
        "client_id": cfg["GITHUB_CLIENT_ID"],
        "redirect_uri": cfg["GITHUB_REDIRECT_URI"],
        "scope": "read:user user:email",
        "state": state,
    }
    query = "&".join(f"{k}={requests.utils.quote(v)}" for k, v in params.items())
    return f"https://github.com/login/oauth/authorize?{query}"


def exchange_google_code(code: str) -> dict:
    """Exchange an OAuth code for a Google user profile.

    Kept as a single, isolated network call so it can be mocked in tests and
    so failures degrade to a clear error rather than crashing the app.
    """
    cfg = current_app.config
    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": cfg["GOOGLE_CLIENT_ID"],
            "client_secret": cfg["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": cfg["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json()["access_token"]

    profile_resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    profile_resp.raise_for_status()
    return profile_resp.json()


def exchange_github_code(code: str) -> dict:
    cfg = current_app.config
    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        data={
            "code": code,
            "client_id": cfg["GITHUB_CLIENT_ID"],
            "client_secret": cfg["GITHUB_CLIENT_SECRET"],
            "redirect_uri": cfg["GITHUB_REDIRECT_URI"],
        },
        headers={"Accept": "application/json"},
        timeout=10,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json()["access_token"]

    profile_resp = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    profile_resp.raise_for_status()
    profile = profile_resp.json()
    if not profile.get("email"):
        emails_resp = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"******"},
            timeout=10,
        )
        emails_resp.raise_for_status()
        emails = emails_resp.json()
        profile["email"] = next(
            (
                item.get("email")
                for item in emails
                if item.get("verified") and item.get("primary") and item.get("email")
            ),
            None,
        )
    return profile
