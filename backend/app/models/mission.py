from __future__ import annotations
from datetime import datetime, timezone

from app.extensions import db


class Mission(db.Model):
    """Static catalogue entry describing a playable mission.

    Rows are seeded at startup (see ``app/utils/seed.py``) so the frontend
    mission carousel always has data to render, even on a fresh database.
    """

    __tablename__ = "missions"

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(64), unique=True, nullable=False)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    title = db.Column(db.String(128), nullable=False)
    subtitle = db.Column(db.String(256), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_locked_by_default = db.Column(db.Boolean, default=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "slug": self.slug,
            "order": self.order_index,
            "title": self.title,
            "subtitle": self.subtitle,
            "description": self.description,
            "lockedByDefault": self.is_locked_by_default,
        }


class MissionProgress(db.Model):
    """Per-user progress/save-state for a given mission.

    ``state_json`` stores the autosaved gameplay snapshot (resources,
    decisions taken, elapsed time, etc.) as an opaque JSON blob so the
    frontend can resume a session without the backend needing to know every
    field of the simulation.
    """

    __tablename__ = "mission_progress"
    __table_args__ = (db.UniqueConstraint("user_id", "mission_id", name="uq_user_mission"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=False)

    status = db.Column(db.String(16), default="locked")  # locked | unlocked | in_progress | completed
    progress_percent = db.Column(db.Float, default=0.0)
    state_json = db.Column(db.JSON, default=dict)
    report_json = db.Column(db.JSON, nullable=True)

    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    mission = db.relationship("Mission")

    def to_dict(self) -> dict:
        return {
            "missionId": self.mission_id,
            "missionSlug": self.mission.slug if self.mission else None,
            "status": self.status,
            "progressPercent": self.progress_percent,
            "state": self.state_json or {},
            "report": self.report_json,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
