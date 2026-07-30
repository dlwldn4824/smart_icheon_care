"""Camera registry loader."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from utils.paths import resolve_path


@dataclass(frozen=True)
class Camera:
    camera_id: str
    latitude: float
    longitude: float
    district: str
    location_name: str = ""
    heading: float | None = None


def load_camera_registry(path: str | Path | None = None) -> dict[str, Camera]:
    candidates = []
    if path:
        candidates.append(resolve_path(path))
    candidates.extend(
        [
            resolve_path("camera/camera_registry.csv"),
            resolve_path("datasets/public_data/camera_registry.csv"),
        ]
    )
    csv_path = next((p for p in candidates if p.is_file()), None)
    if csv_path is None:
        raise FileNotFoundError("camera_registry.csv not found")

    out: dict[str, Camera] = {}
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            cid = row.get("camera_id") or row.get("id")
            if not cid:
                continue
            district = row.get("district") or row.get("admin_district") or ""
            out[cid] = Camera(
                camera_id=cid,
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                district=district,
                location_name=row.get("location_name") or district,
                heading=float(row["heading"]) if row.get("heading") else None,
            )
    return out


def get_camera(camera_id: str, path: str | Path | None = None) -> Camera:
    reg = load_camera_registry(path)
    if camera_id not in reg:
        raise KeyError(f"unknown camera_id={camera_id}; known={sorted(reg)}")
    return reg[camera_id]
