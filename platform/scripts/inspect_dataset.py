#!/usr/bin/env python3
"""Inspect AI Hub raw folder / zip parts. Does not guess schemas."""

from __future__ import annotations

import argparse
import json
import zipfile
from collections import Counter
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def list_zip_categories(zip_path: Path) -> Counter:
    counts: Counter = Counter()
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            parts = Path(name).parts
            if len(parts) >= 2 and name.endswith(".json"):
                counts[parts[1]] += 1
            elif len(parts) >= 2 and Path(name).suffix.lower() in IMAGE_EXTS:
                counts[parts[1]] += 1
    return counts


def sample_json_from_zip(zip_path: Path, n: int = 3) -> list[tuple[str, dict]]:
    out = []
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if not name.endswith(".json"):
                continue
            data = json.loads(z.read(name))
            out.append((name, data))
            if len(out) >= n:
                break
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="datasets/raw/aihub_banner")
    args = parser.parse_args()
    root = Path(args.input)
    if not root.exists():
        raise SystemExit(f"[inspect] not found: {root.resolve()}")

    print(f"root: {root.resolve()}")
    print("\n== top-level ==")
    for p in sorted(root.iterdir()):
        if p.name.startswith("."):
            continue
        print(f"  {'DIR ' if p.is_dir() else 'FILE'} {p.name}")

    label_zips = list(root.rglob("TL*.zip*")) + list(root.rglob("*라벨*.zip"))
    source_zips = list(root.rglob("TS*.zip")) + list(root.rglob("TS*.zip.part0"))
    # prefer assembled .zip over parts
    assembled = [p for p in root.rglob("TS*.zip") if ".part" not in p.name]
    label_complete = [
        p
        for p in root.rglob("TL*.zip*")
        if p.suffix == ".part0" or (p.suffix == ".zip" and ".part" not in p.name)
    ]

    print("\n== archives ==")
    for p in sorted(set(label_complete + assembled), key=str):
        print(f"  {p.relative_to(root)}  ({p.stat().st_size / 1e6:.1f} MB)")

    banner_hits = []
    print("\n== label zip categories ==")
    seen_zip: set[tuple[str, int]] = set()
    label_paths = []
    for zp in list(root.rglob("TL*.zip.part0")) + [
        p for p in root.rglob("TL*.zip") if ".part" not in p.name
    ]:
        key = (zp.name, zp.stat().st_size)
        if key in seen_zip:
            continue
        seen_zip.add(key)
        label_paths.append(zp)

    for zp in label_paths:
        try:
            cats = list_zip_categories(zp)
        except zipfile.BadZipFile:
            print(f"  BAD ZIP: {zp}")
            continue
        print(f"\n[{zp.relative_to(root)}]")
        for k, v in cats.most_common():
            mark = ""
            if any(x in k for x in ("현수막", "banner", "배너")):
                mark = "  << banner-related"
                banner_hits.append((zp.name, k, v))
            print(f"  {v:7d}  {k}{mark}")
        samples = sample_json_from_zip(zp, 3)
        for name, data in samples:
            print(f"\n  sample: {name}")
            print(f"  top keys: {list(data.keys())}")
            ann = data.get("annotations", {})
            bbox = ann.get("Bbox Annotation") or ann.get("bbox") or {}
            boxes = bbox.get("Box") if isinstance(bbox, dict) else None
            if boxes:
                print(f"  first box: {boxes[0]}")
            meta = data.get("meta", {})
            if meta:
                print(f"  meta.Resolution={meta.get('Resolution')} job={meta.get('job_Id')}")

    print("\n== banner class search ==")
    if banner_hits:
        for item in banner_hits:
            print(" ", item)
        only_xbanner = all("엑스배너" in k for _, k, _ in banner_hits) and not any(
            "현수막" in k for _, k, _ in banner_hits
        )
        if only_xbanner:
            print(
                "\nWARNING: '불법 현수막/가로현수막/세로현수막' 없음. "
                "현재는 보행방해물·엑스배너 등만 있습니다.\n"
                "AI Hub에서 현수막 원천·라벨 zip을 추가 다운로드하세요."
            )
    else:
        print("  NO banner-related category found in TL archives.")
        print("  Download 가로현수막/세로현수막 (원천+라벨) into this folder.")

    jpgs = list(root.rglob("*.jpg"))
    jsons = list(root.rglob("*.json"))
    print(f"\n== extracted files on disk: jpg={len(jpgs)} json={len(jsons)}")


if __name__ == "__main__":
    main()
