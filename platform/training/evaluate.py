"""Evaluate banner detector and write artifacts/evaluation/*."""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

import yaml

from utils.paths import ensure_dir, resolve_path


def _env_tag(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ("night", "dark", "_n_", "야간", "밤")):
        return "night"
    if any(k in n for k in ("rain", "비", "우천")):
        return "rain"
    if any(k in n for k in ("fog", "안개")):
        return "fog"
    return "day"


def _size_bin(area: float) -> str:
    if area < 0.01:
        return "small"
    if area < 0.05:
        return "medium"
    return "large"


def evaluate(weights: str, data: str, imgsz: int = 960, device: str | int = "cpu") -> dict:
    from ultralytics import YOLO

    weights_p = resolve_path(weights)
    data_p = resolve_path(data)
    if not weights_p.exists():
        raise FileNotFoundError(
            f"weights not found: {weights_p}\n"
            "Train first: python -m training.train --config configs/banner/train.yaml"
        )

    out_dir = ensure_dir("artifacts/evaluation")
    pred_dir = ensure_dir("artifacts/evaluation/predictions")
    fp_dir = ensure_dir("artifacts/evaluation/false_positives")
    fn_dir = ensure_dir("artifacts/evaluation/false_negatives")

    model = YOLO(str(weights_p))
    t0 = time.perf_counter()
    metrics = model.val(
        data=str(data_p),
        imgsz=imgsz,
        device=device,
        plots=True,
        project=str(out_dir),
        name="val",
        exist_ok=True,
    )
    elapsed = time.perf_counter() - t0
    box = metrics.box
    precision = float(box.mp)
    recall = float(box.mr)
    map50 = float(box.map50)
    map5095 = float(box.map)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    speed = getattr(metrics, "speed", {}) or {}
    infer_ms = float(speed.get("inference", 0.0)) or (elapsed * 1000)
    fps = 1000.0 / infer_ms if infer_ms > 0 else 0.0

    # Per-image proxy analysis on test/val images if present
    cfg = yaml.safe_load(data_p.read_text(encoding="utf-8"))
    root = resolve_path(cfg.get("path", "datasets/banner"))
    split = root / "images" / "test"
    if not split.exists() or not any(split.iterdir()):
        split = root / "images" / "val"
    per_image = []
    env_stats = {"day": [], "night": [], "rain": [], "fog": []}
    size_stats = {"small": [], "medium": [], "large": []}

    if split.exists():
        import cv2

        for img_path in sorted(split.iterdir()):
            if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
                continue
            im = cv2.imread(str(img_path))
            if im is None:
                continue
            h, w = im.shape[:2]
            t1 = time.perf_counter()
            res = model.predict(im, imgsz=imgsz, conf=0.25, verbose=False, device=device)[0]
            dt = time.perf_counter() - t1
            pred_n = 0 if res.boxes is None else len(res.boxes)
            lbl = root / "labels" / split.name / f"{img_path.stem}.txt"
            gt_lines = lbl.read_text(encoding="utf-8").splitlines() if lbl.exists() else []
            gt_n = len([ln for ln in gt_lines if ln.strip()])
            # crude TP/FP/FN by count (IoU matching deferred; documented as count-proxy)
            tp = min(pred_n, gt_n)
            fp = max(pred_n - gt_n, 0)
            fn = max(gt_n - pred_n, 0)
            row = {
                "file": img_path.name,
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "infer_s": round(dt, 4),
                "env": _env_tag(img_path.name),
            }
            per_image.append(row)
            env_stats[row["env"]].append(row)
            for ln in gt_lines:
                parts = ln.split()
                if len(parts) == 5:
                    area = float(parts[3]) * float(parts[4])
                    size_stats[_size_bin(area)].append(1)
            # save failure thumbs
            if fp > 0:
                cv2.imwrite(str(fp_dir / img_path.name), im)
            if fn > 0:
                cv2.imwrite(str(fn_dir / img_path.name), im)
            # predictions json
            preds = []
            if res.boxes is not None:
                for b in res.boxes:
                    xyxy = b.xyxy.cpu().numpy().tolist()[0]
                    preds.append({"xyxy": xyxy, "conf": float(b.conf)})
            (pred_dir / f"{img_path.stem}.json").write_text(
                json.dumps(preds, ensure_ascii=False, indent=2), encoding="utf-8"
            )

    summary = {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mAP50": map50,
        "mAP50_95": map5095,
        "avg_infer_ms": infer_ms,
        "fps": fps,
        "images_analyzed": len(per_image),
        "env_image_counts": {k: len(v) for k, v in env_stats.items()},
        "size_gt_box_counts": {k: len(v) for k, v in size_stats.items()},
        "note": "Per-image TP/FP/FN are count-proxy metrics; mAP* come from Ultralytics val.",
        "confusion_matrix": str(out_dir / "val" / "confusion_matrix.png"),
    }

    (out_dir / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out_dir / "metrics.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(summary.keys()))
        w.writeheader()
        w.writerow(summary)
    with open(out_dir / "per_image.csv", "w", encoding="utf-8", newline="") as f:
        if per_image:
            w = csv.DictWriter(f, fieldnames=list(per_image[0].keys()))
            w.writeheader()
            w.writerows(per_image)

    # copy confusion matrix if produced
    cm = out_dir / "val" / "confusion_matrix.png"
    if cm.exists():
        target = out_dir / "confusion_matrix.png"
        target.write_bytes(cm.read_bytes())

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="weights/banner/best.pt")
    parser.add_argument("--data", default="datasets/banner/data.yaml")
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()
    evaluate(args.weights, args.data, args.imgsz, args.device)


if __name__ == "__main__":
    main()
