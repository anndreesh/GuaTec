from __future__ import annotations
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import Mission, MissionProgress
from app.routes.decorators import login_required

progress_bp = Blueprint("progress", __name__)


def _get_or_create_progress(user_id: str, mission: Mission) -> MissionProgress:
    progress = MissionProgress.query.filter_by(user_id=user_id, mission_id=mission.id).first()
    if progress is None:
        progress = MissionProgress(
            user_id=user_id,
            mission_id=mission.id,
            status="locked" if mission.is_locked_by_default else "unlocked",
            state_json={},
        )
        db.session.add(progress)
        db.session.commit()
    return progress


@progress_bp.get("/<string:mission_slug>")
@login_required
def get_progress(mission_slug: str):
    mission = Mission.query.filter_by(slug=mission_slug).first_or_404()
    progress = _get_or_create_progress(g.current_user.id, mission)
    return jsonify(progress.to_dict())


@progress_bp.put("/<string:mission_slug>")
@login_required
def autosave_progress(mission_slug: str):
    """Autosave endpoint: the frontend periodically PUTs the current
    gameplay snapshot (resources, decisions, elapsed time...) here so a
    reload can resume exactly where the player left off."""
    mission = Mission.query.filter_by(slug=mission_slug).first_or_404()
    progress = _get_or_create_progress(g.current_user.id, mission)

    data = request.get_json(silent=True) or {}
    state = data.get("state")
    progress_percent = data.get("progressPercent")

    if progress.status in ("locked",):
        progress.status = "in_progress"
    if progress.started_at is None:
        progress.started_at = datetime.now(timezone.utc)

    if state is not None:
        progress.state_json = state
    if progress_percent is not None:
        progress.progress_percent = float(progress_percent)
        if progress.progress_percent >= 100:
            progress.status = "completed"
            progress.completed_at = datetime.now(timezone.utc)
        elif progress.status != "completed":
            progress.status = "in_progress"

    db.session.commit()
    return jsonify(progress.to_dict())


@progress_bp.post("/<string:mission_slug>/complete")
@login_required
def complete_mission(mission_slug: str):
    """Marks a mission complete and stores its final report, then unlocks
    the next mission in ``order_index`` order."""
    mission = Mission.query.filter_by(slug=mission_slug).first_or_404()
    progress = _get_or_create_progress(g.current_user.id, mission)

    data = request.get_json(silent=True) or {}
    report = data.get("report", {})

    progress.status = "completed"
    progress.progress_percent = 100.0
    progress.completed_at = datetime.now(timezone.utc)
    progress.report_json = report
    db.session.commit()

    next_mission = (
        Mission.query.filter(Mission.order_index > mission.order_index)
        .order_by(Mission.order_index.asc())
        .first()
    )
    if next_mission is not None:
        next_progress = _get_or_create_progress(g.current_user.id, next_mission)
        if next_progress.status == "locked":
            next_progress.status = "unlocked"
            db.session.commit()

    return jsonify({"progress": progress.to_dict(), "unlockedNext": next_mission.slug if next_mission else None})


@progress_bp.post("/<string:mission_slug>/replay")
@login_required
def replay_mission(mission_slug: str):
    """Reset a mission's playable state while preserving campaign unlocks."""
    mission = Mission.query.filter_by(slug=mission_slug).first_or_404()
    progress = _get_or_create_progress(g.current_user.id, mission)
    if progress.status == "locked":
        return jsonify({"error": "mission_locked", "message": "Completa las misiones anteriores primero."}), 409
    progress.status = "unlocked"
    progress.progress_percent = 0.0
    progress.state_json = {}
    progress.report_json = None
    progress.started_at = None
    progress.completed_at = None
    db.session.commit()
    return jsonify(progress.to_dict())
