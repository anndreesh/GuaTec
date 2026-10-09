"""WSGI entrypoint for production servers (e.g. gunicorn wsgi:app).

This file is used by Render and other production platforms to start the app.
It imports the Flask app from the backend module.
"""
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5050)))
