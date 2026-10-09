from __future__ import annotations
import os

from flask import Flask, jsonify
from sqlalchemy import inspect, text

from app.config import get_config
from app.extensions import cors, db, migrate


def create_app(env_name: str | None = None) -> Flask:
    """Application factory: builds and configures the Flask app.

    Kept side-effect-light (no route imports at module scope) so it can be
    reused by ``wsgi.py``, tests, and CLI/migration tooling without circular
    import issues.
    """
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(env_name))

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from app.routes import register_routes

    register_routes(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    with app.app_context():
        db.create_all()
        _add_password_hash_column_if_needed()
        from app.utils.seed import seed_missions

        seed_missions()

    return app


def _add_password_hash_column_if_needed() -> None:
    """Add the nullable credential column to databases created before local auth."""
    with db.engine.begin() as connection:
        column_names = {column["name"] for column in inspect(connection).get_columns("users")}
        if "password_hash" not in column_names:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
