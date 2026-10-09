from __future__ import annotations
from datetime import datetime, timezone

from app.extensions import db


class Sample(db.Model):
    """A scientific sample collected by the player during a mission."""

    __tablename__ = "samples"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=True)
    sample_key = db.Column(db.String(64), nullable=False)
    label = db.Column(db.String(128), nullable=False)
    sample_type = db.Column(db.String(32), default="mineral")  # mineral | ice | soil | biological
    quality = db.Column(db.Float, default=1.0)  # 0..1 scientific quality score
    collected_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "missionId": self.mission_id,
            "sampleKey": self.sample_key,
            "label": self.label,
            "type": self.sample_type,
            "quality": self.quality,
            "collectedAt": self.collected_at.isoformat() if self.collected_at else None,
        }
