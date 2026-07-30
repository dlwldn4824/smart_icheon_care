#!/usr/bin/env python3
"""
Create empty YOLO label files for Hard Negative images.

Hard negatives (do NOT label as banner):
- 상점 간판, 입간판, 버스 광고, 건물 외벽 광고, 도로 표지판
- 공사장 가림막, 천막, 선거 벽보, 전광판, 긴 교통 표지
"""

from __future__ import annotations

import argparse
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Folder of hard-negative images")
    parser.add_argument(
        "--labels-out",
        required=True,
        help="Folder to write empty .txt labels (same stems)",
    )
    args = parser.parse_args()
    src = Path(args.input)
    out = Path(args.labels_out)
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for img in src.rglob("*"):
        if img.suffix.lower() not in IMAGE_EXTS:
            continue
        (out / f"{img.stem}.txt").write_text("", encoding="utf-8")
        n += 1
    print(f"[hard-negative] wrote {n} empty labels → {out.resolve()}")


if __name__ == "__main__":
    main()
