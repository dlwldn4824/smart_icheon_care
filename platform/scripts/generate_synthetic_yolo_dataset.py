#!/usr/bin/env python3
"""
Create a tiny SYNTHETIC banner YOLO set for pipeline smoke training only.
Not a substitute for AI Hub / field data.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def make_image(seed: int, w: int = 640, h: int = 360) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    rng = np.random.default_rng(seed)
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:] = (int(rng.integers(30, 60)), int(rng.integers(40, 70)), int(rng.integers(35, 65)))
    cv2.rectangle(frame, (0, int(h * 0.6)), (w, h), (70, 70, 70), -1)
    bw = int(rng.integers(220, 420))
    bh = int(rng.integers(50, 100))
    x1 = int(rng.integers(20, w - bw - 20))
    y1 = int(rng.integers(40, int(h * 0.45)))
    x2, y2 = x1 + bw, y1 + bh
    color = (int(rng.integers(0, 80)), int(rng.integers(0, 80)), int(rng.integers(150, 255)))
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, -1)
    cv2.putText(frame, "SAMPLE", (x1 + 10, y1 + bh // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cx = ((x1 + x2) / 2) / w
    cy = ((y1 + y2) / 2) / h
    nw = (x2 - x1) / w
    nh = (y2 - y1) / h
    return frame, (cx, cy, nw, nh)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="datasets/banner")
    parser.add_argument("--train", type=int, default=40)
    parser.add_argument("--val", type=int, default=10)
    parser.add_argument("--test", type=int, default=5)
    args = parser.parse_args()
    root = Path(args.output)
    for split, n in (("train", args.train), ("val", args.val), ("test", args.test)):
        (root / "images" / split).mkdir(parents=True, exist_ok=True)
        (root / "labels" / split).mkdir(parents=True, exist_ok=True)
        for i in range(n):
            img, box = make_image(seed=1000 + hash(split) % 1000 + i)
            name = f"synth_{split}_{i:03d}.jpg"
            cv2.imwrite(str(root / "images" / split / name), img)
            cx, cy, bw, bh = box
            (root / "labels" / split / name.replace(".jpg", ".txt")).write_text(
                f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n",
                encoding="utf-8",
            )
    (root / "data.yaml").write_text(
        "path: datasets/banner\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n\n"
        "names:\n"
        "  0: banner\n",
        encoding="utf-8",
    )
    meta = root / "metadata"
    meta.mkdir(exist_ok=True)
    (meta / "source_manifest.csv").write_text(
        "file,source,is_sample\n"
        "synth_*.jpg,generate_synthetic_yolo_dataset.py,true\n",
        encoding="utf-8",
    )
    print(f"[synth] wrote synthetic YOLO dataset → {root.resolve()}")
    print("[synth] WARNING: sample only. Replace with AI Hub / field data for real training.")


if __name__ == "__main__":
    main()
