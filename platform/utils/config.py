from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from utils.paths import resolve_path


def load_yaml(path: str | Path) -> dict[str, Any]:
    resolved = resolve_path(path)
    if not resolved.exists():
        raise FileNotFoundError(f"Config not found: {resolved}")
    with open(resolved, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping: {resolved}")
    return data
