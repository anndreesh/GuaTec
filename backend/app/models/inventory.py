from __future__ import annotations
from datetime import datetime, timezone

from app.extensions import db


class InventoryItem(db.Model):
    """A resource/item stack owned by a user (oxygen, water, tools, etc.)."""

    __tablename__ = "inventory_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    item_key = db.Column(db.String(64), nullable=False)
    label = db.Column(db.String(128), nullable=False)
    quantity = db.Column(db.Float, default=0.0)
    unit = db.Column(db.String(16), default="unit")
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (db.UniqueConstraint("user_id", "item_key", name="uq_user_item"),)

    def to_dict(self) -> dict:
        return {
            "itemKey": self.item_key,
            "label": self.label,
            "quantity": self.quantity,
            "unit": self.unit,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
