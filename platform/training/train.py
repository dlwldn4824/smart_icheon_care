"""YOLO11s transfer learning entrypoint for banner MVP."""

from __future__ import annotations

import argparse
import json
import shutil
import traceback
from pathlib import Path

from training.dataset_check import validate_yolo_dataset
from utils.config import load_yaml
from utils.paths import ensure_dir, resolve_path, root


def pick_device(spec: str | int) -> str | int:
    if spec != "auto":
        return spec
    try:
        import torch

        if torch.cuda.is_available():
            return 0
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    except Exception:  # noqa: BLE001
        return "cpu"


def train(config_path: str) -> Path:
    cfg = load_yaml(config_path)
    data_yaml = resolve_path(cfg.get("data", "datasets/banner/data.yaml"))
    info = validate_yolo_dataset(data_yaml)
    print(f"[train] dataset OK: {info}")

    device = pick_device(cfg.get("device", "auto"))
    imgsz = int(cfg.get("imgsz", 960))
    batch = cfg.get("batch", -1)
    model_name = cfg.get("model", "yolo11s.pt")
    seed = int(cfg.get("seed", 42))

    from ultralytics import YOLO

    # Prefer experiment-specific export dir so A/B runs do not overwrite each other.
    weights_dir = ensure_dir(cfg.get("weights_dir", "weights/banner"))
    project = resolve_path(cfg.get("project", "runs/banner"))
    name = cfg.get("name", "yolo11s_mvp")

    def _run(sz: int):
        model = YOLO(model_name)
        train_kw = dict(
            data=str(data_yaml),
            epochs=int(cfg.get("epochs", 100)),
            imgsz=sz,
            batch=batch,
            device=device,
            workers=int(cfg.get("workers", 4)),
            patience=int(cfg.get("patience", 20)),
            optimizer=cfg.get("optimizer", "AdamW"),
            lr0=float(cfg.get("lr0", 0.001)),
            lrf=float(cfg.get("lrf", 0.01)),
            weight_decay=float(cfg.get("weight_decay", 0.0005)),
            cos_lr=bool(cfg.get("cos_lr", True)),
            amp=bool(cfg.get("amp", True)),
            cache=bool(cfg.get("cache", False)),
            seed=seed,
            deterministic=bool(cfg.get("deterministic", True)),
            close_mosaic=int(cfg.get("close_mosaic", 10)),
            mosaic=float(cfg.get("mosaic", 1.0)),
            mixup=float(cfg.get("mixup", 0.0)),
            copy_paste=float(cfg.get("copy_paste", 0.0)),
            hsv_h=float(cfg.get("hsv_h", 0.01)),
            hsv_s=float(cfg.get("hsv_s", 0.4)),
            hsv_v=float(cfg.get("hsv_v", 0.3)),
            degrees=float(cfg.get("degrees", 3.0)),
            translate=float(cfg.get("translate", 0.08)),
            scale=float(cfg.get("scale", 0.4)),
            shear=float(cfg.get("shear", 0.0)),
            perspective=float(cfg.get("perspective", 0.0005)),
            flipud=float(cfg.get("flipud", 0.0)),
            fliplr=float(cfg.get("fliplr", 0.5)),
            erasing=float(cfg.get("erasing", 0.2)),
            project=str(project),
            name=name,
            exist_ok=bool(cfg.get("exist_ok", True)),
            pretrained=bool(cfg.get("pretrained", True)),
        )
        # Ultralytics subset fraction (smoke / quick runs)
        if "fraction" in cfg and cfg["fraction"] is not None:
            train_kw["fraction"] = float(cfg["fraction"])
        return model.train(**train_kw)

    try:
        results = _run(imgsz)
        used_imgsz = imgsz
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if imgsz > 640 and ("out of memory" in msg or "cuda" in msg and "memory" in msg):
            print(f"[train] imgsz={imgsz} OOM/memory error → fallback imgsz=640")
            results = _run(640)
            used_imgsz = 640
        else:
            print("[train] failed:")
            traceback.print_exc()
            raise SystemExit(
                f"[train] aborted: {exc}\n"
                f"config={resolve_path(config_path)}\n"
                f"data={data_yaml}\n"
                f"device={device}"
            ) from exc

    save_dir = Path(results.save_dir)
    best = save_dir / "weights" / "best.pt"
    last = save_dir / "weights" / "last.pt"
    if not best.exists():
        raise SystemExit(f"[train] best.pt missing under {save_dir}")

    shutil.copy2(best, weights_dir / "best.pt")
    if last.exists():
        shutil.copy2(last, weights_dir / "last.pt")
    results_csv = save_dir / "results.csv"
    if results_csv.exists():
        shutil.copy2(results_csv, weights_dir / "results.csv")

    metrics = {
        "save_dir": str(save_dir),
        "best_pt": str(weights_dir / "best.pt"),
        "last_pt": str(weights_dir / "last.pt"),
        "results_csv": str(weights_dir / "results.csv") if results_csv.exists() else None,
        "imgsz": used_imgsz,
        "device": str(device),
        "model": model_name,
        "epochs": int(cfg.get("epochs", 0)),
        "dataset": info,
        "note": "Metrics reflect this training run only; do not invent external benchmarks.",
    }
    try:
        box = results.results_dict if hasattr(results, "results_dict") else {}
        metrics["ultralytics_results"] = {k: float(v) for k, v in dict(box).items() if isinstance(v, (int, float))}
    except Exception:  # noqa: BLE001
        pass

    metrics_path = weights_dir / "metrics.json"
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[train] best → {weights_dir / 'best.pt'}")
    print(f"[train] last → {weights_dir / 'last.pt'}")
    print(f"[train] metrics → {metrics_path}")
    return weights_dir / "best.pt"


def main() -> None:
    parser = argparse.ArgumentParser(description="Train banner YOLO11s MVP")
    parser.add_argument("--config", default="configs/banner/train.yaml")
    args = parser.parse_args()
    # Ensure imports resolve when launched as python -m training.train
    assert root().exists()
    train(args.config)


if __name__ == "__main__":
    main()
