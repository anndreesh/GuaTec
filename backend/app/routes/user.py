from __future__ import annotations
import re

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import User
from app.routes.decorators import login_required

user_bp = Blueprint("user", __name__)

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{3,20}$")


@user_bp.get("/me")
@login_required
def get_me():
    return jsonify(g.current_user.to_dict())


@user_bp.post("/username")
@login_required
def set_username():
    """Persist the username chosen on the username-setup screen.

    Validates format and uniqueness; the frontend calls this once right
    after auth (or guest) and then treats the returned user as the source
    of truth for display name everywhere else.
    """
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()

    if not USERNAME_PATTERN.match(username):
        return (
            jsonify(
                {
                    "error": "invalid_username",
                    "message": "El nombre de usuario debe tener 3-20 caracteres alfanuméricos, guiones o guiones bajos.",
                }
            ),
            400,
        )

    existing = User.query.filter(
        User.username == username, User.id != g.current_user.id
    ).first()
    if existing is not None:
        return jsonify({"error": "username_taken", "message": "Ese nombre de usuario ya está en uso."}), 409

    g.current_user.username = username
    db.session.commit()
    return jsonify(g.current_user.to_dict())
