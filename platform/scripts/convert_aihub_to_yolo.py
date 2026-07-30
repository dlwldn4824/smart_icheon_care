#!/usr/bin/env python3
"""
Convert AI Hub 종합 민원 이미지 → YOLO Detection (class 0 = banner).

Verified schema (TL*/TS* real files):
  - labels: annotations["Bbox Annotation"]["Box"] =
      {category_id, category_name, x, y, w, h}  # PIXELS on saved image
  - saved images are often 416x416 (meta.Resolution is original CCTV, ignore for normalize)
  - AI Hub name e.g. 가로현수막(*) → project class banner (never illegal_banner)

Use matching package numbers only, e.g. TL2 + TS2.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
STREET_BANNER_RE = re.compile(r"(가로현수막|세로현수막|불법\s*현수막)", re.I)
ANY_HYUNSUMAK_RE = re.compile(r"현수막", re.I)
XBANNER_RE = re.compile(r"엑스배너", re.I)
PKG_RE = re.compile(r"^(TL|VL|TS|VS)(\d+)", re.I)


def is_banner_category(name: str, include_xbanner: bool) -> bool:
    name = name or ""
    if include_xbanner and XBANNER_RE.search(name):
        return True
    if STREET_BANNER_RE.search(name):
        return True
    return bool(ANY_HYUNSUMAK_RE.search(name)) and not XBANNER_RE.search(name)


def pixel_box_to_yolo(x: float, y: float, bw: float, bh: float, img_w: int, img_h: int) -> str | None:
    if img_w <= 0 or img_h <= 0:
        return None
    cx = (x + bw / 2.0) / img_w
    cy = (y + bh / 2.0) / img_h
    nw = bw / img_w
    nh = bh / img_h
    if cx < 0 or cy < 0 or cx > 1 or cy > 1:
        return None
    nw = min(max(nw, 1e-6), 1.0)
    nh = min(max(nh, 1e-6), 1.0)
    return f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def package_key(path: Path) -> str | None:
    m = PKG_RE.match(path.name)
    return f"{m.group(1).upper()}{m.group(2)}" if m else None


def unique_label_zips(root: Path, packages: set[str] | None) -> list[Path]:
    """Dedupe identical TL/VL zip copies by size+name."""
    seen: set[tuple[str, int]] = set()
    out: list[Path] = []
    candidates = list(root.rglob("TL*.zip.part0")) + list(root.rglob("VL*.zip.part0"))
    candidates += [p for p in root.rglob("TL*.zip") if ".part" not in p.name]
    candidates += [p for p in root.rglob("VL*.zip") if ".part" not in p.name]
    for p in sorted(candidates, key=lambda x: (len(str(x)), str(x))):
        key = (p.name, p.stat().st_size)
        if key in seen:
            continue
        seen.add(key)
        pkg = package_key(p)
        if packages and (pkg is None or pkg not in packages):
            continue
        out.append(p)
    return out


def find_image_zip(root: Path, image_zip: str | None, packages: set[str] | None) -> Path:
    if image_zip:
        p = Path(image_zip)
        if not p.is_file():
            raise SystemExit(f"[convert] --image-zip not found: {p}")
        return p

    assembled = [p for p in root.rglob("TS*.zip") if ".part" not in p.name]
    assembled += [p for p in root.rglob("VS*.zip") if ".part" not in p.name]
    if not assembled:
        raise SystemExit(
            f"[convert] no assembled TS*/VS*.zip under {root}\n"
            "Assemble first, e.g.\n"
            "  cat TS2.zip.part0 TS2.zip.part... > TS2.zip"
        )

    wanted_nums: set[str] = set()
    if packages:
        for pkg in packages:
            m = PKG_RE.match(pkg)
            if m:
                wanted_nums.add(m.group(2))

    if wanted_nums:
        matched = []
        for p in assembled:
            m = PKG_RE.match(p.name)
            if m and m.group(2) in wanted_nums:
                matched.append(p)
        if matched:
            # Prefer TS over VS when both exist for same number; then largest.
            return max(
                matched,
                key=lambda p: (
                    1 if package_key(p) and package_key(p).startswith("TS") else 0,
                    p.stat().st_size,
                ),
            )

    # Fallback: never silently prefer a random largest zip when packages set.
    raise SystemExit(
        "[convert] could not match image zip to --packages.\n"
        f"  packages={sorted(packages) if packages else None}\n"
        f"  found={[p.name for p in assembled]}\n"
        "  Pass --image-zip explicitly, e.g. --image-zip datasets/raw/aihub_banner/TS2.zip"
    )


def split_by_group(items: list[dict], train: float, val: float, seed: int) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        groups[it["group"]].append(it)
    keys = list(groups.keys())
    rng = random.Random(seed)
    rng.shuffle(keys)
    n = len(keys)
    n_train = max(int(n * train), 1 if n else 0)
    n_val = max(int(n * val), 1 if n > 1 else 0)
    train_k = set(keys[:n_train])
    val_k = set(keys[n_train : n_train + n_val])
    out = []
    for k, rows in groups.items():
        split = "train" if k in train_k else "val" if k in val_k else "test"
        for r in rows:
            rr = dict(r)
            rr["split"] = split
            out.append(rr)
    return out


def probe_image_size(raw: bytes) -> tuple[int, int] | None:
    arr = np.frombuffer(raw, dtype=np.uint8)
    im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if im is None:
        return None
    h, w = im.shape[:2]
    return w, h


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--packages",
        default="TL2",
        help="Comma-separated label packages to convert, e.g. TL2 or TL2,VL2",
    )
    parser.add_argument(
        "--image-zip",
        default="",
        help="Explicit source zip (recommended). Example: datasets/raw/aihub_banner/TS2.zip",
    )
    parser.add_argument("--include-xbanner", action="store_true")
    parser.add_argument("--hard-negative-other-classes", action="store_true")
    parser.add_argument("--train", type=float, default=0.7)
    parser.add_argument("--val", type=float, default=0.2)
    parser.add_argument("--test", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-images", type=int, default=0, help="0=all; >0 for smoke subset")
    args = parser.parse_args()

    if abs(args.train + args.val + args.test - 1.0) > 1e-6:
        raise SystemExit("train+val+test must sum to 1")

    root = Path(args.input)
    out = Path(args.output)
    packages = {p.strip().upper() for p in args.packages.split(",") if p.strip()}
    label_zips = unique_label_zips(root, packages)
    ts_path = find_image_zip(root, args.image_zip or None, packages)
    if not label_zips:
        raise SystemExit(f"[convert] no label zip for packages={sorted(packages)} under {root}")

    print(f"[convert] packages: {sorted(packages)}")
    print(f"[convert] label zips: {[str(p) for p in label_zips]}")
    print(f"[convert] image zip: {ts_path}")

    ts_zip = zipfile.ZipFile(ts_path)
    ts_members = {
        Path(n).name: n for n in ts_zip.namelist() if Path(n).suffix.lower() in IMAGE_EXTS
    }
    print(f"[convert] images in zip: {len(ts_members)}")

    category_counter: Counter = Counter()
    banner_items: list[dict] = []
    hard_neg: list[dict] = []
    skipped_bad_box = 0
    skipped_missing_image = 0
    skipped_bad_image = 0
    seen: set[str] = set()
    default_size: tuple[int, int] | None = None

    for lz in label_zips:
        with zipfile.ZipFile(lz) as z:
            names = [n for n in z.namelist() if n.endswith(".json")]
            print(f"[convert] scanning {lz.name}: {len(names)} json")
            for name in names:
                data = json.loads(z.read(name))
                bbox_node = (data.get("annotations") or {}).get("Bbox Annotation")
                if not isinstance(bbox_node, dict):
                    continue
                file_name = bbox_node.get("atchFileName")
                if not file_name or file_name in seen:
                    continue
                seen.add(file_name)
                boxes = bbox_node.get("Box") or []
                names_in = [str(b.get("category_name", "")) for b in boxes]
                for cname in names_in:
                    category_counter[cname] += 1

                any_banner = any(is_banner_category(n, args.include_xbanner) for n in names_in)
                is_hard = (
                    args.hard_negative_other_classes
                    and names_in
                    and not any_banner
                )
                if not any_banner and not is_hard:
                    continue
                if file_name not in ts_members:
                    skipped_missing_image += 1
                    continue

                # TS2 images are uniformly 416x416; probe once then reuse.
                if default_size is None:
                    raw = ts_zip.read(ts_members[file_name])
                    size = probe_image_size(raw)
                    if size is None:
                        skipped_bad_image += 1
                        continue
                    default_size = size
                    print(f"[convert] image size: {size[0]}x{size[1]}")
                img_w, img_h = default_size

                meta = data.get("meta") or {}
                group = str(meta.get("job_Id") or meta.get("resource") or file_name.split("-")[0])
                yolo_lines: list[str] = []
                if any_banner:
                    for box in boxes:
                        cname = str(box.get("category_name", ""))
                        if not is_banner_category(cname, args.include_xbanner):
                            continue
                        line = pixel_box_to_yolo(
                            float(box["x"]),
                            float(box["y"]),
                            float(box["w"]),
                            float(box["h"]),
                            img_w,
                            img_h,
                        )
                        if line is None:
                            skipped_bad_box += 1
                            continue
                        yolo_lines.append(line)

                item = {
                    "file_name": file_name,
                    "group": group,
                    "lines": yolo_lines,
                    "categories": names_in,
                }
                if any_banner and yolo_lines:
                    banner_items.append(item)
                    if args.max_images and len(banner_items) >= args.max_images:
                        break
                elif is_hard:
                    item["lines"] = []
                    hard_neg.append(item)
            if args.max_images and len(banner_items) >= args.max_images:
                break

    print("[convert] category counts:")
    for k, v in category_counter.most_common(40):
        print(f"  {v:7d}  {k}")

    if not banner_items:
        ts_zip.close()
        raise SystemExit(
            "[convert] No 가로/세로/불법 현수막 labels found for selected packages.\n"
            "Check docs/AIHUB_CATEGORY_INDEX.md and pass --packages TL2 --image-zip .../TS2.zip"
        )

    if not args.hard_negative_other_classes:
        hard_neg = []

    split_items = split_by_group(banner_items + hard_neg, args.train, args.val, args.seed)
    for split in ("train", "val", "test"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
    meta_dir = out / "metadata"
    meta_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    copied = 0
    total = len(split_items)
    for i, it in enumerate(split_items, 1):
        split = it["split"]
        stem = Path(it["file_name"]).stem
        dst_img = out / "images" / split / it["file_name"]
        dst_lbl = out / "labels" / split / f"{stem}.txt"
        raw = ts_zip.read(ts_members[it["file_name"]])
        dst_img.write_bytes(raw)
        dst_lbl.write_text("\n".join(it["lines"]) + ("\n" if it["lines"] else ""), encoding="utf-8")
        copied += 1
        rows.append(
            {
                "file": it["file_name"],
                "split": split,
                "group": it["group"],
                "num_boxes": len(it["lines"]),
                "categories": "|".join(it["categories"]),
                "status": "ok",
            }
        )
        if i % 5000 == 0 or i == total:
            print(f"[convert] wrote {i}/{total}")

    ts_zip.close()

    with open(meta_dir / "source_manifest.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["file", "split", "group", "num_boxes", "categories", "status"]
        )
        w.writeheader()
        w.writerows(rows)

    # Keep path relative to platform root for Ultralytics runs from platform/
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n\n"
        "names:\n"
        "  0: banner\n",
        encoding="utf-8",
    )

    print("\n[convert] SUMMARY")
    print(f"  packages:      {sorted(packages)}")
    print(f"  image zip:     {ts_path.name}")
    print(f"  banner images: {len(banner_items)}")
    print(f"  banner boxes:  {sum(len(i['lines']) for i in banner_items)}")
    print(f"  hard-neg:      {len(hard_neg)}")
    print(f"  written:       {copied}")
    print(f"  missing image: {skipped_missing_image}")
    print(f"  bad image:     {skipped_bad_image}")
    print(f"  bad boxes:     {skipped_bad_box}")
    print(f"  include_xbanner: {args.include_xbanner}")
    for split in ("train", "val", "test"):
        print(f"  {split}: {sum(1 for r in rows if r['split']==split)}")
    print(f"  output: {out.resolve()}")


if __name__ == "__main__":
    main()
