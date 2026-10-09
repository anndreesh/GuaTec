from __future__ import annotations
import uuid
from datetime import datetime, timezone

from app.extensions import db
from werkzeug.security import check_password_hash, generate_password_hash


def _uuid() -> str:
    return str(uuid.uuid4())


class User(db.Model):
    """A player account.

    A user may authenticate with an email and password, via an OAuth provider
    (Google/GitHub), or through the anonymous/guest flow. ``username`` is
    chosen during the "username setup" screen and persisted so it survives
    reloads.
    """

    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    username = db.Column(db.String(32), unique=True, nullable=True, index=True)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    oauth_provider = db.Column(  # "password" | "google" | "github" | "guest"
        db.String(32), nullable=True
    )
    oauth_subject = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    progresses = db.relationship(
        "MissionProgress", backref="user", cascade="all, delete-orphan", lazy="dynamic"
    )
    inventory_items = db.relationship(
        "InventoryItem", backref="user", cascade="all, delete-orphan", lazy="dynamic"
    )
    samples = db.relationship(
        "Sample", backref="user", cascade="all, delete-orphan", lazy="dynamic"
    )
    statistics = db.relationship(
        "PlayStatistic", backref="user", cascade="all, delete-orphan", lazy="dynamic"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    def check_password(self, password: str) -> bool:
        return bool(self.password_hash) and check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "oauthProvider": self.oauth_provider,
            "avatarUrl": self.avatar_url,
            "hasUsername": bool(self.username),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
