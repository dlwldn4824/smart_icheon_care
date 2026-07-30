#!/usr/bin/env python3
"""
One-command municipal vision demo:

  CCTV sample → YOLO → ByteTrack → Event → Risk → Priority → FastAPI Dashboard

Usage (from platform/):
  python run_demo.py --demo
  python run_demo.py --demo --no-server
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def ensure_sample(path: Path) -> Path:
    if path.exists():
        return path
    alt = ROOT / "samples" / "banner_test.mp4"
    if alt.exists():
        return alt
    print("[demo] generating sample assets…")
    subprocess.check_call([sys.executable, "scripts/generate_sample_assets.py"])
    if alt.exists():
        return alt
    raise SystemExit(f"sample video not found: {path}")


def load_expected() -> dict:
    path = ROOT / "fixtures" / "demo_expected_event.json"
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Municipal Vision end-to-end demo")
    parser.add_argument("--demo", action="store_true", help="competition demo mode (fixed fixtures)")
    parser.add_argument("--source", default="sample_video/banner_test.mp4")
    parser.add_argument("--camera-id", default=None)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--sample-fps", type=float, default=2.0)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--no-server", action="store_true", help="pipeline only")
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    from backend.app.services.event_store import EventStore
    from inference.pipeline import MunicipalVisionPipeline, resolve_weights, scored_to_store
    from utils.paths import ensure_dir

    expected = load_expected() if args.demo else {}
    camera_id = args.camera_id or (expected.get("camera_id") if args.demo else "CCTV-001")
    public_data = "fixtures/demo_public_data" if args.demo else "datasets/public_data"
    db_path = "artifacts/demo_events.db" if args.demo else "artifacts/events.db"
    events_dir = "events"
    source_mode = "VIDEO"
    used_fallback = False

    source = ensure_sample(Path(args.source))
    weights = resolve_weights(args.weights)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S") + ("_demo" if args.demo else "_run")
    out_dir = ensure_dir(f"runs/inference/{run_id}")

    store = EventStore(db_path=db_path, events_dir=events_dir)
    if args.demo:
        store.clear()
        # wipe prior demo jsons with DEMO prefix
        for p in Path(events_dir).glob("event_DEMO-*.json"):
            p.unlink(missing_ok=True)

    print("=" * 60)
    print("AI Municipal Vision Platform — DEMO" if args.demo else "Municipal Vision Pipeline")
    print("=" * 60)
    print(f"mode     : {'--demo' if args.demo else 'standard'}")
    print(f"source   : {source}")
    print(f"weights  : {weights}")
    print(f"camera   : {camera_id}")
    print(f"public   : {public_data}")
    print(f"out_dir  : {out_dir}")
    print("-" * 60)

    prefix = expected.get("event_id_prefix") if args.demo else None
    pipe = MunicipalVisionPipeline(
        weights=weights,
        camera_id=camera_id,
        sample_fps=args.sample_fps,
        conf=args.conf,
        public_data_dir=public_data,
        tracking_cfg={"min_hits": 2, "max_age": 20},
        persist_store=True,
        events_dir=events_dir,
        source_mode="VIDEO",
        event_id_prefix=prefix,
        db_path=db_path,
    )
    scored = pipe.run(str(source), out_dir=out_dir, save_video=True)

    if not scored:
        used_fallback = True
        source_mode = "DEMO_FALLBACK"
        print("[demo] VIDEO detection count = 0")
        print("[demo] DEMO_FALLBACK badge → using validation images")
        val_dir = ROOT / "datasets" / "banner_mvp_filtered" / "images" / "val"
        imgs = sorted(val_dir.glob("*.jpg"))[:3] if val_dir.exists() else []
        if not imgs:
            raise SystemExit("DEMO_FALLBACK failed: no validation images found")
        img_pipe = MunicipalVisionPipeline(
            weights=weights,
            camera_id=camera_id,
            sample_fps=1.0,
            conf=max(args.conf, 0.2),
            public_data_dir=public_data,
            tracking_cfg={"min_hits": 1, "max_age": 5, "event_cooldown_seconds": 0},
            persist_store=True,
            events_dir=events_dir,
            source_mode="DEMO_FALLBACK",
            event_id_prefix=prefix or f"{camera_id}-E",
            db_path=db_path,
        )
        for i, img in enumerate(imgs):
            sub = out_dir / f"fallback_{i}"
            scored.extend(img_pipe.run(str(img), out_dir=sub, save_video=False))

    # Ensure source_mode stamped on all persisted events
    for s in scored:
        s.source_mode = source_mode
        s.event["source_mode"] = source_mode
        if used_fallback:
            s.event["demo_fallback"] = True
        store.upsert(scored_to_store(s))

    print(f"[demo] source_mode : {source_mode}")
    print(f"[demo] events created: {len(scored)}")
    for s in scored[:10]:
        e = s.event
        print(
            f"  - {e['event_id']} | {e.get('district')} | "
            f"risk={e.get('risk_score')} | {s.priority.get('priority')} | "
            f"{e.get('status')} | mode={e.get('source_mode')}"
        )
        if args.demo and expected:
            assert float(e.get("risk_score") or 0) >= float(expected.get("min_risk_score", 0)), (
                f"demo risk below expected min: {e.get('risk_score')}"
            )
            assert s.priority.get("priority") in expected.get("expected_priority_in", []), (
                f"unexpected priority {s.priority.get('priority')}"
            )

    print(f"[demo] JSON events → {Path(events_dir).resolve()}")
    print(f"[demo] SQLite     → {Path(db_path).resolve()}")
    print(f"[demo] video      → {out_dir / 'result.mp4'}")
    if used_fallback:
        print("[demo] NOTE: DEMO_FALLBACK was used (sample video produced 0 detections)")

    if args.no_server:
        return

    # Point API at the same DB used by this demo run
    os.environ["MUNICIPAL_EVENTS_DB"] = str(Path(db_path).resolve())
    os.environ["MUNICIPAL_PUBLIC_DATA"] = public_data

    url = f"http://127.0.0.1:{args.port}/dashboard"
    print("-" * 60)
    print(f"[demo] starting FastAPI → {url}")
    print(f"       API docs          → http://127.0.0.1:{args.port}/docs")
    print("Ctrl+C to stop.")
    print("-" * 60)

    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(args.port),
        ],
        cwd=str(ROOT),
        env={**os.environ},
    )
    try:
        import urllib.request

        for _ in range(40):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{args.port}/health", timeout=1)
                break
            except Exception:
                time.sleep(0.25)
        if not args.no_browser:
            webbrowser.open(url)
        proc.wait()
    except KeyboardInterrupt:
        print("\n[demo] stopping…")
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    main()
