from flask import Flask

from .auth import auth_bp
from .user import user_bp
from .missions import missions_bp
from .progress import progress_bp
from .inventory import inventory_bp
from .samples import samples_bp
from .statistics import statistics_bp
from .nasa import nasa_bp


def register_routes(app: Flask) -> None:
    """Attach every API blueprint under the /api prefix."""
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(missions_bp, url_prefix="/api/missions")
    app.register_blueprint(progress_bp, url_prefix="/api/progress")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(samples_bp, url_prefix="/api/samples")
    app.register_blueprint(statistics_bp, url_prefix="/api/statistics")
    app.register_blueprint(nasa_bp, url_prefix="/api/nasa")
