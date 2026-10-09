from __future__ import annotations

from app.extensions import db
from app.models import Mission

MISSION_SEED = [
    {
        "slug": "mission-1-arrival",
        "order_index": 1,
        "title": "Misión 1: The Beginning",
        "subtitle": "El primer vuelo de combustible líquido",
        "description": (
            "Auburn, Massachusetts, 16 de marzo de 1926. Interpreta a un "
            "ingeniero ficticio del equipo experimental: prepara un cohete "
            "no tripulado, prueba sus sistemas y decide si la evidencia "
            "basta para demostrar que el combustible líquido puede volar."
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
