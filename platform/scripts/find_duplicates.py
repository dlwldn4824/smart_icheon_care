#!/usr/bin/env python3
"""Find near-duplicate images by perceptual hash / file hash."""

from __future__ import annotations

import argparse
import hashlib
from collections import defaultdict
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    args = parser.parse_args()
    root = Path(args.dataset)
    images = [p for p in root.rglob("*") if p.suffix.lower() in IMAGE_EXTS]
    by_hash: dict[str, list[Path]] = defaultdict(list)
    for p in images:
        by_hash[file_md5(p)].append(p)

    dups = {k: v for k, v in by_hash.items() if len(v) > 1}
    print(f"images={len(images)} duplicate_groups={len(dups)}")
    for paths in list(dups.values())[:20]:
        print(" - " + " | ".join(str(p) for p in paths))


if __name__ == "__main__":
    main()
