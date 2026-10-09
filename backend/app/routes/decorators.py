from __future__ import annotations
from functools import wraps

from flask import g, jsonify

from app.models import User
from app.utils.auth_tokens import get_current_user_id


def login_required(view_func):
    """Resolves the bearer token into ``g.current_user`` or returns 401.

    Guest and OAuth logins both issue the same kind of JWT, so every
    protected route uses this single decorator regardless of provider.
    """

    @wraps(view_func)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "unauthorized"}), 401
        user = User.query.get(user_id)
        if user is None:
            return jsonify({"error": "unauthorized"}), 401
        g.current_user = user
        return view_func(*args, **kwargs)

    return wrapper
