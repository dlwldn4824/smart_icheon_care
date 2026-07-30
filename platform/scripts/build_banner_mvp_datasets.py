#!/usr/bin/env python3
"""
Build balanced MVP banner datasets from the full TL2 conversion.

Preserves datasets/banner/ untouched. Creates:
  - datasets/banner_mvp_all/       (balanced subsample, all boxes kept)
  - datasets/banner_mvp_filtered/  (same images/split seed; drop boxes with w<8 or h<8 px)

Uses group-aware sampling so train/val/test comparisons stay fair across A/B.
Images are hard-linked (or copied) to avoid 5GB+ duplication when possible.
"""

from __future__ import annotations

import argparse
import csv
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

TYPE_ORDER = [
    "가로현수막(낮)",
    "가로현수막(밤)",
    "세로현수막(낮)",
    "세로현수막(밤)",
]

PREFIX_TO_TYPE = {
    "9": "가로현수막(낮)",
    "10": "가로현수막(밤)",
    "11": "세로현수막(낮)",
    "12": "세로현수막(밤)",
}


def primary_type(categories: str, file_name: str) -> str:
    cats = [c for c in (categories or "").split("|") if c]
    for t in TYPE_ORDER:
        if t in cats:
            return t
    prefix = file_name.split("_", 1)[0]
    return PREFIX_TO_TYPE.get(prefix, "unknown")


def link_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    try:
        os_link = getattr(__import__("os"), "link")
        os_link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def parse_boxes(lbl: Path) -> list[tuple[int, float, float, float, float]]:
    if not lbl.exists():
        return []
    out = []
    for line in lbl.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        cls, cx, cy, bw, bh = parts
        out.append((int(float(cls)), float(cx), float(cy), float(bw), float(bh)))
    return out


def filter_boxes(
    boxes: list[tuple[int, float, float, float, float]],
    img_w: int,
    img_h: int,
    min_side_px: float,
) -> tuple[list[tuple[int, float, float, float, float]], int]:
    kept = []
    dropped = 0
    for cls, cx, cy, bw, bh in boxes:
        w_px = bw * img_w
        h_px = bh * img_h
        if w_px < min_side_px or h_px < min_side_px:
            dropped += 1
            continue
        kept.append((cls, cx, cy, bw, bh))
    return kept, dropped


def write_label(path: Path, boxes: list[tuple[int, float, float, float, float]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{c} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}" for c, cx, cy, bw, bh in boxes]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def split_groups(group_ids: list[str], train: float, val: float, seed: int) -> dict[str, str]:
    rng = random.Random(seed)
    keys = list(group_ids)
    rng.shuffle(keys)
    n = len(keys)
    n_train = max(int(n * train), 1 if n else 0)
    n_val = max(int(n * val), 1 if n > 1 else 0)
    mapping = {}
    for i, g in enumerate(keys):
        if i < n_train:
            mapping[g] = "train"
        elif i < n_train + n_val:
            mapping[g] = "val"
        else:
            mapping[g] = "test"
    return mapping


def sample_balanced(
    by_type: dict[str, list[dict]],
    per_type: int,
    seed: int,
) -> list[dict]:
    rng = random.Random(seed)
    picked: list[dict] = []
    for t in TYPE_ORDER:
        rows = list(by_type.get(t, []))
        rng.shuffle(rows)
        # prefer unique groups first for diversity
        seen_g = set()
        diverse = []
        rest = []
        for r in rows:
            if r["group"] not in seen_g:
                seen_g.add(r["group"])
                diverse.append(r)
            else:
                rest.append(r)
        ordered = diverse + rest
        take = ordered[:per_type]
        if len(take) < per_type:
            print(f"[mvp] WARN {t}: only {len(take)}/{per_type} available")
        picked.extend(take)
    return picked


def materialize(
    name: str,
    rows: list[dict],
    group_split: dict[str, str],
    src_root: Path,
    out_root: Path,
    filter_min_side: float | None,
    img_size: tuple[int, int],
) -> dict:
    if out_root.exists():
        shutil.rmtree(out_root)
    stats = Counter()
    type_split = Counter()
    dropped_boxes = 0
    excluded_images: list[dict] = []
    manifest_rows = []
    img_w, img_h = img_size

    for r in rows:
        split = group_split[r["group"]]
        src_img = src_root / "images" / r["src_split"] / r["file"]
        src_lbl = src_root / "labels" / r["src_split"] / f"{Path(r['file']).stem}.txt"
        if not src_img.exists():
            # try any split
            found = None
            for s in ("train", "val", "test"):
                p = src_root / "images" / s / r["file"]
                if p.exists():
                    found = (p, src_root / "labels" / s / f"{Path(r['file']).stem}.txt")
                    break
            if not found:
                stats["missing_image"] += 1
                continue
            src_img, src_lbl = found

        boxes = parse_boxes(src_lbl)
        if filter_min_side is not None:
            boxes, n_drop = filter_boxes(boxes, img_w, img_h, filter_min_side)
            dropped_boxes += n_drop
            if not boxes:
                excluded_images.append(
                    {
                        "file": r["file"],
                        "group": r["group"],
                        "type": r["type"],
                        "reason": "all_boxes_filtered",
                    }
                )
                stats["excluded_empty"] += 1
                continue

        dst_img = out_root / "images" / split / r["file"]
        dst_lbl = out_root / "labels" / split / f"{Path(r['file']).stem}.txt"
        link_or_copy(src_img, dst_img)
        write_label(dst_lbl, boxes)
        stats[f"images_{split}"] += 1
        stats["boxes"] += len(boxes)
        type_split[f"{r['type']}|{split}"] += 1
        manifest_rows.append(
            {
                "file": r["file"],
                "split": split,
                "group": r["group"],
                "type": r["type"],
                "num_boxes": len(boxes),
                "dataset": name,
            }
        )

    meta = out_root / "metadata"
    meta.mkdir(parents=True, exist_ok=True)
    with open(meta / "source_manifest.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["file", "split", "group", "type", "num_boxes", "dataset"]
        )
        w.writeheader()
        w.writerows(manifest_rows)
    if excluded_images:
        with open(meta / "excluded_images.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["file", "group", "type", "reason"])
            w.writeheader()
            w.writerows(excluded_images)

    (out_root / "data.yaml").write_text(
        f"path: {out_root.resolve()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n\n"
        "names:\n"
        "  0: banner\n",
        encoding="utf-8",
    )

    report = {
        "dataset": name,
        "filter_min_side_px": filter_min_side,
        "dropped_boxes": dropped_boxes,
        "excluded_images": len(excluded_images),
        "counts": dict(stats),
        "type_split": dict(type_split),
    }
    (meta / "build_report.json").write_text(
        __import__("json").dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="datasets/banner")
    parser.add_argument("--per-type", type=int, default=4000, help="images per type before split")
    parser.add_argument("--train", type=float, default=0.75)
    parser.add_argument("--val", type=float, default=0.125)
    parser.add_argument("--test", type=float, default=0.125)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--img-w", type=int, default=416)
    parser.add_argument("--img-h", type=int, default=416)
    parser.add_argument("--min-side-px", type=float, default=8.0)
    args = parser.parse_args()
    if abs(args.train + args.val + args.test - 1.0) > 1e-6:
        raise SystemExit("train+val+test must sum to 1")

    src = Path(args.source)
    manifest = src / "metadata" / "source_manifest.csv"
    if not manifest.exists():
        raise SystemExit(f"missing {manifest}")

    rows = []
    with open(manifest, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            t = primary_type(r.get("categories", ""), r["file"])
            if t == "unknown":
                continue
            rows.append(
                {
                    "file": r["file"],
                    "src_split": r["split"],
                    "group": r["group"],
                    "type": t,
                    "categories": r.get("categories", ""),
                }
            )

    by_type: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_type[r["type"]].append(r)
    print("[mvp] pool by type:")
    for t in TYPE_ORDER:
        print(f"  {t}: {len(by_type[t]):,}")

    # Aim ~12k train-ish overall: 4000*4 = 16000 then split 75/12.5/12.5
    # → ~12k / 2k / 2k
    picked = sample_balanced(by_type, args.per_type, args.seed)
    print(f"[mvp] sampled images: {len(picked)}")

    groups = sorted({r["group"] for r in picked})
    group_split = split_groups(groups, args.train, args.val, args.seed)
    split_counts = Counter(group_split[r["group"]] for r in picked)
    print(f"[mvp] split by image (pre-filter): {dict(split_counts)}")

    out_all = Path("datasets/banner_mvp_all")
    out_flt = Path("datasets/banner_mvp_filtered")
    rep_all = materialize(
        "banner_mvp_all",
        picked,
        group_split,
        src,
        out_all,
        filter_min_side=None,
        img_size=(args.img_w, args.img_h),
    )
    rep_flt = materialize(
        "banner_mvp_filtered",
        picked,
        group_split,
        src,
        out_flt,
        filter_min_side=args.min_side_px,
        img_size=(args.img_w, args.img_h),
    )

    # human summary
    summary = Path("artifacts/banner_mvp_build_summary.md")
    summary.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Banner MVP Dataset Build",
        "",
        f"- source: `{src}` (preserved)",
        f"- seed: `{args.seed}` (shared group-aware split)",
        f"- per-type sample: {args.per_type}",
        f"- filter: width < {args.min_side_px}px OR height < {args.min_side_px}px",
        "",
        "## banner_mvp_all",
        f"- images train/val/test: "
        f"{rep_all['counts'].get('images_train', 0)} / "
        f"{rep_all['counts'].get('images_val', 0)} / "
        f"{rep_all['counts'].get('images_test', 0)}",
        f"- boxes: {rep_all['counts'].get('boxes', 0)}",
        "",
        "## banner_mvp_filtered",
        f"- images train/val/test: "
        f"{rep_flt['counts'].get('images_train', 0)} / "
        f"{rep_flt['counts'].get('images_val', 0)} / "
        f"{rep_flt['counts'].get('images_test', 0)}",
        f"- boxes: {rep_flt['counts'].get('boxes', 0)}",
        f"- dropped boxes: {rep_flt['dropped_boxes']}",
        f"- excluded images (all boxes filtered): {rep_flt['excluded_images']}",
        "",
        "## type × split (filtered)",
    ]
    for k in sorted(rep_flt["type_split"]):
        lines.append(f"- {k}: {rep_flt['type_split'][k]}")
    summary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[mvp] summary → {summary}")
    print("[mvp] DONE")
    print(f"  all:      {out_all}")
    print(f"  filtered: {out_flt}")


if __name__ == "__main__":
    main()
