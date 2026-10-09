"""Shared Flask extension instances.

Kept in their own module (separate from ``app/__init__.py``) so that models
and routes can import ``db`` without triggering circular imports.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
