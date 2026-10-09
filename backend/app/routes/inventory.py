from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import InventoryItem
from app.routes.decorators import login_required

inventory_bp = Blueprint("inventory", __name__)


@inventory_bp.get("")
@login_required
def list_inventory():
    items = InventoryItem.query.filter_by(user_id=g.current_user.id).all()
    return jsonify({"items": [item.to_dict() for item in items]})


@inventory_bp.put("")
@login_required
def upsert_inventory():
    """Bulk upsert used by autosave to sync the full resource inventory
    (oxygen, water, energy, food, tools...) in one call."""
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])

    for entry in items:
        item_key = entry.get("itemKey")
        if not item_key:
            continue
        item = InventoryItem.query.filter_by(
            user_id=g.current_user.id, item_key=item_key
        ).first()
        if item is None:
            item = InventoryItem(user_id=g.current_user.id, item_key=item_key)
            db.session.add(item)
        item.label = entry.get("label", item_key)
        item.quantity = float(entry.get("quantity", 0))
        item.unit = entry.get("unit", "unit")

    db.session.commit()
    items = InventoryItem.query.filter_by(user_id=g.current_user.id).all()
    return jsonify({"items": [item.to_dict() for item in items]})
