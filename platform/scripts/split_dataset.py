#!/usr/bin/env python3
"""Split YOLO dataset into train/val/test with optional camera grouping."""

from __future__ import annotations

import argparse
import csv
import random
import re
import shutil
from collections import defaultdict
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
CAM_RE = re.compile(r"(CAM[-_]?\w+|CCTV[-_]?\w+|camera[-_]?\w+)", re.I)


def camera_key(stem: str) -> str:
    m = CAM_RE.search(stem)
    return m.group(1).upper() if m else stem.split("_")[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Dir with images/ and labels/")
    parser.add_argument("--output", required=True, help="datasets/banner")
    parser.add_argument("--train", type=float, default=0.7)
    parser.add_argument("--val", type=float, default=0.2)
    parser.add_argument("--test", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--group-by-camera", action="store_true")
    args = parser.parse_args()

    if abs(args.train + args.val + args.test - 1.0) > 1e-6:
        raise SystemExit("train+val+test must equal 1.0")

    root = Path(args.input)
    img_dir = root / "images" if (root / "images").exists() else root
    lbl_dir = root / "labels" if (root / "labels").exists() else root
    images = sorted([p for p in img_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS])
    if not images:
        raise SystemExit(f"[split] no images in {img_dir}")

    rng = random.Random(args.seed)
    out = Path(args.output)
    for split in ("train", "val", "test"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
    meta = out / "metadata"
    meta.mkdir(parents=True, exist_ok=True)

    if args.group_by_camera:
        groups: dict[str, list[Path]] = defaultdict(list)
        for p in images:
            groups[camera_key(p.stem)].append(p)
        keys = list(groups.keys())
        rng.shuffle(keys)
        n = len(keys)
        n_train = max(int(n * args.train), 1 if n else 0)
        n_val = max(int(n * args.val), 1 if n > 1 else 0)
        train_keys = set(keys[:n_train])
        val_keys = set(keys[n_train : n_train + n_val])
        test_keys = set(keys[n_train + n_val :]) or (val_keys if n > 1 else train_keys)

        assignments = []
        for key, imgs in groups.items():
            split = "train" if key in train_keys else "val" if key in val_keys else "test"
            for img in imgs:
                assignments.append((img, split, key))
        with open(meta / "camera_groups.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["camera_group", "split", "num_images"])
            for key, imgs in sorted(groups.items()):
                split = "train" if key in train_keys else "val" if key in val_keys else "test"
                w.writerow([key, split, len(imgs)])
    else:
        imgs = images[:]
        rng.shuffle(imgs)
        n = len(imgs)
        n_train = int(n * args.train)
        n_val = int(n * args.val)
        assignments = []
        for i, img in enumerate(imgs):
            if i < n_train:
                split = "train"
            elif i < n_train + n_val:
                split = "val"
            else:
                split = "test"
            assignments.append((img, split, camera_key(img.stem)))

    rows = []
    for img, split, group in assignments:
        lbl = lbl_dir / f"{img.stem}.txt"
        shutil.copy2(img, out / "images" / split / img.name)
        dst_lbl = out / "labels" / split / f"{img.stem}.txt"
        if lbl.exists():
            shutil.copy2(lbl, dst_lbl)
        else:
            dst_lbl.write_text("", encoding="utf-8")
        rows.append(
            {
                "file": img.name,
                "split": split,
                "camera_group": group,
                "label_exists": lbl.exists(),
            }
        )

    with open(meta / "split_manifest.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["file", "split", "camera_group", "label_exists"])
        w.writeheader()
        w.writerows(rows)

    data_yaml = out / "data.yaml"
    data_yaml.write_text(
        "path: datasets/banner\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n\n"
        "names:\n"
        "  0: banner\n",
        encoding="utf-8",
    )
    counts = {s: sum(1 for r in rows if r["split"] == s) for s in ("train", "val", "test")}
    print(f"[split] done → {out.resolve()} counts={counts}")


if __name__ == "__main__":
    main()
