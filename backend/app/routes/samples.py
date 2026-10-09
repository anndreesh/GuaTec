from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import Mission, Sample
from app.routes.decorators import login_required

samples_bp = Blueprint("samples", __name__)


@samples_bp.get("")
@login_required
def list_samples():
    samples = Sample.query.filter_by(user_id=g.current_user.id).order_by(Sample.collected_at.desc()).all()
    return jsonify({"samples": [s.to_dict() for s in samples]})


@samples_bp.post("")
@login_required
def collect_sample():
    """Registers a scientific sample collected during gameplay (e.g. a
    rock, ice core, or soil sample found during a decision event)."""
    data = request.get_json(silent=True) or {}
    mission = None
    mission_slug = data.get("missionSlug")
    if mission_slug:
        mission = Mission.query.filter_by(slug=mission_slug).first()

    sample = Sample(
        user_id=g.current_user.id,
        mission_id=mission.id if mission else None,
        sample_key=data.get("sampleKey", "unknown"),
        label=data.get("label", "Muestra desconocida"),
        sample_type=data.get("type", "mineral"),
        quality=float(data.get("quality", 1.0)),
    )
    db.session.add(sample)
    db.session.commit()
    return jsonify(sample.to_dict()), 201
