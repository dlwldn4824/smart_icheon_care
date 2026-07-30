"""Project-root aware path helpers."""

from __future__ import annotations

from pathlib import Path

PLATFORM_ROOT = Path(__file__).resolve().parents[1]


def root() -> Path:
    return PLATFORM_ROOT


def resolve_path(path: str | Path) -> Path:
    p = Path(path)
    if p.is_absolute():
        return p
    return (PLATFORM_ROOT / p).resolve()


def ensure_dir(path: str | Path) -> Path:
    p = resolve_path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p
