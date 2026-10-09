"""WSGI entrypoint for production servers (e.g. gunicorn wsgi:app)."""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(__import__("os").environ.get("PORT", 5050)))
