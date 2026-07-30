"""SQLite event store with workflow transitions + history."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from event.workflow import (
    ACTOR_REQUIRED,
    VALID_STATUS,
    apply_workflow_fields,
    assert_transition,
    normalize_status,
)
from utils.paths import ensure_dir

# Re-export for API imports
__all__ = ["EventStore", "VALID_STATUS", "ACTOR_REQUIRED"]


class EventStore:
    def __init__(
        self,
        db_path: str | Path = "artifacts/events.db",
        events_dir: str | Path | None = "events",
    ) -> None:
        self.db_path = ensure_dir(Path(db_path).parent) / Path(db_path).name
        self.events_dir = Path(events_dir) if events_dir else None
        if self.events_dir is not None:
            ensure_dir(self.events_dir)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                  event_id TEXT PRIMARY KEY,
                  payload TEXT NOT NULL,
                  status TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
                """
            )

    def clear(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM events")

    def upsert(self, scored: dict[str, Any]) -> dict[str, Any]:
        event = scored["event"]
        event_id = event["event_id"]
        status = normalize_status(event.get("status", "DETECTED"))
        event["status"] = status
        scored.setdefault("history", event.get("history") or scored.get("history") or [])
        if "history" not in event:
            event["history"] = scored["history"]
        now = datetime.now(timezone.utc).isoformat()
        event.setdefault("updated_at", now)
        payload = json.dumps(scored, ensure_ascii=False)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO events(event_id, payload, status, updated_at)
                VALUES(?,?,?,?)
                ON CONFLICT(event_id) DO UPDATE SET
                  payload=excluded.payload,
                  status=excluded.status,
                  updated_at=excluded.updated_at
                """,
                (event_id, payload, status, now),
            )
        self._write_json(scored)
        return self.get(event_id)

    def list(
        self,
        status: str | None = None,
        *,
        priority: str | None = None,
        district: str | None = None,
        department: str | None = None,
        assignee: str | None = None,
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT payload, status FROM events ORDER BY updated_at DESC"
            ).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            data = json.loads(r["payload"])
            data["event"]["status"] = normalize_status(r["status"])
            ev = data["event"]
            pri = (data.get("priority") or {}).get("priority") or (data.get("priority") or {}).get(
                "level"
            )
            if status and normalize_status(ev.get("status")) != normalize_status(status):
                continue
            if priority and str(pri) != priority:
                continue
            if district and (ev.get("district") or ev.get("admin_district")) != district:
                continue
            if department and ev.get("department") != department:
                continue
            if assignee and ev.get("assignee") != assignee:
                continue
            out.append(data)
        return out

    def get(self, event_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload, status FROM events WHERE event_id=?", (event_id,)
            ).fetchone()
        if not row:
            raise KeyError(event_id)
        data = json.loads(row["payload"])
        data["event"]["status"] = normalize_status(row["status"])
        data.setdefault("history", data["event"].get("history") or [])
        return data

    def transition(
        self,
        event_id: str,
        new_status: str,
        *,
        actor: str | None = None,
        assignee: str | None = None,
        department: str | None = None,
        action_due_at: str | None = None,
        note: str | None = None,
        review_note: str | None = None,
        action_note: str | None = None,
        dismiss_reason: str | None = None,
    ) -> dict[str, Any]:
        data = self.get(event_id)
        event = data["event"]
        old_status = normalize_status(event.get("status"))
        assert_transition(old_status, new_status)
        now = datetime.now(timezone.utc).isoformat()

        apply_workflow_fields(
            event,
            new_status,
            actor=actor,
            assignee=assignee,
            department=department,
            action_due_at=action_due_at,
            note=note,
            review_note=review_note,
            action_note=action_note,
            dismiss_reason=dismiss_reason,
            now=now,
        )

        hist_entry = {
            "from": old_status,
            "to": new_status,
            "actor": actor,
            "timestamp": now,
            "note": note or review_note or action_note or dismiss_reason,
        }
        history = list(data.get("history") or event.get("history") or [])
        history.append(hist_entry)
        data["history"] = history
        event["history"] = history

        with self._connect() as conn:
            conn.execute(
                "UPDATE events SET payload=?, status=?, updated_at=? WHERE event_id=?",
                (json.dumps(data, ensure_ascii=False), new_status, now, event_id),
            )
        self._write_json(data)
        return data

    def set_status(self, event_id: str, status: str, actor: str | None = None) -> dict[str, Any]:
        """Backward-compatible wrapper around transition()."""
        return self.transition(event_id, status, actor=actor)

    def _write_json(self, scored: dict[str, Any]) -> None:
        if self.events_dir is None:
            return
        eid = scored["event"]["event_id"]
        path = self.events_dir / f"event_{eid}.json"
        path.write_text(json.dumps(scored, ensure_ascii=False, indent=2), encoding="utf-8")
