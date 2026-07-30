#!/usr/bin/env python3
"""
End-to-end demo / API / workflow / pytest verification for release gate.

Does not invent detection metrics. Fails clearly if final weights are absent
when --require-final is set.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print(f"[verify] $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=str(ROOT), check=check)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-final", action="store_true")
    parser.add_argument("--skip-pytest", action="store_true")
    parser.add_argument("--skip-demo", action="store_true")
    args = parser.parse_args()

    final = ROOT / "weights/banner/final_all_30ep/best.pt"
    release = ROOT / "weights/banner/release/best.pt"
    weights = final if final.exists() else (release if release.exists() else None)
    if args.require_final and weights is None:
        raise SystemExit("[verify] final/release best.pt missing — train first")

    results = {"weights": str(weights) if weights else None, "checks": {}}

    # Risk / Priority rule engines
    from geospatial.repository import PublicDataRepository
    from priority.priority_engine import MunicipalPriorityEngine
    from risk.risk_engine import MunicipalRiskEngine

    repo = PublicDataRepository("fixtures/demo_public_data")
    geo = repo.build_context("DEMO-CCTV-001")
    rule = MunicipalRiskEngine().from_geo(geo)
    band = MunicipalPriorityEngine().calculate(rule.score, priority_reason=rule.priority_reason)
    assert 0 <= rule.score <= 100
    assert band.priority in {"Critical", "High", "Medium", "Low"}
    results["checks"]["risk_priority"] = {
        "risk_score": rule.score,
        "priority": band.priority,
        "ok": True,
    }
    print(f"[verify] risk={rule.score} priority={band.priority}")

    # Workflow transitions
    from backend.app.services.event_store import EventStore
    from event.workflow import can_transition

    assert can_transition("DETECTED", "REVIEW_PENDING")
    assert not can_transition("DETECTED", "CONFIRMED")
    store = EventStore(db_path="artifacts/verify_events.db", events_dir="artifacts/verify_events_json")
    store.clear()
    store.upsert(
        {
            "event": {
                "event_id": "VERIFY-E0001",
                "camera_id": "DEMO-CCTV-001",
                "status": "DETECTED",
                "district": "설봉동",
                "risk_score": rule.score,
                "history": [],
                "source_mode": "VIDEO",
            },
            "priority": {"priority": band.priority, "score": rule.score / 100.0},
            "history": [],
            "source_mode": "VIDEO",
        }
    )
    store.transition("VERIFY-E0001", "REVIEW_PENDING", note="verify")
    store.transition("VERIFY-E0001", "CONFIRMED", actor="verify-officer")
    store.transition(
        "VERIFY-E0001",
        "ASSIGNED",
        actor="관리자",
        assignee="김담당",
        department="도시관리과",
        action_due_at="2026-07-30T18:00:00",
        note="verify assign",
    )
    results["checks"]["workflow"] = {"ok": True, "status": store.get("VERIFY-E0001")["event"]["status"]}
    print("[verify] workflow OK →", results["checks"]["workflow"]["status"])

    # FastAPI health + statistics + dashboard
    from fastapi.testclient import TestClient
    import backend.app.main as main_mod

    with TestClient(main_mod.app) as client:
        h = client.get("/health")
        assert h.status_code == 200
        st = client.get("/statistics")
        assert st.status_code == 200
        dash = client.get("/dashboard")
        assert dash.status_code == 200
        assert "leaflet" in dash.text.lower() or "map" in dash.text.lower()
        results["checks"]["api_dashboard"] = {
            "health": h.json(),
            "total_events": st.json().get("total_events"),
            "ok": True,
        }
    print("[verify] API + Dashboard OK")

    # Demo modes if weights present
    if weights and not args.skip_demo:
        from scripts.finalize_banner_model import run_demo_modes

        demo = run_demo_modes(Path(weights))
        results["checks"]["demo"] = demo
        print("[verify] demo VIDEO events=", demo["video"]["events"], "FALLBACK=", demo["fallback"]["events"])
    else:
        results["checks"]["demo"] = {"skipped": True}

    if not args.skip_pytest:
        cp = run(
            [sys.executable, "-m", "pytest", "tests/test_workflow.py", "tests/test_municipal_rules.py", "tests/test_api.py", "tests/test_event_manager.py", "-q"],
            check=False,
        )
        results["checks"]["pytest"] = {"returncode": cp.returncode, "ok": cp.returncode == 0}
        if cp.returncode != 0:
            raise SystemExit("[verify] pytest failed")
    else:
        results["checks"]["pytest"] = {"skipped": True}

    out = ROOT / "artifacts/verify_demo_report.json"
    import json

    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[verify] wrote {out}")
    print("[verify] ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
