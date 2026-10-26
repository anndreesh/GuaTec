from __future__ import annotations

from app.extensions import db
from app.models import Mission

MISSION_SEED = [
    {
        "slug": "mission-1-arrival",
        "order_index": 1,
        "title": "Misión 01: Apollo 11",
        "subtitle": "El comienzo de una nueva era · 1969",
        "description": (
            "16 de julio de 1969, Centro Espacial Kennedy. Como técnico ficticio "
            "de apoyo terrestre, reconoce el complejo 39A, documenta los "
            "preparativos, observa a Armstrong, Collins y Aldrin y presencia "
            "el lanzamiento del Saturn V desde una ubicación segura."
        ),
        "is_locked_by_default": False,
    },
    {
        "slug": "mission-2-deep-exploration",
        "order_index": 2,
        "title": "Misión 2: Exploración Profunda",
        "subtitle": "Próximamente",
        "description": "Se desbloquea al completar la Misión 1.",
        "is_locked_by_default": True,
    },
    {
        "slug": "mission-3-outpost",
        "order_index": 3,
        "title": "Misión 3: Avanzada Permanente",
        "subtitle": "Próximamente",
        "description": "Se desbloquea al completar la Misión 2.",
        "is_locked_by_default": True,
    },
]


def seed_missions() -> None:
    """Idempotently ensure the mission catalogue rows exist."""
    for entry in MISSION_SEED:
        existing = Mission.query.filter_by(slug=entry["slug"]).first()
        if existing is None:
            db.session.add(Mission(**entry))
        else:
            existing.order_index = entry["order_index"]
            existing.title = entry["title"]
            existing.subtitle = entry["subtitle"]
            existing.description = entry["description"]
            existing.is_locked_by_default = entry["is_locked_by_default"]
    db.session.commit()
