from __future__ import annotations
"""Application configuration loaded from environment variables.

No secrets are hard-coded here. Copy ``.env.example`` (project root) to
``.env`` and fill in real values for local development; in production these
should be provided by the hosting platform's secret/environment manager.
"""
import os
from datetime import timedelta
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_or_default(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else default


def _database_url() -> str:
    value = os.environ.get("DATABASE_URL", "").strip()
    if not value:
        return f"sqlite:///{os.path.join(BASE_DIR, 'backend', 'instance', 'mission.db')}"

    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://") :]
    if value.startswith("postgresql://"):
        value = "postgresql+psycopg://" + value[len("postgresql://") :]
    if os.environ.get("VERCEL") == "1" and value.startswith("postgresql+psycopg://"):
        url = make_url(value)
        query = dict(url.query)
        query.setdefault("sslmode", "require")
        value = url.set(query=query).render_as_string(hide_password=False)
    return value


DATABASE_URL = _database_url()


class BaseConfig:
    """Common configuration shared by every environment."""

    SECRET_KEY = _env_or_default("SECRET_KEY", "dev-insecure-secret-change-me")
    JWT_SECRET = _env_or_default("JWT_SECRET", "dev-insecure-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS") or "12")
    )

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    if os.environ.get("VERCEL") == "1" and DATABASE_URL.startswith(
        "postgresql+psycopg://"
    ):
        SQLALCHEMY_ENGINE_OPTIONS.update(
            {
                "pool_size": 1,
                "max_overflow": 0,
                "connect_args": {"prepare_threshold": None},
            }
        )

    cors_origins = os.environ.get("CORS_ORIGINS") or "http://localhost:5173"
    CORS_ORIGINS = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

    # --- OAuth provider placeholders -------------------------------------
    # These are intentionally read from the environment only. When a
    # provider's client id/secret is not configured, its route responds with
    # a clear "not configured" message instead of failing silently.
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID") or ""
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET") or ""
    GOOGLE_REDIRECT_URI = _env_or_default(
        "GOOGLE_REDIRECT_URI", "http://localhost:5050/api/auth/google/callback"
    )

    GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID") or ""
    GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET") or ""
    GITHUB_REDIRECT_URI = _env_or_default(
        "GITHUB_REDIRECT_URI", "http://localhost:5050/api/auth/github/callback"
    )

    NASA_API_KEY = os.environ.get("NASA_API_KEY") or "DEMO_KEY"

    FRONTEND_URL = _env_or_default("FRONTEND_URL", "http://localhost:5173")

    DEBUG = _bool_env("FLASK_DEBUG", False)
    TESTING = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(BaseConfig):
    DEBUG = False


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(env_name: str | None = None):
    env_name = env_name or os.environ.get("FLASK_ENV", "development")
    return CONFIG_BY_NAME.get(env_name, DevelopmentConfig)
