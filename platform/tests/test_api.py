"""API workflow / statistics tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import _seed_deterministic_event, app, store


def _ensure_detected_event() -> str:
    _seed_deterministic_event()
    rows = store.list()
    assert rows
    # Reset first event to DETECTED for deterministic transitions
    eid = rows[0]["event"]["event_id"]
    data = store.get(eid)
    data["event"]["status"] = "DETECTED"
    data["history"] = []
    data["event"]["history"] = []
    data["event"]["assignee"] = None
    store.upsert(data)
    return eid


def test_health():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


def test_list_and_statistics():
    _ensure_detected_event()
    with TestClient(app) as client:
        r = client.get("/api/v1/events")
        assert r.status_code == 200
        assert len(r.json()) >= 1
        st = client.get("/api/v1/statistics").json()
        assert "total_events" in st
        assert "by_status" in st
        assert "critical" in st
        assert "review_pending" in st


def test_invalid_transition_http_400():
    eid = _ensure_detected_event()
    with TestClient(app) as client:
        bad = client.patch(
            f"/api/v1/events/{eid}/status",
            json={"status": "CONFIRMED", "actor": "officer"},
        )
        assert bad.status_code == 400


def test_actor_required_http_400():
    eid = _ensure_detected_event()
    with TestClient(app) as client:
        client.patch(
            f"/api/v1/events/{eid}/status",
            json={"status": "REVIEW_PENDING"},
        )
        bad = client.patch(
            f"/api/v1/events/{eid}/status",
            json={"status": "CONFIRMED"},
        )
        assert bad.status_code == 400


def test_assign_workflow_and_history():
    eid = _ensure_detected_event()
    with TestClient(app) as client:
        assert client.patch(
            f"/api/v1/events/{eid}/status",
            json={"status": "REVIEW_PENDING", "note": "검토"},
        ).status_code == 200
        assert client.patch(
            f"/api/v1/events/{eid}/status",
            json={"status": "CONFIRMED", "actor": "officer-kim"},
        ).status_code == 200
        ok = client.patch(
            f"/api/v1/events/{eid}/status",
            json={
                "status": "ASSIGNED",
                "actor": "관리자",
                "assignee": "김담당",
                "department": "도시관리과",
                "action_due_at": "2026-07-30T18:00:00",
                "note": "학교 인접 구간 우선 확인",
            },
        )
        assert ok.status_code == 200
        body = ok.json()
        assert body["event"]["status"] == "ASSIGNED"
        assert body["event"]["assignee"] == "김담당"
        assert body["event"]["department"] == "도시관리과"
        assert any(h["to"] == "ASSIGNED" for h in body["history"])


def test_risk_calculate_breakdown():
    with TestClient(app) as client:
        r = client.post(
            "/api/v1/risk/calculate",
            json={"camera_id": "DEMO-CCTV-001", "detection_persistence": 0.7},
        )
        # camera may be missing in default public data — try CCTV-001 fallback
        if r.status_code != 200:
            r = client.post(
                "/api/v1/risk/calculate",
                json={"camera_id": "CCTV-001", "detection_persistence": 0.7},
            )
        assert r.status_code == 200
        body = r.json()
        assert "risk_score" in body
        assert "risk_breakdown" in body
        assert abs(sum(body["risk_breakdown"].values()) - body["risk_score"]) < 1e-6
        assert 0 <= body["risk_score"] <= 100
        assert "priority_reason" in body
        assert "recommended_action" in body


def test_flat_events_include_source_mode():
    _ensure_detected_event()
    with TestClient(app) as client:
        rows = client.get("/events?flat=true").json()
        assert rows
        assert "source_mode" in rows[0]
        assert "risk_breakdown" in rows[0]
