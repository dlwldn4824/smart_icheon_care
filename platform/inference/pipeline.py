#!/usr/bin/env python3
"""
Executable MVP inference pipeline:
FrameSampler → YOLO → ByteTrack → EventManager → Geo → Risk → Priority → save/store
"""

from __future__ import annotations

import argparse
import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from backend.app.services.event_store import EventStore
from event.event_manager import EventManager
from geospatial.repository import PublicDataRepository
from inference.frame_sampler import FrameSampler
from priority.engine import PriorityEngine, PriorityInputs
from priority.priority_engine import MunicipalPriorityEngine
from risk.engine import IllegalInputs, RiskEngine
from risk.risk_engine import MunicipalRiskEngine
from tracking.bytetrack_wrapper import ByteTrackSession, write_tracker_yaml
from tracking.track_manager import MunicipalEvent
from utils.config import load_yaml
from utils.paths import ensure_dir, resolve_path


def _verdict_from_risk(risk_0_100: float) -> tuple[bool, str]:
    try:
        from content.inspect import verdict_from_risk

        return verdict_from_risk(risk_0_100)
    except Exception:
        score = float(risk_0_100 or 0)
        return (score >= 70), ("ILLEGAL_SUSPECT" if score >= 70 else "LOW_RISK")


@dataclass
class ScoredEvent:
    event: dict
    illegal: dict
    priority: dict
    geo_notes: list[str]
    risk_breakdown: dict | None = None
    source_mode: str = "VIDEO"


def resolve_weights(explicit: str | None) -> Path:
    if explicit:
        p = resolve_path(explicit)
        if not p.exists():
            raise FileNotFoundError(f"weights not found: {p}")
        return p
    # Prefer final release, then A/B winner (all), then filtered, then mvp
    for cand in (
        "weights/banner/final_all_30ep/best.pt",
        "weights/banner/experiment_all/best.pt",
        "weights/banner/experiment_filtered/best.pt",
        "weights/banner/best.pt",
    ):
        p = resolve_path(cand)
        if p.exists():
            return p
    print(
        "[pipeline] WARNING: banner weights missing. "
        "Using yolo11s.pt (COCO). Banner recall is not guaranteed."
    )
    return Path("yolo11s.pt")


def scored_to_store(s: ScoredEvent) -> dict:
    return {
        "event": s.event,
        "illegal": s.illegal,
        "priority": s.priority,
        "geo_notes": s.geo_notes,
        "risk_score": s.event.get("risk_score"),
        "risk_breakdown": s.risk_breakdown or s.event.get("risk_breakdown"),
        "priority_reason": s.priority.get("priority_reason"),
        "recommended_action": s.priority.get("recommended_action"),
        "source_mode": s.source_mode,
        "history": s.event.get("history") or [],
        "illegal_candidate": s.event.get("illegal_candidate"),
        "verdict": s.event.get("verdict"),
    }


class MunicipalVisionPipeline:
    def __init__(
        self,
        weights: str | Path,
        camera_id: str,
        sample_fps: float = 2.0,
        conf: float = 0.35,
        banner_only: bool = True,
        public_data_dir: str = "datasets/public_data",
        tracking_cfg: dict | None = None,
        persist_store: bool = True,
        events_dir: str | Path = "events",
        source_mode: str = "VIDEO",
        event_id_prefix: str | None = None,
        db_path: str | Path = "artifacts/events.db",
    ) -> None:
        self.camera_id = camera_id
        self.sample_fps = sample_fps
        self.conf = conf
        self.banner_only = banner_only
        self.persist_store = persist_store
        self.events_dir = ensure_dir(events_dir)
        self.source_mode = source_mode
        self.event_id_prefix = event_id_prefix
        tracking_cfg = tracking_cfg or {}
        tracker_yaml = write_tracker_yaml(
            resolve_path("configs/banner/bytetrack.yaml"),
            frame_rate=sample_fps,
        )
        self.session = ByteTrackSession.create(str(weights), str(tracker_yaml))
        self.events_mgr = EventManager(
            camera_id=camera_id,
            min_hits=int(tracking_cfg.get("min_hits", 3)),
            max_age=int(tracking_cfg.get("max_age", 30)),
            event_iou_threshold=float(tracking_cfg.get("event_iou_threshold", 0.5)),
            event_cooldown_seconds=float(tracking_cfg.get("event_cooldown_seconds", 300)),
        )
        self.repo = PublicDataRepository(public_data_dir)
        self.risk = RiskEngine()
        self.rule_risk = MunicipalRiskEngine()
        self.priority = PriorityEngine()
        self.rule_priority = MunicipalPriorityEngine()
        self.store = EventStore(db_path=db_path, events_dir=events_dir) if persist_store else None
        self._rep_frames: dict[str, np.ndarray] = {}
        self._frame_cache: dict[int, np.ndarray] = {}
        self._scored_by_id: dict[str, ScoredEvent] = {}

    def run(
        self,
        source: str,
        out_dir: Path,
        save_video: bool = False,
    ) -> list[ScoredEvent]:
        out_dir.mkdir(parents=True, exist_ok=True)
        self._scored_by_id.clear()
        self._rep_frames.clear()
        self._frame_cache.clear()
        sampler = FrameSampler(source, target_fps=self.sample_fps)
        detections_log: list[dict] = []
        tracks_log: list[dict] = []
        writer = None
        writer_path = out_dir / "result.mp4"

        for frame_idx, ts, frame in sampler.iter_frames():
            self._frame_cache[frame_idx] = frame.copy()
            tracked = self.session.update(frame, conf=self.conf)
            if self.banner_only:
                names = {t.class_name for t in tracked}
                if "banner" in names:
                    tracked = [t for t in tracked if t.class_name == "banner"]

            for t in tracked:
                detections_log.append(
                    {
                        "frame_index": frame_idx,
                        "timestamp": ts,
                        "track_id": t.track_id,
                        "class_name": t.class_name,
                        "confidence": t.confidence,
                        "bbox_xyxy": list(t.bbox_xyxy),
                    }
                )
                tracks_log.append(
                    {
                        "frame_index": frame_idx,
                        "track_id": t.track_id,
                        "bbox_xyxy": list(t.bbox_xyxy),
                        "confidence": t.confidence,
                    }
                )

            for upd in self.events_mgr.update(tracked, timestamp=ts, frame_index=frame_idx):
                self._handle_update(upd.event, out_dir)

            if save_video:
                vis = frame.copy()
                for t in tracked:
                    x1, y1, x2, y2 = map(int, t.bbox_xyxy)
                    cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(
                        vis,
                        f"id{t.track_id}:{t.confidence:.2f}",
                        (x1, max(20, y1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (0, 0, 255),
                        1,
                    )
                if writer is None:
                    h, w = vis.shape[:2]
                    writer = cv2.VideoWriter(
                        str(writer_path),
                        cv2.VideoWriter_fourcc(*"mp4v"),
                        max(self.sample_fps, 1.0),
                        (w, h),
                    )
                writer.write(vis)

        for upd in self.events_mgr.flush():
            self._handle_update(upd.event, out_dir)

        if writer is not None:
            writer.release()

        scored = list(self._scored_by_id.values())
        rep_dir = out_dir / "representative_frames"
        rep_dir.mkdir(exist_ok=True)
        for e in scored:
            eid = e.event["event_id"]
            if eid in self._rep_frames:
                path = rep_dir / f"{eid}.jpg"
                cv2.imwrite(str(path), self._rep_frames[eid])
                e.event["thumb_url"] = str(path)
                self._persist(e)

        (out_dir / "detections.json").write_text(
            json.dumps(detections_log, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "tracks.json").write_text(
            json.dumps(tracks_log, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "events.json").write_text(
            json.dumps([asdict(s) for s in scored], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return scored

    def _handle_update(self, evt: MunicipalEvent, out_dir: Path) -> None:
        scored = self._score(evt)
        eid = scored.event["event_id"]
        fr = self._frame_cache.get(evt.representative_frame_index)
        if fr is not None:
            self._rep_frames[eid] = fr
        self._scored_by_id[eid] = scored
        self._persist(scored)

    def _persist(self, scored: ScoredEvent) -> None:
        payload = scored_to_store(scored)
        eid = scored.event["event_id"]
        path = self.events_dir / f"event_{eid}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if self.store is not None:
            self.store.upsert(payload)

    def _score(self, evt: MunicipalEvent) -> ScoredEvent:
        geo = self.repo.build_context(self.camera_id)
        duration = max(evt.last_ts - evt.first_ts, 0.0)
        persist = min(duration / 600.0, 1.0)
        illegal = self.risk.calculate(
            IllegalInputs(
                permit_mismatch=geo.permit_mismatch,
                non_designated_location=geo.non_designated_location,
                expired_period=geo.expired_period,
                detection_persistence=persist,
                complaint_history=geo.complaint_norm,
                location_uncertain=geo.location_uncertain,
                permit_data_missing=geo.permit_data_missing,
            )
        )
        rule = self.rule_risk.from_geo(geo)
        band = self.rule_priority.calculate(
            rule.score, priority_reason=rule.priority_reason
        )
        # Keep weighted priority score for sorting / analytics
        pri = self.priority.calculate(
            PriorityInputs(
                illegal_likelihood=illegal.score,
                safety_risk=geo.safety_risk,
                vulnerable_zone=geo.vulnerable_norm,
                complaint_frequency=geo.complaint_norm,
                pedestrian_volume=geo.pedestrian_norm,
                detection_duration=persist,
            )
        )
        risk_0_100 = rule.score
        illegal_candidate, verdict = _verdict_from_risk(risk_0_100)
        eid = evt.event_id
        if self.event_id_prefix:
            raw_suffix = evt.event_id.rsplit("-E", 1)[-1]
            eid = f"{self.event_id_prefix}{raw_suffix}"

        event = {
            "event_id": eid,
            "camera_id": evt.camera_id,
            "track_id": evt.track_id,
            "class_name": evt.class_name,
            "det_conf": round(evt.best_confidence, 4),
            "bbox_xyxy": list(evt.best_bbox),
            "first_ts": evt.first_ts,
            "last_ts": evt.last_ts,
            "start_frame": getattr(evt, "start_frame", 0),
            "end_frame": getattr(evt, "end_frame", 0),
            "hit_count": evt.hit_count,
            "tracking_status": evt.status,
            "status": "DETECTED",
            "approx_lat": geo.approx_lat,
            "approx_lng": geo.approx_lng,
            "latitude": geo.approx_lat,
            "longitude": geo.approx_lng,
            "admin_district": geo.camera.admin_district,
            "district": geo.camera.admin_district,
            "location_name": geo.camera.location_name,
            "location_is_approximate": True,
            "detected_at": datetime.now(timezone.utc).isoformat(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_score": risk_0_100,
            "risk_breakdown": rule.risk_breakdown,
            "confidence": round(evt.best_confidence, 4),
            "source_mode": self.source_mode,
            "illegal_candidate": illegal_candidate,
            "verdict": verdict,
            "assignee": None,
            "department": None,
            "review_note": None,
            "action_note": None,
            "action_due_at": None,
            "confirmed_at": None,
            "assigned_at": None,
            "resolved_at": None,
            "dismiss_reason": None,
            "updated_by": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "history": [],
        }
        return ScoredEvent(
            event=event,
            illegal={
                **illegal.to_dict(),
                "score_0_100": risk_0_100,
                "rule_score": rule.to_dict(),
            },
            priority={
                **pri.to_dict(),
                "score": risk_0_100 / 100.0,
                "level": band.level,
                "label": band.label,
                "priority": band.priority,
                "priority_reason": band.priority_reason,
                "recommended_action": band.recommended_action,
                "reasons": band.reasons + rule.reasons,
            },
            geo_notes=geo.notes,
            risk_breakdown=rule.risk_breakdown,
            source_mode=self.source_mode,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Municipal Vision banner inference")
    parser.add_argument("--source", required=True)
    parser.add_argument("--task", default="banner")
    parser.add_argument("--weights", default=None)
    parser.add_argument("--camera-id", default="CCTV-001")
    parser.add_argument("--sample-fps", type=float, default=2.0)
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument("--save-video", action="store_true")
    parser.add_argument("--save-json", action="store_true", default=True)
    parser.add_argument("--no-store", action="store_true")
    parser.add_argument("--config", default="configs/banner/train.yaml")
    args = parser.parse_args()

    if args.task != "banner":
        raise SystemExit(f"Task '{args.task}' not enabled in MVP")

    tracking_cfg = {}
    try:
        cfg = load_yaml(args.config)
        tracking_cfg = cfg.get("tracking") or {}
    except FileNotFoundError:
        pass

    weights = resolve_weights(args.weights)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    out_dir = ensure_dir(f"runs/inference/{run_id}")
    src_path = Path(args.source)
    if src_path.is_file() and src_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
        tracking_cfg = {**tracking_cfg, "min_hits": 1}
    pipe = MunicipalVisionPipeline(
        weights=weights,
        camera_id=args.camera_id,
        sample_fps=args.sample_fps,
        conf=args.conf,
        tracking_cfg=tracking_cfg,
        persist_store=not args.no_store,
    )
    scored = pipe.run(args.source, out_dir=out_dir, save_video=args.save_video)
    print(f"[pipeline] events={len(scored)} → {out_dir}")
    print(f"[pipeline] events_dir={pipe.events_dir.resolve()}")
    print(f"[pipeline] weights={weights}")


if __name__ == "__main__":
    main()
