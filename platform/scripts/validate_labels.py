#!/usr/bin/env python3
"""Validate YOLO banner dataset before training.

Checks:
  - image/label count match per split
  - coords in 0~1
  - empty labels
  - class id == 0 only
  - train/val/test filename overlap
  - optional corrupt-image sampling
"""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def list_images(d: Path) -> list[Path]:
    if not d.exists():
        return []
    return sorted(p for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def jpeg_ok(path: Path) -> bool:
    try:
        raw = path.read_bytes()
    except OSError:
        return False
    if len(raw) < 100:
        return False
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        return raw[:2] == b"\xff\xd8" and raw[-2:] == b"\xff\xd9"
    if path.suffix.lower() == ".png":
        return raw[:8] == b"\x89PNG\r\n\x1a\n"
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="datasets/banner")
    parser.add_argument("--min-side-px", type=float, default=16.0)
    parser.add_argument(
        "--check-images",
        type=int,
        default=200,
        help="Corrupt-image sample size per split (0=skip, -1=all)",
    )
    args = parser.parse_args()

    root = Path(args.dataset)
    errors: list[str] = []
    warnings: list[str] = []
    tiny_rows: list[dict] = []
    total_boxes = 0
    empty_labels = 0
    orphan_labels = 0
    stems_by_split: dict[str, set[str]] = {}
    counts: dict[str, dict[str, int]] = {}

    for split in ("train", "val", "test"):
        img_dir = root / "images" / split
        lbl_dir = root / "labels" / split
        imgs = list_images(img_dir)
        lbls = sorted(lbl_dir.glob("*.txt")) if lbl_dir.exists() else []
        img_stems = {p.stem for p in imgs}
        lbl_stems = {p.stem for p in lbls}
        stems_by_split[split] = img_stems

        missing_lbl = img_stems - lbl_stems
        missing_img = lbl_stems - img_stems
        for s in sorted(missing_lbl)[:20]:
            errors.append(f"{split}: missing label for {s}")
        for s in sorted(missing_img)[:20]:
            errors.append(f"{split}: orphan label (no image) {s}")
            orphan_labels += 1
        if len(missing_lbl) > 20:
            errors.append(f"{split}: … +{len(missing_lbl) - 20} more missing labels")
        if len(missing_img) > 20:
            errors.append(f"{split}: … +{len(missing_img) - 20} more orphan labels")

        split_boxes = 0
        split_empty = 0
        for img in imgs:
            lbl = lbl_dir / f"{img.stem}.txt"
            if not lbl.exists():
                continue
            text = lbl.read_text(encoding="utf-8").strip()
            if not text:
                empty_labels += 1
                split_empty += 1
                continue
            for li, line in enumerate(text.splitlines(), 1):
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"{lbl}:{li} expected 5 fields")
                    continue
                cls, cx, cy, bw, bh = parts
                if cls != "0":
                    errors.append(f"{lbl}:{li} class must be 0 (banner), got {cls}")
                try:
                    cx_f, cy_f, bw_f, bh_f = map(float, (cx, cy, bw, bh))
                except ValueError:
                    errors.append(f"{lbl}:{li} non-numeric")
                    continue
                if not (0.0 <= cx_f <= 1.0 and 0.0 <= cy_f <= 1.0 and 0.0 < bw_f <= 1.0 and 0.0 < bh_f <= 1.0):
                    errors.append(f"{lbl}:{li} bbox out of range [{cx},{cy},{bw},{bh}]")
                # edge boxes may slightly exceed image after clamp failure
                x1, y1 = cx_f - bw_f / 2, cy_f - bh_f / 2
                x2, y2 = cx_f + bw_f / 2, cy_f + bh_f / 2
                if x1 < -1e-3 or y1 < -1e-3 or x2 > 1 + 1e-3 or y2 > 1 + 1e-3:
                    warnings.append(f"{lbl}:{li} box extends outside image")
                total_boxes += 1
                split_boxes += 1
                side = min(bw_f * 416.0, bh_f * 416.0)  # AI Hub saved size
                if side < args.min_side_px:
                    tiny_rows.append(
                        {
                            "split": split,
                            "file": img.name,
                            "line": li,
                            "min_side_px": round(side, 2),
                        }
                    )

        # corrupt image sample
        checked = 0
        bad = 0
        sample_n = args.check_images
        to_check = imgs if sample_n < 0 else imgs[:sample_n]
        for img in to_check:
            checked += 1
            if not jpeg_ok(img):
                bad += 1
                errors.append(f"{split}: corrupt/unreadable image {img.name}")
        if sample_n != 0 and bad == 0 and checked:
            print(f"[validate] {split}: image bytes OK (checked {checked})")

        counts[split] = {
            "images": len(imgs),
            "labels": len(lbls),
            "boxes": split_boxes,
            "empty_labels": split_empty,
        }

    # cross-split duplicates by filename stem
    pairs = [("train", "val"), ("train", "test"), ("val", "test")]
    for a, b in pairs:
        overlap = stems_by_split.get(a, set()) & stems_by_split.get(b, set())
        if overlap:
            errors.append(f"duplicate stems across {a}/{b}: {len(overlap)} (e.g. {next(iter(overlap))})")
        else:
            print(f"[validate] no filename overlap: {a} ∩ {b}")

    meta = root / "metadata"
    meta.mkdir(parents=True, exist_ok=True)
    tiny_path = meta / "tiny_objects_review.csv"
    with open(tiny_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["split", "file", "line", "min_side_px"])
        w.writeheader()
        w.writerows(tiny_rows)

    print("\n[validate] split counts")
    for split, c in counts.items():
        print(
            f"  {split}: images={c['images']:,} labels={c['labels']:,} "
            f"boxes={c['boxes']:,} empty={c['empty_labels']:,}"
        )
    print(
        f"\nboxes={total_boxes:,} empty_labels={empty_labels:,} "
        f"orphan_labels={orphan_labels:,} tiny={len(tiny_rows):,} "
        f"errors={len(errors):,} warnings={len(warnings):,}"
    )
    print(f"tiny review list → {tiny_path}")
    if warnings:
        print(f"WARNINGS (showing ≤20 / {len(warnings)}):")
        for wmsg in warnings[:20]:
            print(" -", wmsg)
    if errors:
        print("ERRORS:")
        for e in errors[:50]:
            print(" -", e)
        raise SystemExit(1)
    print("[validate] OK")


if __name__ == "__main__":
    main()
