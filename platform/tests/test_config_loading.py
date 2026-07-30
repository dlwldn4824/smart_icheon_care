from utils.config import load_yaml
from utils.paths import resolve_path


def test_train_config_loads():
    cfg = load_yaml("configs/banner/train.yaml")
    assert cfg["model"] == "yolo11s.pt"
    assert int(cfg["imgsz"]) == 960
    assert cfg["optimizer"] == "AdamW"


def test_data_yaml_banner_only():
    import yaml

    data = yaml.safe_load(resolve_path("datasets/banner/data.yaml").read_text(encoding="utf-8"))
    assert data["names"][0] == "banner" or data["names"]["0"] == "banner"
