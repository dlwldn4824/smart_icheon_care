"""Pre-train dataset validation."""

from __future__ import annotations

from pathlib import Path

import yaml

from utils.paths import resolve_path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def validate_yolo_dataset(data_yaml: str | Path) -> dict:
    path = resolve_path(data_yaml)
    if not path.exists():
        raise FileNotFoundError(
            f"data.yaml not found: {path}\n"
            "Place converted data at datasets/banner/ and ensure data.yaml exists.\n"
            "AI Hub raw path: datasets/raw/aihub_banner/"
        )
    cfg = yaml.safe_load(path.read_text(encoding="utf-8"))
    names = cfg.get("names") or {}
    if isinstance(names, dict):
        class_names = [names[k] for k in sorted(names, key=lambda x: int(x))]
    else:
        class_names = list(names)
    if class_names != ["banner"]:
        raise ValueError(f"MVP requires names: [banner], got {class_names}")

    root = resolve_path(cfg.get("path", "datasets/banner"))
    counts = {}
    for split_key in ("train", "val"):
        rel = cfg.get(split_key)
        if not rel:
            raise ValueError(f"missing '{split_key}' in {path}")
        split_dir = root / rel if not Path(rel).is_absolute() else Path(rel)
        # Ultralytics style: path + images/train
        if not split_dir.exists():
            split_dir = root / "images" / Path(rel).name
        imgs = [p for p in split_dir.glob("*") if p.suffix.lower() in IMAGE_EXTS] if split_dir.exists() else []
        counts[split_key] = len(imgs)
        if len(imgs) == 0:
            raise FileNotFoundError(
                f"No images for split '{split_key}' under {split_dir}.\n"
                "Refuse to train on empty data.\n"
                "1) Download AI Hub dataset Sn=492 manually\n"
                "2) Place under datasets/raw/aihub_banner/\n"
                "3) python scripts/convert_aihub_to_yolo.py --input datasets/raw/aihub_banner --output datasets/banner/all\n"
                "4) python scripts/split_dataset.py --input datasets/banner/all --output datasets/banner --group-by-camera"
            )
    return {"data_yaml": str(path), "root": str(root), "classes": class_names, "counts": counts}
