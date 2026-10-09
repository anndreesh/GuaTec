from __future__ import annotations
from datetime import datetime, timezone

from app.extensions import db


class PlayStatistic(db.Model):
    """Aggregate/telemetry statistics used to render the end-of-mission report
    and the player's overall profile summary."""

    __tablename__ = "play_statistics"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=True)

    metric_key = db.Column(db.String(64), nullable=False)
    metric_label = db.Column(db.String(128), nullable=False)
    value = db.Column(db.Float, default=0.0)
    recorded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "missionId": self.mission_id,
            "metricKey": self.metric_key,
            "metricLabel": self.metric_label,
            "value": self.value,
            "recordedAt": self.recorded_at.isoformat() if self.recorded_at else None,
        }
