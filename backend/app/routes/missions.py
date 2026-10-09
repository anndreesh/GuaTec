from __future__ import annotations

from flask import Blueprint, g, jsonify

from app.models import Mission, MissionProgress
from app.routes.decorators import login_required

missions_bp = Blueprint("missions", __name__)


@missions_bp.get("")
@login_required
def list_missions():
    """Returns the mission carousel data: catalogue info merged with the
    current user's per-mission status (locked/unlocked/in_progress/completed).
    """
    missions = Mission.query.order_by(Mission.order_index.asc()).all()
    progress_by_mission = {
        p.mission_id: p
        for p in MissionProgress.query.filter_by(user_id=g.current_user.id).all()
    }

    result = []
    for mission in missions:
        progress = progress_by_mission.get(mission.id)
        payload = mission.to_dict()
        if progress:
            payload["status"] = progress.status
            payload["progressPercent"] = progress.progress_percent
        else:
            payload["status"] = "locked" if mission.is_locked_by_default else "unlocked"
            payload["progressPercent"] = 0.0
        result.append(payload)

    return jsonify({"missions": result})
