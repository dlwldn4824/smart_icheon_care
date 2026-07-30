"""Workflow state machine + EventStore transition tests."""

from __future__ import annotations

import pytest

from backend.app.services.event_store import EventStore
from event.workflow import ACTOR_REQUIRED, can_transition, normalize_status
from priority.priority_engine import MunicipalPriorityEngine
from risk.risk_engine import MunicipalRiskEngine, RuleRiskInputs


def _base_event(event_id: str = "T-E0001") -> dict:
    rule = MunicipalRiskEngine().calculate(
        RuleRiskInputs(
            complaint_hotspot=True,
            school_zone=True,
            high_population=True,
            no_permission=True,
            far_from_legal_board=True,
        )
    )
    band = MunicipalPriorityEngine().calculate(rule.score, priority_reason=rule.priority_reason)
    return {
        "event": {
            "event_id": event_id,
            "camera_id": "DEMO-CCTV-001",
            "track_id": 1,
            "status": "DETECTED",
            "district": "설봉동",
            "risk_score": rule.score,
            "risk_breakdown": rule.risk_breakdown,
            "detected_at": "2026-07-27T00:00:00+00:00",
            "history": [],
            "source_mode": "VIDEO",
        },
        "priority": {
            "priority": band.priority,
            "priority_reason": band.priority_reason,
            "recommended_action": band.recommended_action,
            "score": rule.score / 100.0,
            "level": band.level,
        },
        "risk_breakdown": rule.risk_breakdown,
        "history": [],
        "source_mode": "VIDEO",
    }


def test_normalize_legacy_status():
    assert normalize_status("NEW") == "DETECTED"
    assert normalize_status("FINISHED") == "DETECTED"
    assert normalize_status("REVIEWING") == "REVIEW_PENDING"


def test_valid_and_invalid_transitions():
    assert can_transition("DETECTED", "REVIEW_PENDING")
    assert can_transition("REVIEW_PENDING", "CONFIRMED")
    assert can_transition("CONFIRMED", "ASSIGNED")
    assert can_transition("ASSIGNED", "IN_PROGRESS")
    assert can_transition("IN_PROGRESS", "RESOLVED")
    assert not can_transition("DETECTED", "CONFIRMED")
    assert not can_transition("RESOLVED", "ASSIGNED")


def test_happy_path_transitions(tmp_path):
    store = EventStore(db_path=tmp_path / "e.db", events_dir=tmp_path / "events")
    store.upsert(_base_event())
    store.transition("T-E0001", "REVIEW_PENDING", actor="officer", note="검토")
    store.transition("T-E0001", "CONFIRMED", actor="officer", note="불법 가능성")
    store.transition(
        "T-E0001",
        "ASSIGNED",
        actor="관리자",
        assignee="김담당",
        department="도시관리과",
        action_due_at="2026-07-30T18:00:00",
        note="학교 인접 구간 우선 확인",
    )
    store.transition("T-E0001", "IN_PROGRESS", actor="김담당", note="출동")
    data = store.transition("T-E0001", "RESOLVED", actor="김담당", action_note="완료")
    assert data["event"]["status"] == "RESOLVED"
    assert data["event"]["assignee"] == "김담당"
    assert data["event"]["department"] == "도시관리과"
    assert len(data["history"]) == 5
    assert data["history"][-1]["from"] == "IN_PROGRESS"
    assert data["history"][-1]["to"] == "RESOLVED"
    assert (tmp_path / "events" / "event_T-E0001.json").exists()


def test_invalid_transition_raises(tmp_path):
    store = EventStore(db_path=tmp_path / "e.db", events_dir=tmp_path / "events")
    store.upsert(_base_event())
    with pytest.raises(ValueError, match="invalid transition"):
        store.transition("T-E0001", "CONFIRMED", actor="officer")


def test_actor_required(tmp_path):
    store = EventStore(db_path=tmp_path / "e.db", events_dir=tmp_path / "events")
    store.upsert(_base_event())
    store.transition("T-E0001", "REVIEW_PENDING")
    for st in sorted(ACTOR_REQUIRED):
        # reset path to REVIEW_PENDING only once then CONFIRMED needs actor
        pass
    with pytest.raises(ValueError, match="requires actor"):
        store.transition("T-E0001", "CONFIRMED", actor=None)


def test_assign_requires_assignee(tmp_path):
    store = EventStore(db_path=tmp_path / "e.db", events_dir=tmp_path / "events")
    store.upsert(_base_event())
    store.transition("T-E0001", "REVIEW_PENDING")
    store.transition("T-E0001", "CONFIRMED", actor="officer")
    with pytest.raises(ValueError, match="assignee"):
        store.transition("T-E0001", "ASSIGNED", actor="관리자")


def test_risk_breakdown_sum_and_bounds():
    eng = MunicipalRiskEngine()
    r = eng.calculate(
        RuleRiskInputs(
            complaint_hotspot=True,
            school_zone=True,
            high_population=True,
            no_permission=True,
            far_from_legal_board=True,
        )
    )
    assert abs(sum(r.risk_breakdown.values()) - r.score) < 1e-6
    assert 0 <= r.score <= 100
    assert r.score == 100.0
    assert set(r.risk_breakdown) == {
        "base",
        "complaint_hotspot",
        "school_zone",
        "high_population",
        "no_permission",
        "far_from_legal_board",
    }


def test_priority_boundaries():
    eng = MunicipalPriorityEngine()
    assert eng.calculate(90).priority == "Critical"
    assert eng.calculate(89.9).priority == "High"
    assert eng.calculate(70).priority == "High"
    assert eng.calculate(69.9).priority == "Medium"
    assert eng.calculate(40).priority == "Medium"
    assert eng.calculate(39.9).priority == "Low"


def test_demo_fallback_field_persisted(tmp_path):
    store = EventStore(db_path=tmp_path / "e.db", events_dir=tmp_path / "events")
    payload = _base_event("DEMO-E0001")
    payload["event"]["source_mode"] = "DEMO_FALLBACK"
    payload["event"]["demo_fallback"] = True
    payload["source_mode"] = "DEMO_FALLBACK"
    store.upsert(payload)
    got = store.get("DEMO-E0001")
    assert got["event"]["source_mode"] == "DEMO_FALLBACK"
    assert got["source_mode"] == "DEMO_FALLBACK"
