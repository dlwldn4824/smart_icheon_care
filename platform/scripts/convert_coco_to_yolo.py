#!/usr/bin/env python3
"""Convert COCO detection JSON to YOLO txt (banner class remap)."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def coco_to_yolo_line(ann: dict, img_w: int, img_h: int) -> str:
    x, y, w, h = ann["bbox"]
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    return f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Directory with images/ and annotations.json (COCO)")
    parser.add_argument("--output", required=True, help="Output dir (images/ + labels/ under all/)")
    parser.add_argument(
        "--banner-category-names",
        default="banner,현수막,가로현수막,세로현수막,illegal banner",
        help="Comma-separated category names to map to class 0",
    )
    args = parser.parse_args()

    root = Path(args.input)
    ann_path = root / "annotations.json"
    if not ann_path.exists():
        candidates = list(root.rglob("*annotations*.json")) + list(root.rglob("instances_*.json"))
        if not candidates:
            raise SystemExit(f"[coco] annotations JSON not found under {root}")
        ann_path = candidates[0]

    data = json.loads(ann_path.read_text(encoding="utf-8"))
    wanted = {n.strip().lower() for n in args.banner_category_names.split(",") if n.strip()}
    cat_ok = {
        c["id"]
        for c in data.get("categories", [])
        if str(c.get("name", "")).lower() in wanted or "banner" in str(c.get("name", "")).lower() or "현수막" in str(c.get("name", ""))
    }
    if not cat_ok and data.get("categories"):
        # If only one category, accept it as banner for dedicated datasets
        if len(data["categories"]) == 1:
            cat_ok = {data["categories"][0]["id"]}
        else:
            raise SystemExit(
                f"[coco] no banner-like categories in {ann_path}. categories={[c.get('name') for c in data['categories']]}"
            )

    images = {im["id"]: im for im in data["images"]}
    anns_by_img: dict[int, list] = {}
    for ann in data.get("annotations", []):
        if ann.get("category_id") in cat_ok:
            anns_by_img.setdefault(ann["image_id"], []).append(ann)

    out = Path(args.output)
    img_out = out / "images"
    lbl_out = out / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    copied = 0
    for img_id, im in images.items():
        file_name = im["file_name"]
        src = root / file_name
        if not src.exists():
            src = next(root.rglob(Path(file_name).name), None)
        if src is None or not Path(src).exists():
            continue
        stem = Path(file_name).stem
        dst = img_out / f"{stem}{Path(src).suffix.lower()}"
        shutil.copy2(src, dst)
        lines = [
            coco_to_yolo_line(a, im["width"], im["height"])
            for a in anns_by_img.get(img_id, [])
        ]
        (lbl_out / f"{stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        copied += 1

    print(f"[coco] wrote {copied} images/labels → {out.resolve()}")


if __name__ == "__main__":
    main()
