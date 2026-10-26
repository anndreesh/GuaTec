"""Apollo progress regression tests against an isolated in-memory database.

Run from backend/: DATABASE_URL=sqlite:///:memory: .venv/bin/python -m unittest
discover -s . -p 'test_apollo_progress.py' -v
"""
from __future__ import annotations

import copy
import os
import unittest
from datetime import datetime

# Set before importing the app: configuration imports must never select a real DB.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import create_app
from app.extensions import db
from app.models import Mission, MissionProgress


APOLLO = "mission-1-arrival"
NEXT = "mission-2-deep-exploration"
OTHER = "mission-3-outpost"
CHECKPOINT_IDS = [
    "orientation", "complex", "documentation", "communications",
    "crew", "observation", "launch", "epilogue",
]


def apollo_snapshot(checkpoint: int = 0, *, done: bool = False) -> dict:
    """Representative wire snapshot; the frontend owns its progression rules."""
    return {
        "tick": 215,
        "resources": {"fuel": 100, "pressure": 100, "stability": 100, "telemetry": 100},
        "resolvedDecisionIds": [],
        "log": [],
        "apollo11SavedAt": 1793030400123,
        "apollo11": {
            "version": "apollo11-v1",
            "checkpoint": 7 if done else checkpoint,
            "completed": CHECKPOINT_IDS[:] if done else CHECKPOINT_IDS[:checkpoint],
            "checks": [],
            "dialogues": ["intro-history"] if checkpoint or done else [],
            "elapsed": 215.75,
            "done": done,
        },
    }


class ApolloProgressTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app("testing")
        self.assertEqual(self.app.config["SQLALCHEMY_DATABASE_URI"], "sqlite:///:memory:")
        self.app.config["JWT_SECRET"] = "apollo-progress-tests-only-secret-32-characters"
        self.context = self.app.app_context()
        self.context.push()
        self.assertIn(db.engine.url.database, (None, "", ":memory:"))
        self.client = self.app.test_client()
        guest = self.client.post("/api/auth/guest")
        self.assertEqual(guest.status_code, 200)
        auth = guest.get_json()
        self.user_id = auth["user"]["id"]
        self.headers = {"Authorization": "Bearer " + auth["token"]}

    def tearDown(self) -> None:
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def row(self, slug: str) -> MissionProgress:
        mission = Mission.query.filter_by(slug=slug).one()
        row = MissionProgress.query.filter_by(user_id=self.user_id, mission_id=mission.id).first()
        if row is None:
            row = MissionProgress(
                user_id=self.user_id, mission_id=mission.id,
                status="locked" if mission.is_locked_by_default else "unlocked",
                state_json={},
            )
            db.session.add(row)
            db.session.commit()
        return row

    def seed_other_progress(self) -> dict:
        """Existing campaign data must survive replacement/replay of Apollo."""
        for slug, status, percent in [(NEXT, "in_progress", 42.5), (OTHER, "completed", 100)]:
            row = self.row(slug)
            row.status = status
            row.progress_percent = percent
            row.state_json = {"existing": slug, "records": ["retain", {"score": 7}]}
            row.report_json = {"summary": "Existing campaign report", "outcome": "success"}
            row.started_at = datetime(2026, 9, 1, 8)
            row.completed_at = datetime(2026, 9, 1, 9) if status == "completed" else None
        db.session.commit()
        return {slug: copy.deepcopy(self.row(slug).to_dict()) for slug in (NEXT, OTHER)}

    def assert_other_progress_unchanged(self, before: dict) -> None:
        db.session.expire_all()
        for slug, expected in before.items():
            self.assertEqual(self.row(slug).to_dict(), expected, slug)

    def save(self, state: dict, percent: float):
        response = self.client.put(
            "/api/progress/" + APOLLO,
            headers=self.headers,
            json={"state": state, "progressPercent": percent},
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def test_progress_endpoints_require_authentication(self) -> None:
        for method, suffix in [("get", ""), ("put", ""), ("post", "/complete"), ("post", "/replay")]:
            with self.subTest(method=method, suffix=suffix):
                response = getattr(self.client, method)("/api/progress/" + APOLLO + suffix, json={})
                self.assertEqual(response.status_code, 401)

    def test_opaque_save_survives_reentry_and_is_private_to_guest(self) -> None:
        before = self.seed_other_progress()
        state = apollo_snapshot(3)
        state["apollo11"]["checks"] = ["antenna"]
        state["futureOptionalMetadata"] = {"quality": "low", "nested": [1, False, None]}
        saved = self.save(state, 37.5)
        self.assertEqual(saved["state"], state)
        self.assertEqual(saved["progressPercent"], 37.5)
        self.assertEqual(saved["status"], "in_progress")
        self.assertIsNotNone(saved["startedAt"])
        self.assertIsNone(saved["completedAt"])

        reentered = self.app.test_client().get("/api/progress/" + APOLLO, headers=self.headers)
        self.assertEqual(reentered.status_code, 200)
        self.assertEqual(reentered.get_json()["state"], state)
        second_guest = self.client.post("/api/auth/guest").get_json()
        stranger = self.client.get(
            "/api/progress/" + APOLLO,
            headers={"Authorization": "Bearer " + second_guest["token"]},
        ).get_json()
        self.assertEqual(stranger["state"], {})
        self.assertEqual(stranger["status"], "unlocked")
        self.assert_other_progress_unchanged(before)

    def test_first_apollo_save_clears_legacy_completion_only_on_its_row(self) -> None:
        before = self.seed_other_progress()
        row = self.row(APOLLO)
        row.status = "completed"
        row.progress_percent = 100
        row.state_json = {"tick": 240, "mission01": {"checkpoint": "Complete", "objectives": ["flight", "analysis"]}}
        row.report_json = {"summary": "Legacy 1926 engineering mission", "outcome": "success"}
        row.started_at = datetime(2026, 8, 1, 8)
        row.completed_at = datetime(2026, 8, 1, 9)
        db.session.commit()

        state = apollo_snapshot()
        saved = self.save(state, 0)
        self.assertEqual(saved["status"], "in_progress")
        self.assertEqual(saved["progressPercent"], 0)
        self.assertIsNone(saved["completedAt"])
        self.assertIsNone(saved["report"])
        self.assertEqual(saved["state"], state)
        self.assert_other_progress_unchanged(before)

        # A second save resumes the new mission rather than repeating migration.
        saved_again = self.save(apollo_snapshot(1), 12.5)
        self.assertEqual(saved_again["status"], "in_progress")
        self.assertEqual(saved_again["state"]["apollo11"]["checkpoint"], 1)
        self.assert_other_progress_unchanged(before)

    def test_unknown_schema_does_not_trigger_legacy_completion_migration(self) -> None:
        row = self.row(APOLLO)
        row.status = "completed"
        row.progress_percent = 100
        row.completed_at = datetime(2026, 8, 1, 9)
        row.report_json = {"summary": "Legacy report"}
        db.session.commit()
        state = apollo_snapshot()
        state["apollo11"]["version"] = "apollo11-v999"
        saved = self.save(state, 12.5)
        self.assertEqual(saved["status"], "completed")
        self.assertEqual(saved["report"], {"summary": "Legacy report"})
        self.assertIsNotNone(saved["completedAt"])

    def test_complete_stores_report_and_unlocks_next_without_overwriting_its_state(self) -> None:
        next_row = self.row(NEXT)
        next_row.state_json = {"retained": ["campaign-unlock"]}
        other_row = self.row(OTHER)
        other_row.state_json = {"retained": "third-mission"}
        db.session.commit()
        other_before = copy.deepcopy(other_row.to_dict())
        state = apollo_snapshot(done=True)
        self.save(state, 100)
        report = {
            "ticksSurvived": 215, "decisionsMade": 19, "samplesCollected": 0,
            "finalResources": state["resources"], "outcome": "success",
            "summary": "Apollo 11: eight support checkpoints complete.",
        }
        completed = self.client.post(
            "/api/progress/" + APOLLO + "/complete", headers=self.headers, json={"report": report},
        )
        self.assertEqual(completed.status_code, 200)
        result = completed.get_json()
        self.assertEqual(result["unlockedNext"], NEXT)
        self.assertEqual(result["progress"]["status"], "completed")
        self.assertEqual(result["progress"]["progressPercent"], 100)
        self.assertEqual(result["progress"]["state"], state)
        self.assertEqual(result["progress"]["report"], report)
        self.assertIsNotNone(result["progress"]["completedAt"])
        db.session.expire_all()
        self.assertEqual(self.row(NEXT).status, "unlocked")
        self.assertEqual(self.row(NEXT).state_json, {"retained": ["campaign-unlock"]})
        self.assertEqual(self.row(OTHER).to_dict(), other_before)

    def test_existing_apollo_completion_is_not_migrated_again_by_autosave(self) -> None:
        self.save(apollo_snapshot(done=True), 100)
        report = {"summary": "Apollo completion must remain", "outcome": "success"}
        completed = self.client.post(
            "/api/progress/" + APOLLO + "/complete", headers=self.headers, json={"report": report},
        )
        self.assertEqual(completed.status_code, 200)
        saved = self.save(apollo_snapshot(done=True), 100)
        self.assertEqual(saved["status"], "completed")
        self.assertEqual(saved["report"], report)
        self.assertIsNotNone(saved["completedAt"])

    def test_replay_clears_only_apollo_and_preserves_campaign_rows(self) -> None:
        before = self.seed_other_progress()
        self.save(apollo_snapshot(done=True), 100)
        row = self.row(APOLLO)
        row.report_json = {"summary": "Completed Apollo"}
        db.session.commit()
        replay = self.client.post("/api/progress/" + APOLLO + "/replay", headers=self.headers)
        self.assertEqual(replay.status_code, 200)
        replayed = replay.get_json()
        self.assertEqual(replayed["status"], "unlocked")
        self.assertEqual(replayed["progressPercent"], 0)
        self.assertEqual(replayed["state"], {})
        self.assertIsNone(replayed["report"])
        self.assertIsNone(replayed["startedAt"])
        self.assertIsNone(replayed["completedAt"])
        self.assert_other_progress_unchanged(before)
        self.assertEqual(self.save(apollo_snapshot(), 0)["status"], "in_progress")
        self.assert_other_progress_unchanged(before)


if __name__ == "__main__":
    unittest.main()
