"""Vercel Python Function entrypoint for the Flask API."""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

if os.environ.get("VERCEL") == "1":
    required = (
        "FLASK_ENV",
        "DATABASE_URL",
        "SECRET_KEY",
        "JWT_SECRET",
        "FRONTEND_URL",
    )
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError(
            "Missing required Vercel environment variables: " + ", ".join(missing)
        )

    if os.environ["FLASK_ENV"].strip() != "production":
        raise RuntimeError("FLASK_ENV must be set to production on Vercel.")

    secrets = {name: os.environ[name].strip() for name in ("SECRET_KEY", "JWT_SECRET")}
    for name in ("SECRET_KEY", "JWT_SECRET"):
        value = secrets[name]
        if len(value) < 32 or "insecure" in value.lower():
            raise RuntimeError(f"{name} must be a unique secret of at least 32 characters.")

    if secrets["SECRET_KEY"] == secrets["JWT_SECRET"]:
        raise RuntimeError("SECRET_KEY and JWT_SECRET must be different secrets.")

    if not os.environ["DATABASE_URL"].strip().startswith(
        ("postgres://", "postgresql://")
    ):
        raise RuntimeError("DATABASE_URL must be the PostgreSQL connection string from Supabase.")

from wsgi import app  # noqa: E402
