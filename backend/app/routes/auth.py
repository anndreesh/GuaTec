from __future__ import annotations
import secrets

from urllib.parse import quote

from flask import Blueprint, jsonify, redirect, request, session
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import User
from app.utils.auth_tokens import issue_token
from app.utils.oauth_clients import (
    OAuthNotConfiguredError,
    exchange_github_code,
    exchange_google_code,
    github_authorize_url,
    github_is_configured,
    google_authorize_url,
    google_is_configured,
)

auth_bp = Blueprint("auth", __name__)

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def _remember_oauth_state(provider: str, state: str) -> None:
    session["oauth_state"] = {"provider": provider, "state": state}
    session.modified = True


def _consume_oauth_state(provider: str) -> str | None:
    saved = session.pop("oauth_state", None)
    if not isinstance(saved, dict):
        return None
    if saved.get("provider") != provider:
        return None
    state = saved.get("state")
    if not isinstance(state, str):
        return None
    return state


@auth_bp.get("/providers")
def list_providers():
    """Tells the frontend which OAuth providers are actually usable so the
    "choose provider" screen can grey out/hide unconfigured ones, and always
    offer the guest fallback."""
    return jsonify(
        {
            "providers": [
                {"id": "google", "label": "Google", "configured": google_is_configured()},
                {"id": "github", "label": "GitHub", "configured": github_is_configured()},
                {"id": "guest", "label": "Invitado", "configured": True},
            ]
        }
    )


@auth_bp.get("/google/login")
def google_login():
    state = secrets.token_urlsafe(16)
    try:
        url = google_authorize_url(state)
    except OAuthNotConfiguredError:
        return jsonify({"error": "google_not_configured"}), 501
    _remember_oauth_state("google", state)
    return redirect(url)


@auth_bp.get("/google/callback")
def google_callback():
    state = request.args.get("state")
    if not state or state != _consume_oauth_state("google"):
        return jsonify({"error": "invalid_oauth_state"}), 400
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "missing_code"}), 400
    try:
        profile = exchange_google_code(code)
    except OAuthNotConfiguredError:
        return jsonify({"error": "google_not_configured"}), 501
    except Exception as exc:  # noqa: BLE001 - surface upstream failure clearly
        return jsonify({"error": "oauth_exchange_failed", "detail": str(exc)}), 502

    if not profile.get("email") or profile.get("email_verified") is False:
        return jsonify({"error": "oauth_email_unverified"}), 400

    user = _upsert_oauth_user(
        provider="google",
        subject=profile.get("id"),
        email=profile.get("email"),
        avatar_url=profile.get("picture"),
    )
    token = issue_token(user.id)
    if not user.username:
        return redirect(_complete_oauth_signup_redirect(token, user.email or ""))
    return redirect(f"{_frontend_redirect(token)}")


@auth_bp.get("/github/login")
def github_login():
    state = secrets.token_urlsafe(16)
    try:
        url = github_authorize_url(state)
    except OAuthNotConfiguredError:
        return jsonify({"error": "github_not_configured"}), 501
    _remember_oauth_state("github", state)
    return redirect(url)


@auth_bp.get("/github/callback")
def github_callback():
    state = request.args.get("state")
    if not state or state != _consume_oauth_state("github"):
        return jsonify({"error": "invalid_oauth_state"}), 400
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "missing_code"}), 400
    try:
        profile = exchange_github_code(code)
    except OAuthNotConfiguredError:
        return jsonify({"error": "github_not_configured"}), 501
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "oauth_exchange_failed", "detail": str(exc)}), 502

    if not profile.get("email"):
        return jsonify({"error": "oauth_email_unavailable"}), 400

    user = _upsert_oauth_user(
        provider="github",
        subject=str(profile.get("id")),
        email=profile.get("email"),
        avatar_url=profile.get("avatar_url"),
    )
    token = issue_token(user.id)
    if not user.username:
        return redirect(_complete_oauth_signup_redirect(token, user.email or ""))
    return redirect(f"{_frontend_redirect(token)}")


@auth_bp.post("/guest")
def guest_login():
    """Creates (or reuses, via localStorage-persisted token) a lightweight
    guest account so players can try the game without any OAuth provider."""
    user = User(oauth_provider="guest")
    db.session.add(user)
    db.session.commit()
    token = issue_token(user.id)
    return jsonify({"token": token, "user": user.to_dict()})


@auth_bp.post("/register")
def register():
    email, password, error = _validate_credentials(request.get_json(silent=True))
    if error:
        return jsonify({"error": "validation_error", "message": error}), 400

    existing = User.query.filter_by(email=email).first()
    if existing is not None:
        if existing.oauth_provider in {"google", "github"} and not existing.password_hash:
            existing.set_password(password)
            db.session.commit()
            return jsonify({"token": issue_token(existing.id), "user": existing.to_dict()}), 201
        db.session.rollback()
        return jsonify(
            {
                "error": "email_already_registered",
                "message": "Ya existe una cuenta con ese correo. Inicia sesión.",
            }
        ), 409

    user = User(email=email, oauth_provider="password")
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(
            {
                "error": "email_already_registered",
                "message": "Ya existe una cuenta con ese correo. Inicia sesión.",
            }
        ), 409

    return jsonify({"token": issue_token(user.id), "user": user.to_dict()}), 201


@auth_bp.post("/login")
def login():
    email, password, error = _validate_credentials(request.get_json(silent=True))
    if error:
        return jsonify({"error": "validation_error", "message": error}), 400

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return jsonify(
            {
                "error": "invalid_credentials",
                "message": "El correo o la contraseña son incorrectos.",
            }
        ), 401

    return jsonify({"token": issue_token(user.id), "user": user.to_dict()})


def _validate_credentials(data: object) -> tuple[str | None, str | None, str | None]:
    if not isinstance(data, dict):
        return None, None, "Envía un correo electrónico y una contraseña."

    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not email.strip():
        return None, None, "Ingresa un correo electrónico válido."
    email = email.strip().lower()
    local_part, separator, domain = email.partition("@")
    if len(email) > 255 or separator != "@" or not local_part or not domain or "@" in domain:
        return None, None, "Ingresa un correo electrónico válido."
    if not isinstance(password, str):
        return None, None, "Ingresa una contraseña."
    if len(password) < MIN_PASSWORD_LENGTH:
        return None, None, f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres."
    if len(password) > MAX_PASSWORD_LENGTH:
        return None, None, f"La contraseña no puede superar los {MAX_PASSWORD_LENGTH} caracteres."

    return email, password, None


def _upsert_oauth_user(provider: str, subject: str | None, email: str | None, avatar_url: str | None) -> User:
    normalized_email = email.strip().lower() if isinstance(email, str) and email.strip() else None
    if not subject or not normalized_email:
        raise ValueError("El proveedor OAuth no devolvió un identificador o correo válido.")

    user = User.query.filter_by(oauth_provider=provider, oauth_subject=subject).first()
    if user is None:
        # Reuse the existing account instead of creating a second account for
        # the same verified email. This makes Google/GitHub login automatic.
        user = User.query.filter_by(email=normalized_email).first()

    if user is None:
        user = User(
            oauth_provider=provider,
            oauth_subject=subject,
            email=normalized_email,
            avatar_url=avatar_url,
        )
        db.session.add(user)
    else:
        user.email = normalized_email
        user.oauth_provider = provider
        user.oauth_subject = subject
        user.avatar_url = avatar_url or user.avatar_url
    db.session.commit()
    return user


def _frontend_redirect(token: str) -> str:
    from flask import current_app

    return f"{current_app.config['FRONTEND_URL']}/#/auth/callback?token={token}"


def _complete_oauth_signup_redirect(token: str, email: str) -> str:
    from flask import current_app

    encoded_email = quote(email or "")
    return f"{current_app.config['FRONTEND_URL']}/#/auth/complete-oauth?token={token}&email={encoded_email}"
