"""
Augmentation preview for CCTV banner domain.

Ultralytics handles mosaic/mixup during train.
This module previews Albumentations photometric/weather transforms only.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from utils.config import load_yaml
from utils.paths import ensure_dir, resolve_path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def build_preview_transform():
    import albumentations as A

    return A.Compose(
        [
            A.HorizontalFlip(p=0.5),
            A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
            A.HueSaturationValue(hue_shift_limit=5, sat_shift_limit=20, val_shift_limit=20, p=0.4),
            A.OneOf(
                [
                    A.MotionBlur(blur_limit=3, p=1.0),
                    A.GaussianBlur(blur_limit=(3, 3), p=1.0),
                ],
                p=0.25,
            ),
            A.RandomRain(p=0.15),
            A.RandomFog(fog_coef_lower=0.05, fog_coef_upper=0.2, p=0.1),
            A.Perspective(scale=(0.02, 0.05), p=0.3),
            A.CoarseDropout(
                max_holes=2,
                max_height=40,
                max_width=40,
                min_holes=1,
                fill_value=0,
                p=0.2,
            ),
        ]
    )


def preview(config: str, samples: int, output: str) -> None:
    import cv2

    cfg = load_yaml(config)
    data_yaml = resolve_path(cfg.get("data", "datasets/banner/data.yaml"))
    import yaml

    data = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))
    root = resolve_path(data.get("path", "datasets/banner"))
    train_dir = root / "images" / "train"
    images = [p for p in train_dir.glob("*") if p.suffix.lower() in IMAGE_EXTS] if train_dir.exists() else []
    if not images:
        raise SystemExit(
            f"[augment] no train images in {train_dir}. Prepare dataset first."
        )

    out = ensure_dir(output)
    tfm = build_preview_transform()
    for i, path in enumerate(images[:samples]):
        im = cv2.imread(str(path))
        if im is None:
            continue
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
        aug = tfm(image=rgb)["image"]
        before = out / f"{i:02d}_before{path.suffix.lower()}"
        after = out / f"{i:02d}_after{path.suffix.lower()}"
        cv2.imwrite(str(before), im)
        cv2.imwrite(str(after), cv2.cvtColor(aug, cv2.COLOR_RGB2BGR))
    print(f"[augment] wrote previews → {out.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/banner/train.yaml")
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--output", default="artifacts/augmentation_preview")
    args = parser.parse_args()
    preview(args.config, args.samples, args.output)


if __name__ == "__main__":
    main()
