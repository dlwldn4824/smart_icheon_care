"""FastAPI municipal vision API + operational dashboard."""

from __future__ import annotations

import base64
import json
import os
import tempfile
import uuid
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.app.services.event_store import ACTOR_REQUIRED, VALID_STATUS, EventStore
from event.workflow import normalize_status
from geospatial.repository import PublicDataRepository
from priority.engine import PriorityEngine, PriorityInputs
from priority.priority_engine import MunicipalPriorityEngine
from risk.engine import IllegalInputs, RiskEngine
from risk.risk_engine import MunicipalRiskEngine

app = FastAPI(
    title="AI Municipal Vision Platform API",
    version="0.4.1",
    description="Banner detection + municipal workflow decision-support API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_DB = os.environ.get("MUNICIPAL_EVENTS_DB", "artifacts/events.db")
_PUBLIC = os.environ.get("MUNICIPAL_PUBLIC_DATA", "datasets/public_data")

store = EventStore(db_path=_DB, events_dir="events")
risk_engine = RiskEngine()
rule_risk_engine = MunicipalRiskEngine()
priority_engine = PriorityEngine()
rule_priority_engine = MunicipalPriorityEngine()
repo = PublicDataRepository(_PUBLIC)

_runs = Path("runs")
_events = Path("events")
if _runs.exists():
    app.mount("/static/runs", StaticFiles(directory=str(_runs)), name="runs")
if _events.exists():
    app.mount("/static/events", StaticFiles(directory=str(_events)), name="events_static")


class RiskRequest(BaseModel):
    camera_id: str = "DEMO-CCTV-001"
    detection_persistence: float = Field(0.5, ge=0, le=1)
    permit_mismatch: float | None = None
    non_designated_location: float | None = None
    expired_period: float | None = None
    complaint_history: float | None = None
    location_uncertain: bool | None = None
    permit_data_missing: bool | None = None


class StatusPatch(BaseModel):
    status: str
    actor: str | None = None
    assignee: str | None = None
    department: str | None = None
    action_due_at: str | None = None
    note: str | None = None
    review_note: str | None = None
    action_note: str | None = None
    dismiss_reason: str | None = None


def _seed_deterministic_event() -> None:
    if store.list():
        return
    cam = "DEMO-CCTV-001" if repo.get_camera("DEMO-CCTV-001") else "CCTV-001"
    geo = repo.build_context(cam)
    illegal = risk_engine.calculate(
        IllegalInputs(
            permit_mismatch=geo.permit_mismatch,
            non_designated_location=geo.non_designated_location,
            expired_period=geo.expired_period,
            detection_persistence=0.7,
            complaint_history=geo.complaint_norm,
            location_uncertain=geo.location_uncertain,
            permit_data_missing=geo.permit_data_missing,
        )
    )
    rule = rule_risk_engine.from_geo(geo)
    band = rule_priority_engine.calculate(rule.score, priority_reason=rule.priority_reason)
    scored = {
        "event": {
            "event_id": f"{cam}-E0001",
            "camera_id": cam,
            "track_id": 1,
            "class_name": "banner",
            "det_conf": 0.94,
            "bbox_xyxy": [60.0, 80.0, 420.0, 220.0],
            "status": "DETECTED",
            "approx_lat": geo.approx_lat,
            "approx_lng": geo.approx_lng,
            "latitude": geo.approx_lat,
            "longitude": geo.approx_lng,
            "admin_district": geo.camera.admin_district,
            "district": geo.camera.admin_district,
            "location_name": geo.camera.location_name,
            "location_is_approximate": True,
            "detected_at": "2026-06-24T14:28:03+00:00",
            "risk_score": rule.score,
            "risk_breakdown": rule.risk_breakdown,
            "source_mode": "VIDEO",
            "history": [],
            "thumb_url": None,
        },
        "illegal": {
            **illegal.to_dict(),
            "score_0_100": rule.score,
            "rule_score": rule.to_dict(),
        },
        "priority": {
            "score": rule.score / 100.0,
            "level": band.level,
            "label": band.label,
            "priority": band.priority,
            "priority_reason": band.priority_reason,
            "recommended_action": band.recommended_action,
            "reasons": band.reasons,
        },
        "risk_score": rule.score,
        "risk_breakdown": rule.risk_breakdown,
        "priority_reason": band.priority_reason,
        "recommended_action": band.recommended_action,
        "geo_notes": geo.notes,
        "source_mode": "VIDEO",
        "history": [],
        "source": "seed_from_public_data_sample",
    }
    store.upsert(scored)


@app.on_event("startup")
def on_startup() -> None:
    _seed_deterministic_event()


@app.get("/health")
@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.4.1"}


def _thumb_http(path: str | None) -> str | None:
    if not path:
        return None
    p = str(path).replace("\\", "/")
    marker = "/runs/"
    if marker in p:
        return "/static/runs/" + p.split(marker, 1)[1]
    if p.startswith("runs/"):
        return "/static/" + p
    return None


def _build_inference_preview(
    source_path: Path,
    run_dir: Path,
    scored: list[Any],
) -> dict[str, Any]:
    """Draw boxes on a frame and return base64 + static URL for the dashboard UI."""
    import cv2
    import numpy as np

    detections: list[dict[str, Any]] = []
    det_file = run_dir / "detections.json"
    if det_file.exists():
        detections = json.loads(det_file.read_text(encoding="utf-8"))

    frame = cv2.imread(str(source_path))
    # For video, prefer a representative frame that has boxes
    if frame is None or source_path.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv"}:
        rep_dir = run_dir / "representative_frames"
        candidates = sorted(rep_dir.glob("*.jpg")) if rep_dir.exists() else []
        if candidates:
            frame = cv2.imread(str(candidates[0]))
        if frame is None and detections:
            # fall back: blank placeholder sized later isn't useful; try source again
            frame = cv2.imread(str(source_path))

    if frame is None:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            frame,
            "preview unavailable",
            (40, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (200, 200, 200),
            2,
        )

    vis = frame.copy()
    # Prefer event boxes (tracked); else raw detections on first frame
    boxes: list[dict[str, Any]] = []
    for s in scored:
        ev = s.event if hasattr(s, "event") else (s.get("event") or {})
        bbox = ev.get("bbox_xyxy")
        if not bbox or len(bbox) != 4:
            continue
        boxes.append(
            {
                "bbox_xyxy": [float(x) for x in bbox],
                "label": f"{ev.get('class_name', 'banner')} {float(ev.get('det_conf') or 0):.2f}",
                "event_id": ev.get("event_id"),
            }
        )
    if not boxes:
        frame0 = [d for d in detections if int(d.get("frame_index", 0)) == 0]
        use = frame0 or detections
        for d in use[:30]:
            bbox = d.get("bbox_xyxy") or []
            if len(bbox) != 4:
                continue
            boxes.append(
                {
                    "bbox_xyxy": [float(x) for x in bbox],
                    "label": f"{d.get('class_name', 'obj')} {float(d.get('confidence') or 0):.2f}",
                    "event_id": None,
                }
            )

    for b in boxes:
        x1, y1, x2, y2 = map(int, b["bbox_xyxy"])
        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 80, 255), 2)
        cv2.putText(
            vis,
            str(b["label"]),
            (x1, max(18, y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 80, 255),
            2,
            cv2.LINE_AA,
        )

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    web_id = f"{stamp}_{uuid.uuid4().hex[:8]}"
    web_dir = Path("runs/inference/web") / web_id
    web_dir.mkdir(parents=True, exist_ok=True)
    preview_path = web_dir / "preview.jpg"
    cv2.imwrite(str(preview_path), vis, [int(cv2.IMWRITE_JPEG_QUALITY), 88])

    ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    preview_b64 = None
    if ok:
        preview_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")

    return {
        "preview_base64": preview_b64,
        "preview_url": f"/static/runs/inference/web/{web_id}/preview.jpg",
        "boxes": boxes,
        "raw_detection_count": len(detections),
    }


def _flatten_event(item: dict[str, Any]) -> dict[str, Any]:
    ev = item.get("event") or {}
    illegal = item.get("illegal") or {}
    pri = item.get("priority") or {}
    breakdown = (
        ev.get("risk_breakdown")
        or item.get("risk_breakdown")
        or (illegal.get("rule_score") or {}).get("risk_breakdown")
        or (illegal.get("rule_score") or {}).get("breakdown")
        or {}
    )
    return {
        "event_id": ev.get("event_id"),
        "camera_id": ev.get("camera_id"),
        "track_id": ev.get("track_id"),
        "bbox": ev.get("bbox_xyxy"),
        "det_conf": ev.get("det_conf") or ev.get("confidence"),
        "risk_score": ev.get("risk_score", item.get("risk_score")),
        "risk_breakdown": breakdown,
        "priority": pri.get("priority") or pri.get("level"),
        "priority_label": pri.get("label"),
        "priority_reason": item.get("priority_reason") or pri.get("priority_reason"),
        "recommended_action": item.get("recommended_action") or pri.get("recommended_action"),
        "district": ev.get("district") or ev.get("admin_district"),
        "department": ev.get("department"),
        "assignee": ev.get("assignee"),
        "action_due_at": ev.get("action_due_at"),
        "latitude": ev.get("latitude", ev.get("approx_lat")),
        "longitude": ev.get("longitude", ev.get("approx_lng")),
        "status": normalize_status(ev.get("status")),
        "location_name": ev.get("location_name"),
        "thumb_url": _thumb_http(ev.get("thumb_url")),
        "source_mode": ev.get("source_mode") or item.get("source_mode") or "VIDEO",
        "demo_fallback": bool(ev.get("demo_fallback") or item.get("source_mode") == "DEMO_FALLBACK"),
        "detected_at": ev.get("detected_at"),
        "history": item.get("history") or ev.get("history") or [],
        "geo_notes": item.get("geo_notes") or [],
        "reasons": (pri.get("reasons") or []) + ((illegal.get("rule_score") or {}).get("reasons") or []),
        "raw": item,
    }


def _sort_events(rows: list[dict[str, Any]], sort: str) -> list[dict[str, Any]]:
    if sort == "detected_at":
        return sorted(
            rows,
            key=lambda x: str((x.get("event") or {}).get("detected_at") or ""),
            reverse=True,
        )
    if sort == "due_at":
        def due_key(x: dict[str, Any]) -> str:
            d = (x.get("event") or {}).get("action_due_at")
            return d or "9999-12-31T23:59:59"

        return sorted(rows, key=due_key)
    # default: risk_score desc
    return sorted(
        rows,
        key=lambda x: float((x.get("event") or {}).get("risk_score") or 0),
        reverse=True,
    )


@app.get("/events")
@app.get("/api/v1/events")
def list_events(
    status: str | None = None,
    priority: str | None = None,
    district: str | None = None,
    department: str | None = None,
    assignee: str | None = None,
    sort: str = "risk_score",
    flat: bool = False,
) -> list[dict[str, Any]]:
    if status and normalize_status(status) not in VALID_STATUS and status not in VALID_STATUS:
        # allow query only for known statuses
        if normalize_status(status) not in VALID_STATUS:
            raise HTTPException(400, f"invalid status; allowed={sorted(VALID_STATUS)}")
    rows = store.list(
        status=status,
        priority=priority,
        district=district,
        department=department,
        assignee=assignee,
    )
    rows_sorted = _sort_events(rows, sort)
    if flat:
        return [_flatten_event(r) for r in rows_sorted]
    return rows_sorted


@app.get("/events/{event_id}")
@app.get("/api/v1/events/{event_id}")
def get_event(event_id: str) -> dict[str, Any]:
    try:
        item = store.get(event_id)
    except KeyError as exc:
        raise HTTPException(404, "event not found") from exc
    return {"summary": _flatten_event(item), **item}


@app.get("/statistics")
@app.get("/api/v1/statistics")
def statistics() -> dict[str, Any]:
    rows = store.list()
    by_priority: Counter[str] = Counter()
    by_district: Counter[str] = Counter()
    by_status: Counter[str] = Counter()
    for r in rows:
        flat = _flatten_event(r)
        by_priority[str(flat["priority"] or "unknown")] += 1
        by_district[str(flat["district"] or "unknown")] += 1
        by_status[str(flat["status"] or "unknown")] += 1
    return {
        "total_events": len(rows),
        "review_pending": by_status.get("REVIEW_PENDING", 0) + by_status.get("DETECTED", 0),
        "critical": by_priority.get("Critical", 0),
        "in_progress": by_status.get("IN_PROGRESS", 0) + by_status.get("ASSIGNED", 0),
        "resolved": by_status.get("RESOLVED", 0),
        "by_priority": dict(by_priority),
        "by_district": dict(by_district),
        "by_status": dict(by_status),
    }


@app.patch("/api/v1/events/{event_id}/status")
@app.patch("/events/{event_id}/status")
def patch_status(event_id: str, body: StatusPatch) -> dict[str, Any]:
    if body.status in ACTOR_REQUIRED and not (body.actor and body.actor.strip()):
        raise HTTPException(400, f"{body.status} requires actor")
    try:
        return store.transition(
            event_id,
            body.status,
            actor=body.actor,
            assignee=body.assignee,
            department=body.department,
            action_due_at=body.action_due_at,
            note=body.note,
            review_note=body.review_note,
            action_note=body.action_note,
            dismiss_reason=body.dismiss_reason,
        )
    except KeyError as exc:
        raise HTTPException(404, "event not found") from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/v1/risk/calculate")
def calculate_risk(body: RiskRequest) -> dict[str, Any]:
    geo = repo.build_context(body.camera_id)
    illegal = risk_engine.calculate(
        IllegalInputs(
            permit_mismatch=body.permit_mismatch
            if body.permit_mismatch is not None
            else geo.permit_mismatch,
            non_designated_location=body.non_designated_location
            if body.non_designated_location is not None
            else geo.non_designated_location,
            expired_period=body.expired_period
            if body.expired_period is not None
            else geo.expired_period,
            detection_persistence=body.detection_persistence,
            complaint_history=body.complaint_history
            if body.complaint_history is not None
            else geo.complaint_norm,
            location_uncertain=body.location_uncertain
            if body.location_uncertain is not None
            else geo.location_uncertain,
            permit_data_missing=body.permit_data_missing
            if body.permit_data_missing is not None
            else geo.permit_data_missing,
        )
    )
    rule = rule_risk_engine.from_geo(geo)
    band = rule_priority_engine.calculate(rule.score, priority_reason=rule.priority_reason)
    return {
        "camera_id": body.camera_id,
        "risk_score": rule.score,
        "risk_breakdown": rule.risk_breakdown,
        "priority": band.priority,
        "priority_reason": band.priority_reason,
        "recommended_action": band.recommended_action,
        "illegal": {
            **illegal.to_dict(),
            "score_0_100": rule.score,
            "rule_score": rule.to_dict(),
        },
        "geo_notes": geo.notes,
        "requires_human_review": True,
    }


@app.post("/api/v1/inference/image")
async def infer_image(
    file: UploadFile = File(...),
    camera_id: str = Form("CCTV-001"),
    conf: float = Form(0.35),
) -> dict[str, Any]:
    from inference.pipeline import MunicipalVisionPipeline, resolve_weights, scored_to_store

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        weights = resolve_weights(None)
        run_dir = Path(tempfile.mkdtemp(prefix="infer_img_"))
        pipe = MunicipalVisionPipeline(
            weights=weights,
            camera_id=camera_id,
            sample_fps=1.0,
            conf=conf,
            tracking_cfg={"min_hits": 1, "max_age": 30},
            persist_store=False,
            public_data_dir=_PUBLIC,
            source_mode="IMAGE",
        )
        scored = pipe.run(str(tmp_path), out_dir=run_dir, save_video=False)
        saved = [store.upsert(scored_to_store(s)) for s in scored]
        preview = _build_inference_preview(tmp_path, run_dir, scored)
        return {
            "events": saved,
            "count": len(saved),
            "weights": str(weights),
            "filename": file.filename,
            "camera_id": camera_id,
            "conf": conf,
            **preview,
        }
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/api/v1/inference/video")
async def infer_video(
    file: UploadFile = File(...),
    camera_id: str = Form("CCTV-001"),
    sample_fps: float = Form(2.0),
    conf: float = Form(0.35),
) -> dict[str, Any]:
    from inference.pipeline import MunicipalVisionPipeline, resolve_weights, scored_to_store

    suffix = Path(file.filename or "upload.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        weights = resolve_weights(None)
        run_dir = Path(tempfile.mkdtemp(prefix="infer_vid_"))
        pipe = MunicipalVisionPipeline(
            weights=weights,
            camera_id=camera_id,
            sample_fps=sample_fps,
            conf=conf,
            persist_store=False,
            public_data_dir=_PUBLIC,
            source_mode="VIDEO",
        )
        scored = pipe.run(str(tmp_path), out_dir=run_dir, save_video=False)
        saved = [store.upsert(scored_to_store(s)) for s in scored]
        preview = _build_inference_preview(tmp_path, run_dir, scored)
        return {
            "events": saved,
            "count": len(saved),
            "weights": str(weights),
            "filename": file.filename,
            "camera_id": camera_id,
            "conf": conf,
            **preview,
        }
    finally:
        tmp_path.unlink(missing_ok=True)


DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>스마트이천케어 · 운영 대시보드</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  :root { --bg:#0f172a; --card:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; --danger:#f87171; --ok:#34d399; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Pretendard","Apple SD Gothic Neo",sans-serif; background:var(--bg); color:var(--text); }
  header { padding:14px 18px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
  h1 { margin:0; font-size:17px; }
  .sub { color:var(--muted); font-size:12px; margin-top:4px; }
  .stats { display:flex; gap:8px; padding:10px 18px; flex-wrap:wrap; border-bottom:1px solid #334155; }
  .chip { background:var(--card); border-radius:10px; padding:10px 12px; min-width:110px; }
  .chip b { display:block; font-size:18px; margin-top:2px; }
  .filters { display:flex; gap:8px; padding:10px 18px; flex-wrap:wrap; align-items:center; border-bottom:1px solid #334155; }
  select, input, button { background:#0f172a; color:var(--text); border:1px solid #475569; border-radius:8px; padding:7px 10px; }
  button.primary { background:var(--accent); color:#0f172a; border:0; font-weight:700; cursor:pointer; }
  button.act { cursor:pointer; margin:3px 4px 3px 0; }
  .wrap { display:grid; grid-template-columns: 1.15fr 1fr 1.1fr; gap:10px; padding:10px 18px 18px; height: calc(100vh - 170px); }
  #map { width:100%; height:100%; border-radius:12px; }
  .panel { background:var(--card); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
  .panel h2 { margin:0; font-size:13px; padding:10px 12px; border-bottom:1px solid #334155; }
  .list { overflow:auto; flex:1; }
  .item { padding:10px 12px; border-bottom:1px solid #334155; cursor:pointer; }
  .item:hover, .item.active { background:#334155; }
  .prio { font-weight:700; color:var(--accent); }
  .prio.Critical { color:var(--danger); }
  .badge { display:inline-block; font-size:10px; padding:2px 6px; border-radius:999px; background:#0f172a; margin-left:4px; }
  .badge.fallback { background:#92400e; color:#fde68a; }
  .detail { overflow:auto; flex:1; padding:12px; font-size:13px; }
  .muted { color:var(--muted); }
  .bar { display:flex; align-items:center; gap:8px; margin:4px 0; font-size:12px; }
  .bar .track { flex:1; height:8px; background:#0f172a; border-radius:99px; overflow:hidden; }
  .bar .fill { height:100%; background:var(--accent); }
  .hist li { margin:4px 0; }
  @media (max-width: 1100px) { .wrap { grid-template-columns:1fr; height:auto; } #map { height:280px; } }
</style>
</head>
<body>
<header>
  <div>
    <h1>AI 기반 지자체 도시관리 · 운영 대시보드</h1>
    <div class="sub">YOLO → ByteTrack → Event → 공공데이터 Join → Risk → Priority → Workflow</div>
  </div>
  <button class="primary" onclick="loadAll()">새로고침</button>
</header>
<div class="stats" id="stats"></div>
<div class="filters">
  <label>Priority <select id="fPriority"><option value="">전체</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
  <label>Status <select id="fStatus"><option value="">전체</option>
    <option>DETECTED</option><option>REVIEW_PENDING</option><option>CONFIRMED</option>
    <option>ASSIGNED</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>DISMISSED</option>
  </select></label>
  <label>District <input id="fDistrict" placeholder="설봉동" style="width:100px"/></label>
  <label>Department <input id="fDept" placeholder="도시관리과" style="width:110px"/></label>
  <label>Assignee <input id="fAssignee" placeholder="김담당" style="width:90px"/></label>
  <label>정렬 <select id="fSort">
    <option value="risk_score">risk 높은 순</option>
    <option value="detected_at">최신 탐지 순</option>
    <option value="due_at">처리 기한 임박 순</option>
  </select></label>
  <button onclick="loadAll()">적용</button>
</div>
<div class="wrap">
  <div id="map"></div>
  <div class="panel">
    <h2>사건 목록</h2>
    <div class="list" id="list"></div>
  </div>
  <div class="panel">
    <h2>상세 · 조치</h2>
    <div class="detail" id="detail"><span class="muted">이벤트를 선택하세요</span></div>
  </div>
</div>
<script>
let map, markers = [], selected = null, allEvents = [];
map = L.map('map').setView([37.284, 127.433], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

function q() {
  const p = new URLSearchParams({ flat: 'true', sort: document.getElementById('fSort').value });
  const pr = document.getElementById('fPriority').value; if (pr) p.set('priority', pr);
  const st = document.getElementById('fStatus').value; if (st) p.set('status', st);
  const d = document.getElementById('fDistrict').value.trim(); if (d) p.set('district', d);
  const dep = document.getElementById('fDept').value.trim(); if (dep) p.set('department', dep);
  const a = document.getElementById('fAssignee').value.trim(); if (a) p.set('assignee', a);
  return p.toString();
}

async function loadAll() {
  const [events, stats] = await Promise.all([
    fetch('/events?' + q()).then(r => r.json()),
    fetch('/statistics').then(r => r.json()),
  ]);
  allEvents = events;
  document.getElementById('stats').innerHTML = `
    <div class="chip">전체 사건<b>${stats.total_events}</b></div>
    <div class="chip">검토 대기<b>${stats.review_pending||0}</b></div>
    <div class="chip">Critical<b>${stats.critical||0}</b></div>
    <div class="chip">처리 중<b>${stats.in_progress||0}</b></div>
    <div class="chip">완료<b>${stats.resolved||0}</b></div>
  `;
  const list = document.getElementById('list');
  list.innerHTML = '';
  markers.forEach(m => map.removeLayer(m)); markers = [];
  events.forEach(e => {
    const el = document.createElement('div');
    el.className = 'item' + (selected===e.event_id?' active':'');
    const fb = (e.source_mode==='DEMO_FALLBACK' || e.demo_fallback)
      ? '<span class="badge fallback">DEMO_FALLBACK</span>' : '<span class="badge">'+ (e.source_mode||'VIDEO') +'</span>';
    el.innerHTML = `<div><span class="prio ${e.priority}">${e.priority||'-'}</span> · Risk ${e.risk_score} ${fb}
      <div class="muted">${e.district||''} · ${e.status} · ${e.event_id}</div></div>`;
    el.onclick = () => showDetail(e.event_id);
    list.appendChild(el);
    if (e.latitude && e.longitude) {
      const m = L.circleMarker([e.latitude, e.longitude], {
        radius: 8, color: '#f87171', fillColor: '#f87171', fillOpacity: 0.8
      }).addTo(map).bindPopup(`${e.event_id}<br/>${e.priority} / ${e.risk_score}`);
      m.on('click', () => showDetail(e.event_id));
      markers.push(m);
    }
  });
  if (selected) showDetail(selected);
  else if (events[0]) showDetail(events[0].event_id);
}

function breakdownBars(bd) {
  if (!bd) return '';
  return Object.entries(bd).map(([k,v]) => `
    <div class="bar"><span style="width:140px">${k}</span>
      <div class="track"><div class="fill" style="width:${Math.min(100,v)}%"></div></div>
      <span>${v}</span></div>`).join('');
}

async function act(status, extra={}) {
  if (!selected) return;
  const body = { status, actor: extra.actor || '대시보드담당자', ...extra };
  const r = await fetch('/api/v1/events/' + selected + '/status', {
    method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const t = await r.text();
  if (!r.ok) { alert('상태 변경 실패: ' + t); return; }
  await loadAll();
}

function showDetail(id) {
  selected = id;
  const e = allEvents.find(x => x.event_id === id);
  if (!e) return;
  document.querySelectorAll('.item').forEach(x => x.classList.remove('active'));
  const hist = (e.history||[]).map(h => `<li>${h.timestamp}: ${h.from} → <b>${h.to}</b> (${h.actor||'-'}) ${h.note||''}</li>`).join('') || '<li class="muted">이력 없음</li>';
  const img = e.thumb_url ? `<img src="${e.thumb_url}" style="width:100%;max-height:160px;object-fit:contain;border-radius:8px;background:#0f172a;margin:8px 0"/>` : '';
  const fb = (e.source_mode==='DEMO_FALLBACK') ? '<span class="badge fallback">DEMO_FALLBACK</span>' : `<span class="badge">${e.source_mode||'VIDEO'}</span>`;
  document.getElementById('detail').innerHTML = `
    <div><b>${e.event_id}</b> ${fb}</div>
    <div class="muted">${e.location_name||'-'} (${e.district||'-'}) · CCTV ${e.camera_id}</div>
    <div>좌표 ${e.latitude}, ${e.longitude} · track_id ${e.track_id} · conf ${e.det_conf}</div>
    <div>Priority <span class="prio ${e.priority}">${e.priority}</span> · Risk <b>${e.risk_score}</b> · Status <b>${e.status}</b></div>
    ${img}
    <div style="margin-top:8px"><b>위험도 항목별 근거</b>${breakdownBars(e.risk_breakdown)}</div>
    <div style="margin-top:8px"><b>우선순위 사유</b><div>${e.priority_reason||'-'}</div></div>
    <div style="margin-top:6px"><b>추천 조치</b><div>${e.recommended_action||'-'}</div></div>
    <div style="margin-top:6px"><b>관련 공공데이터</b><ul>${(e.geo_notes||[]).map(n=>`<li>${n}</li>`).join('')||'<li class="muted">-</li>'}</ul></div>
    <div>담당자: ${e.assignee||'-'} / ${e.department||'-'} · 기한 ${e.action_due_at||'-'}</div>
    <div style="margin-top:8px">
      <button class="act" onclick='act("REVIEW_PENDING",{note:"불법 가능성 검토"})'>불법 가능성 확인</button>
      <button class="act" onclick='act("DISMISSED",{dismiss_reason:"오탐",note:"오탐 제외"})'>오탐 제외</button>
      <button class="act" onclick='act("CONFIRMED",{actor:"대시보드담당자",note:"현장 확인 필요"})'>확정</button>
      <button class="act" onclick='act("ASSIGNED",{actor:"관리자",assignee:"김담당",department:"도시관리과",action_due_at:"2026-07-30T18:00:00",note:"학교 인접 구간 우선 확인"})'>담당자 배정</button>
      <button class="act" onclick='act("IN_PROGRESS",{note:"현장 출동"})'>처리 시작</button>
      <button class="act" onclick='act("RESOLVED",{actor:"김담당",action_note:"조치 완료"})'>조치 완료</button>
    </div>
    <div style="margin-top:10px"><b>상태 변경 이력</b><ul class="hist">${hist}</ul></div>
  `;
  if (e.latitude && e.longitude) map.setView([e.latitude, e.longitude], 14);
}

loadAll();
setInterval(loadAll, 20000);
</script>
</body>
</html>
"""


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard() -> HTMLResponse:
    return HTMLResponse(DASHBOARD_HTML)


@app.get("/", response_class=HTMLResponse)
def root() -> HTMLResponse:
    return HTMLResponse(
        '<meta http-equiv="refresh" content="0; url=/dashboard"/>'
        '<a href="/dashboard">Open Dashboard</a> · <a href="/docs">API Docs</a>'
    )
