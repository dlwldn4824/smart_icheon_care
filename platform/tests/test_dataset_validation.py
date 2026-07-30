from pathlib import Path

import pytest
import yaml

from training.dataset_check import validate_yolo_dataset
from utils.paths import resolve_path


def test_validate_current_dataset_or_clear_error(tmp_path: Path):
    # If real/synth images exist, validation should pass.
    data_yaml = resolve_path("datasets/banner/data.yaml")
    train_dir = resolve_path("datasets/banner/images/train")
    has_images = train_dir.exists() and any(train_dir.glob("*.jpg"))
    if has_images:
        info = validate_yolo_dataset(data_yaml)
        assert info["classes"] == ["banner"]
        assert info["counts"]["train"] > 0
        return

    with pytest.raises(FileNotFoundError) as exc:
        validate_yolo_dataset(data_yaml)
    assert "datasets/raw/aihub_banner" in str(exc.value)


def test_empty_dataset_raises_clear_error(tmp_path: Path):
    root = tmp_path / "banner"
    (root / "images" / "train").mkdir(parents=True)
    (root / "images" / "val").mkdir(parents=True)
    (root / "labels" / "train").mkdir(parents=True)
    (root / "labels" / "val").mkdir(parents=True)
    data = {
        "path": str(root),
        "train": "images/train",
        "val": "images/val",
        "names": {0: "banner"},
    }
    yaml_path = tmp_path / "data.yaml"
    # validate_yolo_dataset resolves relative to PLATFORM_ROOT — write absolute path in yaml
    data["path"] = str(root)
    yaml_path.write_text(yaml.safe_dump(data), encoding="utf-8")

    # Copy into platform temp via absolute path support
    from utils.paths import PLATFORM_ROOT

    target = PLATFORM_ROOT / "artifacts" / "tmp_empty_data.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    # Use absolute path string for path key
    target.write_text(
        yaml.safe_dump(
            {
                "path": str(root),
                "train": "images/train",
                "val": "images/val",
                "names": {0: "banner"},
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(FileNotFoundError) as exc:
        validate_yolo_dataset(target)
    assert "Refuse to train on empty data" in str(exc.value)
