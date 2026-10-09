from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models import Mission, PlayStatistic
from app.routes.decorators import login_required

statistics_bp = Blueprint("statistics", __name__)


@statistics_bp.get("")
@login_required
def list_statistics():
    stats = PlayStatistic.query.filter_by(user_id=g.current_user.id).all()
    return jsonify({"statistics": [s.to_dict() for s in stats]})


@statistics_bp.post("")
@login_required
def record_statistic():
    """Records/updates a single metric (e.g. 'oxygen_used', 'decisions_made',
    'samples_collected'). Used both for live telemetry and to build the
    final mission report."""
    data = request.get_json(silent=True) or {}
    mission = None
    mission_slug = data.get("missionSlug")
    if mission_slug:
        mission = Mission.query.filter_by(slug=mission_slug).first()

    stat = PlayStatistic(
        user_id=g.current_user.id,
        mission_id=mission.id if mission else None,
        metric_key=data.get("metricKey", "unknown"),
        metric_label=data.get("metricLabel", "Métrica"),
        value=float(data.get("value", 0)),
    )
    db.session.add(stat)
    db.session.commit()
    return jsonify(stat.to_dict()), 201


@statistics_bp.get("/summary/<string:mission_slug>")
@login_required
def mission_summary(mission_slug: str):
    """Aggregated (summed) metrics for a mission, used to render the
    end-of-mission report screen."""
    mission = Mission.query.filter_by(slug=mission_slug).first_or_404()
    rows = (
        db.session.query(
            PlayStatistic.metric_key,
            PlayStatistic.metric_label,
            func.sum(PlayStatistic.value).label("total"),
        )
        .filter(
            PlayStatistic.user_id == g.current_user.id,
            PlayStatistic.mission_id == mission.id,
        )
        .group_by(PlayStatistic.metric_key, PlayStatistic.metric_label)
        .all()
    )
    return jsonify(
        {
            "missionSlug": mission_slug,
            "metrics": [
                {"metricKey": r.metric_key, "metricLabel": r.metric_label, "total": r.total}
                for r in rows
            ],
        }
    )
