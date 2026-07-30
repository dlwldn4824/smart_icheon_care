#!/usr/bin/env python3
"""
Post-training finalize pipeline for banner final_all_30ep.

Runs ONLY when weights/banner/final_all_30ep/best.pt exists.
Does not invent metrics.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def require_final_weights() -> Path:
    best = ROOT / "weights/banner/final_all_30ep/best.pt"
    if not best.exists():
        raise SystemExit(
            "[finalize] final weights missing.\n"
            f"  expected: {best}\n"
            "  Train first:\n"
            "    python -m training.train --config configs/banner/train_all_30ep.yaml\n"
            "  Refuse to invent metrics."
        )
    return best


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def eval_common_test(weights: Path, out_dir: Path, device: str, conf: float, imgsz: int) -> dict:
    """Evaluate on existing common_test from A/B comparison (1892 images)."""
    from ultralytics import YOLO

    common_yaml = ROOT / "artifacts/experiment_comparison/common_test/data.yaml"
    if not common_yaml.exists():
        # rebuild via compare helper
        from scripts.compare_banner_experiments import build_common_test

        out_cmp = ROOT / "artifacts/experiment_comparison"
        out_cmp.mkdir(parents=True, exist_ok=True)
        common_yaml, rows = build_common_test(
            ROOT,
            out_cmp,
            ROOT / "datasets/banner_mvp_all",
            ROOT / "datasets/banner_mvp_filtered",
        )
        n_common = len(rows)
    else:
        man = ROOT / "artifacts/experiment_comparison/common_test_manifest.csv"
        n_common = max(0, sum(1 for _ in open(man, encoding="utf-8")) - 1) if man.exists() else 0

    model = YOLO(str(weights))
    t0 = time.perf_counter()
    metrics = model.val(
        data=str(common_yaml),
        split="test",
        imgsz=imgsz,
        device=device,
        conf=conf,
        plots=False,
        verbose=False,
    )
    elapsed = time.perf_counter() - t0
    box = metrics.box
    p = float(box.mp)
    r = float(box.mr)
    map50 = float(box.map50)
    map5095 = float(box.map)
    f1 = (2 * p * r / (p + r)) if (p + r) else 0.0
    speed = getattr(metrics, "speed", {}) or {}
    infer_ms = float(speed.get("inference", 0.0))
    fps = 1000.0 / infer_ms if infer_ms > 0 else 0.0
    return {
        "common_test_images": n_common,
        "precision": p,
        "recall": r,
        "f1": f1,
        "map50": map50,
        "map50_95": map5095,
        "infer_ms": infer_ms,
        "fps": fps,
        "val_seconds": elapsed,
        "weights": str(weights),
    }


def tiny_fp_fn(weights: Path, device: str, conf: float, imgsz: int, max_images: int | None = None) -> dict:
    """Per-image Tiny recall + FP/FN on common test (subset optional for speed)."""
    from scripts.compare_banner_experiments import per_image_analysis
    import csv as csvmod

    man = ROOT / "artifacts/experiment_comparison/common_test_manifest.csv"
    rows = list(csvmod.DictReader(man.open(encoding="utf-8")))
    if max_images:
        rows = rows[:max_images]
    tmp = ROOT / "artifacts/final_model" / "_tmp_viz"
    detail = per_image_analysis(
        weights,
        rows,
        ROOT / "datasets/banner_mvp_all",
        tmp / "fp",
        tmp / "fn",
        imgsz,
        device,
        conf,
        0.5,
        5,
    )
    tiny = detail["by_size"].get("tiny", {})
    return {
        "tiny_recall": tiny.get("recall", 0.0),
        "tiny_precision": tiny.get("precision", 0.0),
        "tiny_map50": tiny.get("map50", 0.0),
        "tp": detail["totals"]["tp"],
        "fp": detail["totals"]["fp"],
        "fn": detail["totals"]["fn"],
        "avg_confidence": detail.get("avg_confidence"),
        "avg_infer_ms": detail.get("avg_infer_ms"),
        "images_analyzed": len(rows),
    }


def delta_pp(a: float, b: float) -> str:
    """Percentage-point change b-a as +x.x% style string (pp)."""
    d = (b - a) * 100.0
    return f"{d:+.2f}%"


def write_comparison(ten: dict, thirty: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    rows = [
        ["metric", "epoch10_all", "epoch30_final", "delta"],
        ["precision", f"{ten['precision']:.4f}", f"{thirty['precision']:.4f}", delta_pp(ten["precision"], thirty["precision"])],
        ["recall", f"{ten['recall']:.4f}", f"{thirty['recall']:.4f}", delta_pp(ten["recall"], thirty["recall"])],
        ["f1", f"{ten['f1']:.4f}", f"{thirty['f1']:.4f}", delta_pp(ten["f1"], thirty["f1"])],
        ["map50", f"{ten['map50']:.4f}", f"{thirty['map50']:.4f}", delta_pp(ten["map50"], thirty["map50"])],
        ["map50_95", f"{ten['map50_95']:.4f}", f"{thirty['map50_95']:.4f}", delta_pp(ten["map50_95"], thirty["map50_95"])],
        ["tiny_recall", f"{ten.get('tiny_recall', 0):.4f}", f"{thirty.get('tiny_recall', 0):.4f}", delta_pp(ten.get("tiny_recall", 0), thirty.get("tiny_recall", 0))],
        ["fp", ten.get("fp"), thirty.get("fp"), ""],
        ["fn", ten.get("fn"), thirty.get("fn"), ""],
        ["infer_ms", f"{ten.get('infer_ms', 0):.2f}", f"{thirty.get('infer_ms', 0):.2f}", ""],
        ["fps", f"{ten.get('fps', 0):.2f}", f"{thirty.get('fps', 0):.2f}", ""],
    ]
    with open(out / "comparison.csv", "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)

    payload = {
        "epoch10_all": ten,
        "epoch30_final": thirty,
        "deltas_pp": {
            "precision": (thirty["precision"] - ten["precision"]) * 100,
            "recall": (thirty["recall"] - ten["recall"]) * 100,
            "f1": (thirty["f1"] - ten["f1"]) * 100,
            "map50": (thirty["map50"] - ten["map50"]) * 100,
            "map50_95": (thirty["map50_95"] - ten["map50_95"]) * 100,
            "tiny_recall": (thirty.get("tiny_recall", 0) - ten.get("tiny_recall", 0)) * 100,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    (out / "comparison.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    md = [
        "# Final Model Comparison (10ep all vs 30ep final)",
        "",
        f"- Common test images: {thirty.get('common_test_images', ten.get('common_test_images'))}",
        f"- Generated: {payload['generated_at']}",
        "",
        "| metric | 10ep all | 30ep final | delta |",
        "|---|---:|---:|---:|",
    ]
    for r in rows[1:]:
        md.append(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} |")
    md.append("")
    (out / "comparison.md").write_text("\n".join(md), encoding="utf-8")


def package_release(best: Path, metrics: dict) -> Path:
    release = ROOT / "weights/banner/release"
    release.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, release / "best.pt")
    cfg_src = ROOT / "configs/banner/train_all_30ep.yaml"
    shutil.copy2(cfg_src, release / "config.yaml")
    (release / "labels.txt").write_text("banner\n", encoding="utf-8")
    info = {
        "model": "YOLO11s",
        "dataset": "banner_mvp_all",
        "epochs": 30,
        "imgsz": 640,
        "classes": ["banner"],
        "precision": metrics.get("precision"),
        "recall": metrics.get("recall"),
        "map50": metrics.get("map50"),
        "map50_95": metrics.get("map50_95"),
        "f1": metrics.get("f1"),
        "tiny_recall": metrics.get("tiny_recall"),
        "weights": str(release / "best.pt"),
        "date": datetime.now(timezone.utc).date().isoformat(),
    }
    (release / "model_info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    return release


def export_onnx(best: Path) -> dict:
    out = {"ok": False, "path": None, "error": None, "test_ok": False}
    try:
        from ultralytics import YOLO

        model = YOLO(str(best))
        exported = model.export(format="onnx", imgsz=640, simplify=True)
        onnx_path = Path(str(exported))
        dest = ROOT / "weights/banner/release/best.onnx"
        if onnx_path.exists():
            shutil.copy2(onnx_path, dest)
            out["path"] = str(dest)
            out["ok"] = True
            # simple ORT smoke if available
            try:
                import numpy as np
                import onnxruntime as ort

                sess = ort.InferenceSession(str(dest), providers=["CPUExecutionProvider"])
                inp = sess.get_inputs()[0]
                shape = [d if isinstance(d, int) and d > 0 else 1 for d in inp.shape]
                if len(shape) == 4 and shape[1] in (1, 3):
                    # NCHW
                    dummy = np.random.randn(*shape).astype(np.float32)
                else:
                    dummy = np.random.randn(*shape).astype(np.float32)
                sess.run(None, {inp.name: dummy})
                out["test_ok"] = True
            except Exception as exc:  # noqa: BLE001
                out["error"] = f"onnx export ok; runtime test failed: {exc}"
        else:
            out["error"] = f"export returned missing path: {exported}"
    except Exception as exc:  # noqa: BLE001
        out["error"] = str(exc)
    return out


def benchmark_speed(best: Path, device: str) -> dict:
    from ultralytics import YOLO
    import cv2
    import numpy as np

    # pick one common test image
    man = ROOT / "artifacts/experiment_comparison/common_test_manifest.csv"
    img_name = None
    if man.exists():
        with open(man, encoding="utf-8") as f:
            next(f)
            line = f.readline().strip()
            if line:
                img_name = line.split(",")[0]
    img_path = ROOT / "datasets/banner_mvp_all/images/test" / (img_name or "")
    if not img_path.exists():
        # synthetic
        arr = np.zeros((640, 640, 3), dtype=np.uint8)
        tmp = ROOT / "artifacts/final_model/_bench.jpg"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(tmp), arr)
        img_path = tmp

    results = {}
    for dev in [device, "cpu"]:
        model = YOLO(str(best))
        # warmup
        for _ in range(3):
            model.predict(str(img_path), imgsz=640, device=dev, verbose=False)
        times = []
        for _ in range(20):
            t0 = time.perf_counter()
            model.predict(str(img_path), imgsz=640, device=dev, verbose=False)
            times.append((time.perf_counter() - t0) * 1000.0)
        avg = sum(times) / len(times)
        results[dev] = {"latency_ms": avg, "fps": 1000.0 / avg if avg > 0 else 0.0, "n": len(times)}
    return results


def run_demo_modes(best: Path) -> dict:
    """Run pipeline video + force fallback report without starting server."""
    from inference.pipeline import MunicipalVisionPipeline

    out: dict = {"video": None, "fallback": None}
    video = ROOT / "sample_video/banner_test.mp4"
    out_base = ROOT / "artifacts/final_model/demo_runs"
    out_base.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    pipe = MunicipalVisionPipeline(
        weights=best,
        camera_id="DEMO-CCTV-001",
        sample_fps=2.0,
        conf=0.25,
        public_data_dir="fixtures/demo_public_data",
        tracking_cfg={"min_hits": 2, "max_age": 20},
        persist_store=False,
        events_dir=out_base / "events_video",
        source_mode="VIDEO",
        db_path=out_base / "demo_video.db",
    )
    scored = pipe.run(str(video), out_dir=out_base / "video", save_video=True)
    out["video"] = {
        "source_mode": "VIDEO",
        "events": len(scored),
        "priorities": {},
        "seconds": time.perf_counter() - t0,
    }
    for s in scored:
        p = s.priority.get("priority", "unknown")
        out["video"]["priorities"][p] = out["video"]["priorities"].get(p, 0) + 1

    # DEMO_FALLBACK path: val images
    t1 = time.perf_counter()
    val = sorted((ROOT / "datasets/banner_mvp_filtered/images/val").glob("*.jpg"))[:3]
    fb_pipe = MunicipalVisionPipeline(
        weights=best,
        camera_id="DEMO-CCTV-001",
        sample_fps=1.0,
        conf=0.2,
        public_data_dir="fixtures/demo_public_data",
        tracking_cfg={"min_hits": 1, "max_age": 5, "event_cooldown_seconds": 0},
        persist_store=False,
        events_dir=out_base / "events_fallback",
        source_mode="DEMO_FALLBACK",
        event_id_prefix="DEMO-CCTV-001-E",
        db_path=out_base / "demo_fallback.db",
    )
    fb = []
    for i, img in enumerate(val):
        fb.extend(fb_pipe.run(str(img), out_dir=out_base / f"fallback_{i}", save_video=False))
    out["fallback"] = {
        "source_mode": "DEMO_FALLBACK",
        "events": len(fb),
        "priorities": {},
        "seconds": time.perf_counter() - t1,
        "images": len(val),
    }
    for s in fb:
        p = s.priority.get("priority", "unknown")
        out["fallback"]["priorities"][p] = out["fallback"]["priorities"].get(p, 0) + 1
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", default="mps")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--skip-demo", action="store_true")
    parser.add_argument("--skip-onnx", action="store_true")
    parser.add_argument("--skip-per-image", action="store_true")
    parser.add_argument("--tiny-max-images", type=int, default=None, help="limit per-image analysis")
    args = parser.parse_args()

    best = require_final_weights()
    out = ROOT / "artifacts/final_model"
    out.mkdir(parents=True, exist_ok=True)

    print("[finalize] evaluating 30ep on common test…")
    thirty = eval_common_test(best, out, args.device, args.conf, args.imgsz)
    print(
        f"[finalize] 30ep: P={thirty['precision']:.4f} R={thirty['recall']:.4f} "
        f"mAP50={thirty['map50']:.4f}"
    )

    # 10ep baseline from previous comparison.json if available
    prev = load_json(ROOT / "artifacts/experiment_comparison/comparison.json")
    ten = dict(prev.get("all") or {})
    if not ten:
        raise SystemExit("[finalize] missing 10ep baseline in artifacts/experiment_comparison/comparison.json")

    if not args.skip_per_image:
        print("[finalize] tiny/FP/FN analysis (30ep)…")
        extra30 = tiny_fp_fn(best, args.device, args.conf, args.imgsz, args.tiny_max_images)
        thirty.update(extra30)
        # reuse 10ep detail from comparison if present
        detail10 = prev.get("detail_all") or {}
        if detail10:
            tiny10 = (detail10.get("by_size") or {}).get("tiny") or {}
            tot10 = detail10.get("totals") or {}
            ten["tiny_recall"] = tiny10.get("recall", ten.get("tiny_recall", 0))
            ten["fp"] = tot10.get("fp", ten.get("fp"))
            ten["fn"] = tot10.get("fn", ten.get("fn"))

    write_comparison(ten, thirty, out)
    print(f"[finalize] wrote {out / 'comparison.md'}")

    release = package_release(best, thirty)
    print(f"[finalize] packaged {release}")

    onnx_result = {"ok": False, "skipped": True}
    if not args.skip_onnx:
        print("[finalize] ONNX export…")
        onnx_result = export_onnx(best)
        print(f"[finalize] onnx: {onnx_result}")

    print("[finalize] speed benchmark…")
    speed = benchmark_speed(best, args.device)
    (out / "speed_benchmark.json").write_text(json.dumps(speed, indent=2), encoding="utf-8")
    print(json.dumps(speed, indent=2))

    demo = None
    if not args.skip_demo:
        print("[finalize] demo VIDEO + DEMO_FALLBACK…")
        demo = run_demo_modes(best)
        (out / "demo_results.json").write_text(json.dumps(demo, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(demo, indent=2, ensure_ascii=False))

    train_metrics = load_json(ROOT / "weights/banner/final_all_30ep/metrics.json")
    report = {
        "final_weights": str(best),
        "train_metrics": train_metrics,
        "epoch30_common_test": thirty,
        "epoch10_baseline": ten,
        "speed": speed,
        "onnx": onnx_result,
        "demo": demo,
        "release_dir": str(release),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    (out / "finalize_payload.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # human report skeleton filled with real numbers only
    md = [
        "# Final Release Report",
        "",
        f"Generated: {report['generated_at']}",
        "",
        "## 1. Training",
        "",
        f"- save_dir: `{train_metrics.get('save_dir')}`",
        f"- device: `{train_metrics.get('device')}`",
        f"- epochs: {train_metrics.get('epochs', 30)}",
        f"- results.csv: `{ROOT / 'weights/banner/final_all_30ep/results.csv'}`",
        "",
        "## 2. Final common-test performance (30ep)",
        "",
        f"- Precision: {thirty['precision']:.4f}",
        f"- Recall: {thirty['recall']:.4f}",
        f"- F1: {thirty['f1']:.4f}",
        f"- mAP50: {thirty['map50']:.4f}",
        f"- mAP50-95: {thirty['map50_95']:.4f}",
        f"- Tiny Recall: {thirty.get('tiny_recall')}",
        f"- FP/FN: {thirty.get('fp')}/{thirty.get('fn')}",
        "",
        "## 3. vs 10ep all",
        "",
        f"See `{out / 'comparison.md'}`",
        "",
        "## 4–10. See also",
        "",
        f"- speed: `{out / 'speed_benchmark.json'}`",
        f"- demo: `{out / 'demo_results.json'}`",
        f"- release: `{release}`",
        f"- onnx: {json.dumps(onnx_result, ensure_ascii=False)}",
        "",
    ]
    report_path = ROOT / "artifacts/final_release_report.md"
    report_path.write_text("\n".join(md), encoding="utf-8")
    print(f"[finalize] report → {report_path}")


if __name__ == "__main__":
    main()
