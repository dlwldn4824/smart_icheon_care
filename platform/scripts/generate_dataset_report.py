#!/usr/bin/env python3
"""Generate banner dataset report + bbox preview images for visual QA."""

from __future__ import annotations

import argparse
import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

import cv2

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# AI Hub TL2 category id prefix in filenames: 9/10/11/12
TYPE_SPEC = [
    ("가로현수막(낮)", "9_", "horizontal_day"),
    ("가로현수막(밤)", "10_", "horizontal_night"),
    ("세로현수막(낮)", "11_", "vertical_day"),
    ("세로현수막(밤)", "12_", "vertical_night"),
]


def draw_yolo(img_path: Path, lbl_path: Path, out_path: Path) -> int:
    im = cv2.imread(str(img_path))
    if im is None:
        return 0
    h, w = im.shape[:2]
    n = 0
    if lbl_path.exists():
        for line in lbl_path.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) != 5:
                continue
            _, cx, cy, bw, bh = map(float, parts)
            x1 = int((cx - bw / 2) * w)
            y1 = int((cy - bh / 2) * h)
            x2 = int((cx + bw / 2) * w)
            y2 = int((cy + bh / 2) * h)
            cv2.rectangle(im, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(im, "banner", (x1, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
            n += 1
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), im)
    return n


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="datasets/banner")
    parser.add_argument("--output", default="artifacts/banner_dataset_report")
    parser.add_argument("--per-type", type=int, default=8, help="preview images per banner type")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    root = Path(args.dataset)
    out = Path(args.output)
    if out.suffix.lower() in {".md", ".csv"}:
        out_dir = out.with_suffix("")
        md_path = out if out.suffix.lower() == ".md" else out_dir / "dataset_report.md"
    else:
        out_dir = out
        md_path = out_dir / "dataset_report.md"
    preview_dir = out_dir / "previews"
    out_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    all_imgs: list[tuple[str, Path]] = []
    for split in ("train", "val", "test"):
        img_dir = root / "images" / split
        imgs = [p for p in img_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS] if img_dir.exists() else []
        boxes = 0
        empty = 0
        for img in imgs:
            all_imgs.append((split, img))
            lbl = root / "labels" / split / f"{img.stem}.txt"
            text = lbl.read_text(encoding="utf-8").strip() if lbl.exists() else ""
            if not text:
                empty += 1
            else:
                boxes += len([ln for ln in text.splitlines() if ln.strip()])
        rows.append({"split": split, "images": len(imgs), "boxes": boxes, "empty_labels": empty})

    # Prefer manifest categories when available
    by_cat: dict[str, list[tuple[str, Path]]] = defaultdict(list)
    manifest = root / "metadata" / "source_manifest.csv"
    if manifest.exists():
        with open(manifest, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                cats = (r.get("categories") or "").split("|")
                split = r["split"]
                path = root / "images" / split / r["file"]
                if not path.exists():
                    continue
                for c in cats:
                    if c:
                        by_cat[c].append((split, path))

    rng = random.Random(args.seed)
    preview_rows = []
    for label_name, prefix, slug in TYPE_SPEC:
        candidates = by_cat.get(label_name, [])
        if not candidates:
            candidates = [(s, p) for s, p in all_imgs if p.name.startswith(prefix)]
        rng.shuffle(candidates)
        picked = candidates[: args.per_type]
        print(f"[report] {label_name}: pool={len(candidates)} preview={len(picked)}")
        for i, (split, img) in enumerate(picked):
            lbl = root / "labels" / split / f"{img.stem}.txt"
            out_img = preview_dir / slug / f"{i:02d}_{split}_{img.name}"
            n = draw_yolo(img, lbl, out_img)
            preview_rows.append(
                {
                    "type": label_name,
                    "slug": slug,
                    "split": split,
                    "file": img.name,
                    "boxes_drawn": n,
                    "preview": str(out_img.relative_to(out_dir)),
                }
            )

    lines = [
        "# Banner Dataset Report",
        "",
        "Class: `banner` (id=0). Illegal/legal is NOT a detection label.",
        "",
        "## Split summary",
        "",
        "| split | images | boxes | empty_labels |",
        "|-------|-------:|------:|-------------:|",
    ]
    for r in rows:
        lines.append(
            f"| {r['split']} | {r['images']:,} | {r['boxes']:,} | {r['empty_labels']:,} |"
        )

    type_counts = Counter()
    for _, img in all_imgs:
        for label_name, prefix, _ in TYPE_SPEC:
            if img.name.startswith(prefix):
                type_counts[label_name] += 1
                break

    lines += ["", "## Filename-prefix type counts (approx)", ""]
    for label_name, _, _ in TYPE_SPEC:
        lines.append(f"- **{label_name}**: {type_counts[label_name]:,}")

    lines += [
        "",
        "## Visual QA previews",
        "",
        "Check that green boxes hug the banner (not shifted to 1920×1080 meta resolution).",
        "",
        f"Preview dir: `{preview_dir}`",
        "",
    ]
    for label_name, _, slug in TYPE_SPEC:
        lines.append(f"### {label_name}")
        for pr in preview_rows:
            if pr["slug"] != slug:
                continue
            lines.append(f"- `{pr['preview']}` ({pr['split']}, boxes={pr['boxes_drawn']})")
        lines.append("")

    lines += [
        "## Note on val/test",
        "",
        "Current val/test are **internal splits of TL2** (group-wise). "
        "When VL2/VS2 are confirmed as banner validation packages, use them as an external hold-out.",
        "",
    ]

    md_path.write_text("\n".join(lines), encoding="utf-8")
    csv_path = out_dir / "dataset_report.csv"
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["split", "images", "boxes", "empty_labels"])
        w.writeheader()
        w.writerows(rows)
    with open(out_dir / "previews_index.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["type", "slug", "split", "file", "boxes_drawn", "preview"]
        )
        w.writeheader()
        w.writerows(preview_rows)

    print(f"[report] {md_path}")
    print(f"[report] {csv_path}")
    print(f"[report] previews → {preview_dir}")


if __name__ == "__main__":
    main()
