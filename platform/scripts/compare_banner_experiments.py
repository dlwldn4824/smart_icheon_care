#!/usr/bin/env python3
"""
Compare banner MVP A/B experiments on a COMMON test image intersection.

Does not invent metrics — exits if either best.pt is missing.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
import time
from collections import defaultdict
from pathlib import Path

import cv2
import yaml

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
TYPE_ORDER = [
    "가로현수막(낮)",
    "가로현수막(밤)",
    "세로현수막(낮)",
    "세로현수막(밤)",
]
PREFIX_TYPE = {
    "9": "가로현수막(낮)",
    "10": "가로현수막(밤)",
    "11": "세로현수막(낮)",
    "12": "세로현수막(밤)",
}


def find_best(candidates: list[Path]) -> Path | None:
    for p in candidates:
        if p.is_file():
            return p
    return None


def safe_copy_file(src: Path, dst: Path) -> None:
    """Copy file, skipping when source and destination resolve to the same path."""
    if not src.exists():
        raise FileNotFoundError(f"source missing: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and src.resolve() == dst.resolve():
        print(f"[INFO] {dst.name} already in destination. Skip copy. ({dst})")
        return
    shutil.copy2(src, dst)


def discover_experiment_weights(root: Path, kind: str) -> Path | None:
    """
    Auto-discover best.pt for experiment_{kind}.

    Prefers weights/banner/experiment_{kind}/best.pt, then runs/banner/**.
    """
    banner_w = root / "weights" / "banner"
    preferred = banner_w / f"experiment_{kind}" / "best.pt"
    cands: list[Path] = [preferred]

    # Auto-scan weights/banner/experiment_* dirs
    if banner_w.is_dir():
        for d in sorted(banner_w.glob(f"experiment_{kind}*")):
            if d.is_dir():
                cands.append(d / "best.pt")

    # Fallback run directories
    runs = root / "runs" / "banner"
    if runs.is_dir():
        patterns = [
            f"experiment_{kind}/weights/best.pt",
            f"exp_mvp_{kind}_10ep/weights/best.pt",
            f"*{kind}*/weights/best.pt",
        ]
        for pat in patterns:
            cands.extend(sorted(runs.glob(pat)))

    return find_best(cands)


def resolve_weights(root: Path, kind: str) -> Path | None:
    """Locate best.pt for all|filtered without fabricating metrics."""
    return discover_experiment_weights(root, kind)


def list_images(d: Path) -> set[str]:
    if not d.exists():
        return set()
    return {p.name for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS}


def parse_yolo(lbl: Path) -> list[tuple[float, float, float, float]]:
    if not lbl.exists():
        return []
    boxes = []
    for line in lbl.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        _, cx, cy, bw, bh = map(float, parts)
        boxes.append((cx, cy, bw, bh))
    return boxes


def yolo_to_xyxy(cx: float, cy: float, bw: float, bh: float, w: int, h: int) -> tuple[float, float, float, float]:
    x1 = (cx - bw / 2) * w
    y1 = (cy - bh / 2) * h
    x2 = (cx + bw / 2) * w
    y2 = (cy + bh / 2) * h
    return x1, y1, x2, y2


def iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def size_bin_px(bw: float, bh: float, img_w: int, img_h: int) -> str:
    side = min(bw * img_w, bh * img_h)
    if side < 8:
        return "tiny"
    if side < 16:
        return "small"
    if side < 32:
        return "medium"
    return "large"


def file_type(name: str) -> str:
    return PREFIX_TYPE.get(name.split("_", 1)[0], "unknown")


def day_night(name: str) -> str:
    t = file_type(name)
    return "night" if "밤" in t else "day"


def horiz_vert(name: str) -> str:
    t = file_type(name)
    return "horizontal" if "가로" in t else "vertical"


def match_boxes(
    gts: list[tuple[float, float, float, float]],
    preds: list[tuple[float, float, float, float]],
    iou_thr: float,
) -> tuple[int, int, int, list[int], list[int]]:
    """Return TP, FP, FN, unmatched_gt_idx, unmatched_pred_idx."""
    matched_g = set()
    matched_p = set()
    for pi, pb in enumerate(preds):
        best_i, best_j = -1, -1.0
        for gi, gb in enumerate(gts):
            if gi in matched_g:
                continue
            v = iou(pb, gb)
            if v > best_j:
                best_j, best_i = v, gi
        if best_j >= iou_thr and best_i >= 0:
            matched_g.add(best_i)
            matched_p.add(pi)
    tp = len(matched_g)
    fp = len(preds) - len(matched_p)
    fn = len(gts) - len(matched_g)
    ug = [i for i in range(len(gts)) if i not in matched_g]
    up = [i for i in range(len(preds)) if i not in matched_p]
    return tp, fp, fn, ug, up


def draw_boxes(img, boxes, color, label: str) -> None:
    for x1, y1, x2, y2 in boxes:
        cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        cv2.putText(img, label, (int(x1), max(12, int(y1) - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)


def build_common_test(
    root: Path,
    out_dir: Path,
    all_ds: Path,
    flt_ds: Path,
) -> tuple[Path, list[dict]]:
    """Common filenames; GT labels from ALL (full boxes) for fair tiny analysis."""
    common = sorted(list_images(all_ds / "images/test") & list_images(flt_ds / "images/test"))
    if not common:
        raise SystemExit("[compare] no common test images between all and filtered")

    img_dir = out_dir / "common_test" / "images" / "test"
    lbl_dir = out_dir / "common_test" / "labels" / "test"
    if out_dir.joinpath("common_test").exists():
        shutil.rmtree(out_dir / "common_test")
    img_dir.mkdir(parents=True)
    lbl_dir.mkdir(parents=True)

    rows = []
    for name in common:
        src_img = all_ds / "images/test" / name
        src_lbl = all_ds / "labels/test" / f"{Path(name).stem}.txt"
        # hardlink/copy
        dst_img = img_dir / name
        try:
            __import__("os").link(src_img, dst_img)
        except OSError:
            shutil.copy2(src_img, dst_img)
        shutil.copy2(src_lbl, lbl_dir / f"{Path(name).stem}.txt")
        boxes = parse_yolo(src_lbl)
        rows.append(
            {
                "file": name,
                "type": file_type(name),
                "day_night": day_night(name),
                "orientation": horiz_vert(name),
                "num_gt_boxes_all": len(boxes),
            }
        )

    data_yaml = out_dir / "common_test" / "data.yaml"
    data_yaml.write_text(
        f"path: {(out_dir / 'common_test').resolve()}\n"
        "train: images/test\n"  # unused
        "val: images/test\n"
        "test: images/test\n\n"
        "names:\n"
        "  0: banner\n",
        encoding="utf-8",
    )
    man = out_dir / "common_test_manifest.csv"
    with open(man, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["file", "type", "day_night", "orientation", "num_gt_boxes_all"]
        )
        w.writeheader()
        w.writerows(rows)
    return data_yaml, rows


def run_ultralytics_val(weights: Path, data_yaml: Path, imgsz: int, device: str, conf: float) -> dict:
    from ultralytics import YOLO

    model = YOLO(str(weights))
    t0 = time.perf_counter()
    metrics = model.val(
        data=str(data_yaml),
        split="test",
        imgsz=imgsz,
        device=device,
        conf=conf,
        plots=False,
        verbose=False,
    )
    elapsed = time.perf_counter() - t0
    box = metrics.box
    precision = float(box.mp)
    recall = float(box.mr)
    map50 = float(box.map50)
    map5095 = float(box.map)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    speed = getattr(metrics, "speed", {}) or {}
    infer_ms = float(speed.get("inference", 0.0))
    fps = 1000.0 / infer_ms if infer_ms > 0 else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "map50": map50,
        "map50_95": map5095,
        "infer_ms": infer_ms,
        "fps": fps,
        "val_seconds": elapsed,
    }


def average_precision_dataset(
    scored_preds: list[tuple[float, int, tuple[float, float, float, float]]],
    gts_by_image: dict[int, list[tuple[float, float, float, float]]],
    iou_thr: float,
) -> float:
    """Dataset-level AP@IoU (11-point) with per-image matching."""
    n_gt = sum(len(v) for v in gts_by_image.values())
    if n_gt == 0:
        return 0.0
    preds = sorted(scored_preds, key=lambda x: x[0], reverse=True)
    matched: dict[int, set[int]] = defaultdict(set)
    tps: list[int] = []
    fps: list[int] = []
    for conf, img_id, pb in preds:
        gts = gts_by_image.get(img_id, [])
        best_i, best_j = -1, 0.0
        for gi, gb in enumerate(gts):
            if gi in matched[img_id]:
                continue
            v = iou(pb, gb)
            if v > best_j:
                best_j, best_i = v, gi
        if best_j >= iou_thr and best_i >= 0:
            matched[img_id].add(best_i)
            tps.append(1)
            fps.append(0)
        else:
            tps.append(0)
            fps.append(1)
    if not tps:
        return 0.0
    tp_cum = fp_cum = 0
    recalls = []
    precisions = []
    for t, f in zip(tps, fps):
        tp_cum += t
        fp_cum += f
        recalls.append(tp_cum / n_gt)
        precisions.append(tp_cum / (tp_cum + fp_cum) if (tp_cum + fp_cum) else 0.0)
    ap = 0.0
    for thr in [i / 10 for i in range(11)]:
        ps = [p for r, p in zip(recalls, precisions) if r >= thr]
        ap += max(ps) if ps else 0.0
    return ap / 11.0


def per_image_analysis(
    weights: Path,
    common_rows: list[dict],
    all_ds: Path,
    out_fp: Path,
    out_fn: Path,
    imgsz: int,
    device: str,
    conf: float,
    iou_thr: float,
    max_viz: int,
) -> dict:
    from ultralytics import YOLO

    model = YOLO(str(weights))
    out_fp.mkdir(parents=True, exist_ok=True)
    out_fn.mkdir(parents=True, exist_ok=True)

    totals = {"tp": 0, "fp": 0, "fn": 0}
    by_size = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    by_type = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    by_dn = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    by_or = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    size_preds_all: list[tuple[float, int, tuple[float, float, float, float]]] = []
    size_gts: dict[str, dict[int, list[tuple[float, float, float, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    confs: list[float] = []
    infer_ms_list: list[float] = []
    fp_cases = []
    fn_cases = []

    for img_id, row in enumerate(common_rows):
        name = row["file"]
        img_path = all_ds / "images/test" / name
        lbl_path = all_ds / "labels/test" / f"{Path(name).stem}.txt"
        im = cv2.imread(str(img_path))
        if im is None:
            continue
        h, w = im.shape[:2]
        gts_y = parse_yolo(lbl_path)
        gts = [yolo_to_xyxy(*b, w, h) for b in gts_y]
        gt_bins = [size_bin_px(b[2], b[3], w, h) for b in gts_y]
        for gb, sb in zip(gts, gt_bins):
            size_gts[sb][img_id].append(gb)

        t0 = time.perf_counter()
        res = model.predict(source=str(img_path), imgsz=imgsz, conf=conf, device=device, verbose=False)[0]
        infer_ms_list.append((time.perf_counter() - t0) * 1000.0)
        preds: list[tuple[float, float, float, float]] = []
        if res.boxes is not None and len(res.boxes):
            xyxy = res.boxes.xyxy.cpu().numpy()
            scores = res.boxes.conf.cpu().numpy()
            for box, sc in zip(xyxy, scores):
                pb = (float(box[0]), float(box[1]), float(box[2]), float(box[3]))
                preds.append(pb)
                confs.append(float(sc))
                size_preds_all.append((float(sc), img_id, pb))

        tp, fp, fn, ug, up = match_boxes(gts, preds, iou_thr)
        totals["tp"] += tp
        totals["fp"] += fp
        totals["fn"] += fn

        matched_g = set(range(len(gts))) - set(ug)
        for gi in matched_g:
            by_size[gt_bins[gi]]["tp"] += 1
            by_type[row["type"]]["tp"] += 1
            by_dn[row["day_night"]]["tp"] += 1
            by_or[row["orientation"]]["tp"] += 1
        for gi in ug:
            by_size[gt_bins[gi]]["fn"] += 1
            by_type[row["type"]]["fn"] += 1
            by_dn[row["day_night"]]["fn"] += 1
            by_or[row["orientation"]]["fn"] += 1
        for pi in up:
            x1, y1, x2, y2 = preds[pi]
            pw, ph = (x2 - x1), (y2 - y1)
            side = min(pw, ph)
            sb = "tiny" if side < 8 else "small" if side < 16 else "medium" if side < 32 else "large"
            by_size[sb]["fp"] += 1
            by_type[row["type"]]["fp"] += 1
            by_dn[row["day_night"]]["fp"] += 1
            by_or[row["orientation"]]["fp"] += 1

        if fp > 0 and len(fp_cases) < max_viz:
            vis = im.copy()
            draw_boxes(vis, [preds[i] for i in up], (0, 0, 255), "FP")
            draw_boxes(vis, gts, (0, 255, 0), "GT")
            outp = out_fp / f"fp_{name}"
            cv2.imwrite(str(outp), vis)
            fp_cases.append({"file": name, "fp": fp, "path": str(outp)})
        if fn > 0 and len(fn_cases) < max_viz:
            vis = im.copy()
            draw_boxes(vis, [gts[i] for i in ug], (0, 165, 255), "FN")
            draw_boxes(vis, preds, (255, 0, 0), "PRED")
            outp = out_fn / f"fn_{name}"
            cv2.imwrite(str(outp), vis)
            fn_cases.append({"file": name, "fn": fn, "path": str(outp)})

    def pr(d):
        tp, fp, fn = d["tp"], d["fp"], d["fn"]
        p = tp / (tp + fp) if (tp + fp) else 0.0
        r = tp / (tp + fn) if (tp + fn) else 0.0
        return {"tp": tp, "fp": fp, "fn": fn, "precision": p, "recall": r}

    preds_for_ap = size_preds_all
    if len(preds_for_ap) > 80000:
        preds_for_ap = sorted(preds_for_ap, key=lambda x: x[0], reverse=True)[:80000]

    by_size_out = {}
    for bin_name in ("tiny", "small", "medium", "large"):
        base = pr(by_size.get(bin_name, {"tp": 0, "fp": 0, "fn": 0}))
        gts_bin = {i: boxes for i, boxes in size_gts.get(bin_name, {}).items()}
        # COCO-style: evaluate all preds against size-filtered GT only
        base["map50"] = (
            average_precision_dataset(preds_for_ap, gts_bin, iou_thr) if gts_bin else 0.0
        )
        by_size_out[bin_name] = base

    avg_conf = sum(confs) / len(confs) if confs else 0.0
    avg_infer = sum(infer_ms_list) / len(infer_ms_list) if infer_ms_list else 0.0
    return {
        "totals": pr(totals),
        "avg_confidence": avg_conf,
        "avg_infer_ms": avg_infer,
        "fps": 1000.0 / avg_infer if avg_infer > 0 else 0.0,
        "by_size": by_size_out,
        "by_type": {k: pr(v) for k, v in by_type.items()},
        "by_day_night": {k: pr(v) for k, v in by_dn.items()},
        "by_orientation": {k: pr(v) for k, v in by_or.items()},
        "fp_cases": fp_cases,
        "fn_cases": fn_cases,
    }


def selection_score(m: dict) -> float:
    return (
        0.35 * m["recall"]
        + 0.30 * m["precision"]
        + 0.25 * m["map50"]
        + 0.10 * m["map50_95"]
    )


def recommend(
    all_m: dict,
    flt_m: dict,
    detail_all: dict | None = None,
    detail_flt: dict | None = None,
) -> tuple[str, list[str]]:
    notes = []
    sa, sf = selection_score(all_m), selection_score(flt_m)
    notes.append(f"internal score all={sa:.4f} filtered={sf:.4f}")

    recall_gap = abs(all_m["recall"] - flt_m["recall"])
    if recall_gap >= 0.05:
        winner = "all" if all_m["recall"] > flt_m["recall"] else "filtered"
        notes.append(f"Recall gap {recall_gap:.3f} ≥ 0.05 → prefer higher Recall ({winner})")
    else:
        winner = "all" if sa >= sf else "filtered"
        notes.append(f"Recall gap {recall_gap:.3f} < 0.05 → prefer higher internal score ({winner})")

    if winner == "all" and all_m["precision"] + 0.10 < flt_m["precision"]:
        notes.append(
            "WARNING: all Precision is ≥0.10 lower than filtered — higher human-review burden"
        )
    if winner == "filtered" and flt_m["precision"] + 0.10 < all_m["precision"]:
        notes.append(
            "WARNING: filtered Precision is ≥0.10 lower than all — unexpected; re-check conf"
        )

    close = abs(sa - sf) < 0.02 and recall_gap < 0.02
    if close:
        notes.append("Overall metrics are within ~2%p — also weigh Tiny / FP / FN")

    if detail_all and detail_flt:
        ta = detail_all["by_size"].get("tiny", {})
        tf = detail_flt["by_size"].get("tiny", {})
        notes.append(
            f"Tiny recall all={ta.get('recall', 0):.3f} filtered={tf.get('recall', 0):.3f}; "
            f"Tiny mAP50 all={ta.get('map50', 0):.3f} filtered={tf.get('map50', 0):.3f}"
        )
        fa = detail_all["totals"]
        ff = detail_flt["totals"]
        notes.append(
            f"Error counts (IoU@0.5): all FP={fa.get('fp', 0)} FN={fa.get('fn', 0)} | "
            f"filtered FP={ff.get('fp', 0)} FN={ff.get('fn', 0)}"
        )
        if (
            ta.get("recall", 0) >= tf.get("recall", 0) + 0.05
            and all_m["recall"] >= flt_m["recall"]
            and sa >= sf - 0.01
        ):
            winner = "all"
            notes.append("all shows better Tiny recall with competitive score → prefer all")
        elif abs(sa - sf) < 0.03 and ff.get("fp", 0) + 50 < fa.get("fp", 0):
            winner = "filtered"
            notes.append(
                "Filtered has substantially fewer FP with similar score → prefer filtered for ops"
            )
        elif close:
            winner = "filtered"
            notes.append("Near-tie overall → prefer filtered (simpler labels / lower tiny noise)")

    return winner, notes


def side_by_side(all_ds: Path, out_dir: Path, names: list[str], n: int = 8) -> None:
    rng = random.Random(42)
    pick = names[:]
    rng.shuffle(pick)
    dest = out_dir / "side_by_side"
    dest.mkdir(parents=True, exist_ok=True)
    for name in pick[:n]:
        src = all_ds / "images/test" / name
        lbl = all_ds / "labels/test" / f"{Path(name).stem}.txt"
        im = cv2.imread(str(src))
        if im is None:
            continue
        h, w = im.shape[:2]
        gts = [yolo_to_xyxy(*b, w, h) for b in parse_yolo(lbl)]
        draw_boxes(im, gts, (0, 255, 0), "GT")
        cv2.imwrite(str(dest / name), im)


def merge_metrics(ultralytics_m: dict, detail: dict | None) -> dict:
    out = dict(ultralytics_m)
    if detail:
        tot = detail["totals"]
        out["tp"] = tot["tp"]
        out["fp"] = tot["fp"]
        out["fn"] = tot["fn"]
        out["avg_confidence"] = detail.get("avg_confidence", 0.0)
        # Prefer measured per-image latency if available
        if detail.get("avg_infer_ms"):
            out["infer_ms"] = detail["avg_infer_ms"]
            out["fps"] = detail.get("fps", out.get("fps", 0.0))
    else:
        out.setdefault("tp", None)
        out.setdefault("fp", None)
        out.setdefault("fn", None)
        out.setdefault("avg_confidence", None)
    return out


def write_reports(
    out: Path,
    rows: list[dict],
    w_all: Path,
    w_flt: Path,
    m_all: dict,
    m_flt: dict,
    detail_all: dict | None,
    detail_flt: dict | None,
    winner: str,
    notes: list[str],
    next_cmd: str,
    conf: float,
    imgsz: int,
    device: str,
) -> None:
    payload = {
        "common_test_images": len(rows),
        "conf": conf,
        "imgsz": imgsz,
        "device": device,
        "weights": {"all": str(w_all), "filtered": str(w_flt)},
        "all": m_all,
        "filtered": m_flt,
        "scores": {"all": selection_score(m_all), "filtered": selection_score(m_flt)},
        "recommendation": winner,
        "recommendation_notes": notes,
        "detail_all": detail_all,
        "detail_filtered": detail_flt,
        "next_command": next_cmd,
        "note": "Internal selection score is project-specific, not an official AI benchmark.",
    }
    (out / "comparison.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    # Keep metrics.json alias for older tooling
    (out / "metrics.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    with open(out / "comparison.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "model",
                "precision",
                "recall",
                "f1",
                "map50",
                "map50_95",
                "avg_confidence",
                "infer_ms",
                "fps",
                "tp",
                "fp",
                "fn",
                "score",
            ]
        )
        for name, m in [("all", m_all), ("filtered", m_flt)]:
            w.writerow(
                [
                    name,
                    f"{m['precision']:.4f}",
                    f"{m['recall']:.4f}",
                    f"{m['f1']:.4f}",
                    f"{m['map50']:.4f}",
                    f"{m['map50_95']:.4f}",
                    f"{(m.get('avg_confidence') or 0):.4f}",
                    f"{m['infer_ms']:.2f}",
                    f"{m['fps']:.2f}",
                    m.get("tp"),
                    m.get("fp"),
                    m.get("fn"),
                    f"{selection_score(m):.4f}",
                ]
            )

    def fmt_block(title: str, m: dict) -> list[str]:
        lines = [
            f"### {title}",
            f"- Precision: {m['precision']:.4f}",
            f"- Recall: {m['recall']:.4f}",
            f"- F1: {m['f1']:.4f}",
            f"- mAP50: {m['map50']:.4f}",
            f"- mAP50-95: {m['map50_95']:.4f}",
            f"- avg confidence: {m.get('avg_confidence')}",
            f"- infer: {m['infer_ms']:.1f} ms ({m['fps']:.1f} FPS)",
            f"- TP/FP/FN: {m.get('tp')}/{m.get('fp')}/{m.get('fn')}",
            "",
        ]
        return lines

    md = [
        "# Banner MVP Experiment Comparison",
        "",
        f"- Common test images: **{len(rows)}** (intersection; GT from `banner_mvp_all`)",
        f"- conf={conf}, imgsz={imgsz}, device={device}",
        f"- all weights: `{w_all}`",
        f"- filtered weights: `{w_flt}`",
        "",
        "## Overall",
        "",
        *fmt_block("all", m_all),
        *fmt_block("filtered", m_flt),
        "## Internal selection score",
        "",
        f"- all: {selection_score(m_all):.4f}",
        f"- filtered: {selection_score(m_flt):.4f}",
        "",
        "```",
        "score = 0.35*R + 0.30*P + 0.25*mAP50 + 0.10*mAP50-95",
        "```",
        "",
    ]
    if detail_all and detail_flt:
        md += ["## Size bins (common test, IoU match)", ""]
        for bin_name in ("tiny", "small", "medium", "large"):
            a = detail_all["by_size"].get(bin_name, {})
            b = detail_flt["by_size"].get(bin_name, {})
            md.append(
                f"- **{bin_name}**: all P={a.get('precision', 0):.3f} R={a.get('recall', 0):.3f} "
                f"mAP50={a.get('map50', 0):.3f} | "
                f"filtered P={b.get('precision', 0):.3f} R={b.get('recall', 0):.3f} "
                f"mAP50={b.get('map50', 0):.3f}"
            )
        md += ["", "## Type / day-night / orientation", ""]
        for t in TYPE_ORDER:
            a = detail_all["by_type"].get(t, {})
            b = detail_flt["by_type"].get(t, {})
            md.append(
                f"- **{t}**: all R={a.get('recall', 0):.3f} P={a.get('precision', 0):.3f} | "
                f"filtered R={b.get('recall', 0):.3f} P={b.get('precision', 0):.3f}"
            )
        md += [
            "",
            "### Day / Night",
            "",
        ]
        for k in ("day", "night"):
            a = detail_all["by_day_night"].get(k, {})
            b = detail_flt["by_day_night"].get(k, {})
            md.append(
                f"- **{k}**: all R={a.get('recall', 0):.3f} | filtered R={b.get('recall', 0):.3f}"
            )
        md += ["", "### Horizontal / Vertical", ""]
        for k in ("horizontal", "vertical"):
            a = detail_all["by_orientation"].get(k, {})
            b = detail_flt["by_orientation"].get(k, {})
            md.append(
                f"- **{k}**: all R={a.get('recall', 0):.3f} | filtered R={b.get('recall', 0):.3f}"
            )
        md += [
            "",
            "## FP / FN galleries",
            "",
            "- `all_fp/`, `all_fn/`",
            "- `filtered_fp/`, `filtered_fn/`",
            "",
            "### Representative cases",
            "",
        ]
        for label, detail in (("all", detail_all), ("filtered", detail_flt)):
            fps = [c["file"] for c in detail.get("fp_cases", [])[:5]]
            fns = [c["file"] for c in detail.get("fn_cases", [])[:5]]
            md.append(f"- {label} FP samples: {', '.join(fps) if fps else '(none)'}")
            md.append(f"- {label} FN samples: {', '.join(fns) if fns else '(none)'}")
        md.append("")

    md += [
        "## Recommendation for 30-epoch train",
        "",
        f"**Recommended model/dataset: `{winner}`** (`datasets/banner_mvp_{winner}/`)",
        "",
        "Notes:",
    ]
    for n in notes:
        md.append(f"- {n}")
    md += [
        "",
        "### Next command",
        "",
        "```bash",
        next_cmd,
        "```",
        "",
        "Start 30 epoch from `yolo11s.pt` (not from the 10-epoch best) for clean interpretation.",
        "",
    ]
    (out / "comparison.md").write_text("\n".join(md), encoding="utf-8")

    summary = [
        "# Experiment Comparison Summary",
        "",
        f"1. Common test images: **{len(rows)}**",
        f"2. filtered: P={m_flt['precision']:.4f} R={m_flt['recall']:.4f} "
        f"mAP50={m_flt['map50']:.4f} mAP50-95={m_flt['map50_95']:.4f} "
        f"score={selection_score(m_flt):.4f}",
        f"3. all: P={m_all['precision']:.4f} R={m_all['recall']:.4f} "
        f"mAP50={m_all['map50']:.4f} mAP50-95={m_all['map50_95']:.4f} "
        f"score={selection_score(m_all):.4f}",
    ]
    if detail_all and detail_flt:
        ta = detail_all["by_size"].get("tiny", {})
        tf = detail_flt["by_size"].get("tiny", {})
        summary += [
            f"4. Tiny: all R={ta.get('recall', 0):.3f} mAP50={ta.get('map50', 0):.3f} | "
            f"filtered R={tf.get('recall', 0):.3f} mAP50={tf.get('map50', 0):.3f}",
            "5. Day/Night & 6. H/V: see comparison.md",
            "7. FP/FN galleries under all_fp/, all_fn/, filtered_fp/, filtered_fn/",
            f"8. Internal scores — all={selection_score(m_all):.4f}, filtered={selection_score(m_flt):.4f}",
            f"9. Recommended: **{winner}**",
            "10. Reasons:",
        ]
        for n in notes:
            summary.append(f"   - {n}")
        summary += [
            "11. 30-epoch command:",
            "",
            "```bash",
            next_cmd,
            "```",
            "",
        ]
    (out / "report_summary.md").write_text("\n".join(summary), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="platform root")
    parser.add_argument("--output", default="artifacts/experiment_comparison")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.5)
    parser.add_argument("--device", default="mps")
    parser.add_argument("--max-viz", type=int, default=20)
    parser.add_argument(
        "--skip-per-image",
        action="store_true",
        help="Only ultralytics val (faster); skip FP/FN galleries",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out = root / args.output
    all_ds = root / "datasets/banner_mvp_all"
    flt_ds = root / "datasets/banner_mvp_filtered"

    w_all = resolve_weights(root, "all")
    w_flt = resolve_weights(root, "filtered")
    missing = []
    if w_all is None:
        missing.append("weights/banner/experiment_all/best.pt (or runs/.../best.pt)")
    if w_flt is None:
        missing.append("weights/banner/experiment_filtered/best.pt (or runs/.../best.pt)")
    if missing:
        raise SystemExit(
            "[compare] incomplete — refusing to invent metrics.\n"
            f"  missing: {', '.join(missing)}\n"
            "  Wait for both 10-epoch runs, then re-run this script."
        )

    # Require metrics.json when under weights/banner/experiment_*
    for kind, wp in [("all", w_all), ("filtered", w_flt)]:
        metrics_side = wp.parent / "metrics.json"
        if "weights/banner/experiment_" in str(wp).replace("\\", "/") and not metrics_side.exists():
            print(f"[WARN] metrics.json missing next to {wp} (continuing with live eval)")

    print(f"[compare] all weights:      {w_all}")
    print(f"[compare] filtered weights: {w_flt}")

    out.mkdir(parents=True, exist_ok=True)
    data_yaml, rows = build_common_test(root, out, all_ds, flt_ds)
    print(f"[compare] common test images: {len(rows)}")
    print(f"[compare] manifest: {out / 'common_test_manifest.csv'}")

    # Export copies into canonical weight dirs if needed (skip same-file)
    for kind, src in [("experiment_all", w_all), ("experiment_filtered", w_flt)]:
        dest = root / "weights/banner" / kind
        dest.mkdir(parents=True, exist_ok=True)
        safe_copy_file(src, dest / "best.pt")
        last = src.parent / "last.pt"
        if last.exists():
            safe_copy_file(last, dest / "last.pt")

    print("[compare] ultralytics val — all …")
    m_all = run_ultralytics_val(w_all, data_yaml, args.imgsz, args.device, args.conf)
    print(
        f"[compare] all: P={m_all['precision']:.4f} R={m_all['recall']:.4f} "
        f"mAP50={m_all['map50']:.4f} mAP50-95={m_all['map50_95']:.4f}"
    )
    print("[compare] ultralytics val — filtered …")
    m_flt = run_ultralytics_val(w_flt, data_yaml, args.imgsz, args.device, args.conf)
    print(
        f"[compare] filtered: P={m_flt['precision']:.4f} R={m_flt['recall']:.4f} "
        f"mAP50={m_flt['map50']:.4f} mAP50-95={m_flt['map50_95']:.4f}"
    )

    detail_all = detail_flt = None
    if not args.skip_per_image:
        print("[compare] per-image analysis — all …")
        detail_all = per_image_analysis(
            w_all,
            rows,
            all_ds,
            out / "all_fp",
            out / "all_fn",
            args.imgsz,
            args.device,
            args.conf,
            args.iou,
            args.max_viz,
        )
        print("[compare] per-image analysis — filtered …")
        detail_flt = per_image_analysis(
            w_flt,
            rows,
            all_ds,
            out / "filtered_fp",
            out / "filtered_fn",
            args.imgsz,
            args.device,
            args.conf,
            args.iou,
            args.max_viz,
        )

    side_by_side(all_ds, out, [r["file"] for r in rows])

    m_all = merge_metrics(m_all, detail_all)
    m_flt = merge_metrics(m_flt, detail_flt)
    winner, notes = recommend(m_all, m_flt, detail_all, detail_flt)
    next_cmd = (
        "python -m training.train --config configs/banner/train.yaml"
        if winner == "filtered"
        else "python -m training.train --config configs/banner/train_all_30ep.yaml"
    )

    write_reports(
        out,
        rows,
        w_all,
        w_flt,
        m_all,
        m_flt,
        detail_all,
        detail_flt,
        winner,
        notes,
        next_cmd,
        args.conf,
        args.imgsz,
        args.device,
    )

    print(f"[compare] wrote {out / 'comparison.md'}")
    print(f"[compare] wrote {out / 'comparison.json'}")
    print(f"[compare] wrote {out / 'comparison.csv'}")
    print(f"[compare] wrote {out / 'report_summary.md'}")
    print(f"[compare] recommendation: {winner}")
    print(f"[compare] next: {next_cmd}")


if __name__ == "__main__":
    main()
