from __future__ import annotations
from datetime import datetime, timezone

import jwt
from flask import current_app, request


def issue_token(user_id: str) -> str:
    """Create a signed session JWT for the given user id."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"],
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def get_current_user_id() -> str | None:
    """Extract and validate the bearer token from the current request."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload:
        return None
    return payload.get("sub")
