"""
Public-data repository.

Sample CSV/GeoJSON values are FIXED (never random). Replace files in
`datasets/public_data/` with real municipal exports without changing call sites.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import date, datetime
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from utils.paths import resolve_path


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * r * asin(sqrt(a))


@dataclass(frozen=True)
class CameraRecord:
    camera_id: str
    latitude: float
    longitude: float
    heading: float
    admin_district: str
    location_name: str
    is_sample: bool = True


@dataclass(frozen=True)
class GeoContext:
    camera: CameraRecord
    approx_lat: float
    approx_lng: float
    location_uncertain: bool
    permit_data_missing: bool
    permit_mismatch: float | None
    non_designated_location: float | None
    expired_period: float | None
    complaint_norm: float
    accident_norm: float
    vulnerable_norm: float
    pedestrian_norm: float
    safety_risk: float
    matched_zones: list[str]
    notes: list[str]


class PublicDataRepository:
    def __init__(self, data_dir: str | Path = "datasets/public_data") -> None:
        self.data_dir = resolve_path(data_dir)
        self.cameras = self._load_cameras()
        self.permits = self._load_permits()
        self.boards = self._load_point_features("designated_banner_boards.geojson")
        self.child_zones = self._load_point_features("child_safety_zones.geojson")
        self.elderly_zones = self._load_point_features("elderly_safety_zones.geojson")
        self.complaints = self._load_complaints()
        self.accidents = self._load_accidents()
        self.pedestrian = self._load_pedestrian()

    def get_camera(self, camera_id: str) -> CameraRecord | None:
        return self.cameras.get(camera_id)

    def build_context(
        self,
        camera_id: str,
        today: date | None = None,
    ) -> GeoContext:
        today = today or date.today()
        cam = self.cameras.get(camera_id)
        notes: list[str] = []
        if cam is None:
            # Unknown camera: cannot invent coordinates.
            placeholder = CameraRecord(
                camera_id=camera_id,
                latitude=0.0,
                longitude=0.0,
                heading=0.0,
                admin_district="unknown",
                location_name="unknown",
                is_sample=True,
            )
            notes.append("camera_registry에 없는 CCTV → 위치 불확실")
            return GeoContext(
                camera=placeholder,
                approx_lat=0.0,
                approx_lng=0.0,
                location_uncertain=True,
                permit_data_missing=True,
                permit_mismatch=None,
                non_designated_location=None,
                expired_period=None,
                complaint_norm=0.0,
                accident_norm=0.0,
                vulnerable_norm=0.0,
                pedestrian_norm=0.0,
                safety_risk=0.0,
                matched_zones=[],
                notes=notes,
            )

        lat, lng = cam.latitude, cam.longitude
        notes.append(
            "좌표는 CCTV 설치 위치 근사값이며 현수막 정밀 GPS가 아님 (sample/registry)"
        )

        permit_data_missing = len(self.permits) == 0
        permit_mismatch: float | None
        expired_period: float | None
        if permit_data_missing:
            permit_mismatch = None
            expired_period = None
            notes.append("permitted_banners.csv 비어 있음")
        else:
            nearest = None
            nearest_d = 1e18
            for p in self.permits:
                d = haversine_m(lat, lng, p["lat"], p["lng"])
                if d < nearest_d:
                    nearest_d = d
                    nearest = p
            if nearest is not None and nearest_d <= 40:
                permit_mismatch = 0.15
                end = nearest.get("end_date")
                if end and end < today:
                    expired_period = 1.0
                    notes.append(f"근접 허가 {nearest['permit_id']} 기간 만료")
                else:
                    expired_period = 0.0
                    notes.append(f"근접 허가 {nearest['permit_id']} 매칭 (거리 {nearest_d:.1f}m)")
            else:
                permit_mismatch = 1.0
                expired_period = 0.8
                notes.append("허가 현수막 목록에서 일치 항목을 찾지 못함")

        if self.boards:
            board_d = min(haversine_m(lat, lng, b["lat"], b["lng"]) for b in self.boards)
            # within 25m of designated board → designated
            non_designated = 0.1 if board_d <= 25 else 1.0
            notes.append(
                "지정 게시대 인근" if board_d <= 25 else "지정 게시대 반경 밖에서 탐지됨"
            )
        else:
            non_designated = None
            notes.append("지정 게시대 데이터 없음 → 위치 판정 불확실")

        zones: list[str] = []
        for z in self.child_zones:
            if haversine_m(lat, lng, z["lat"], z["lng"]) <= z.get("radius_m", 100):
                zones.append(z.get("name", "child_safety_zone"))
        for z in self.elderly_zones:
            if haversine_m(lat, lng, z["lat"], z["lng"]) <= z.get("radius_m", 100):
                zones.append(z.get("name", "elderly_safety_zone"))
        vulnerable = 1.0 if zones else 0.0

        complaint_count = sum(
            c["count"]
            for c in self.complaints
            if haversine_m(lat, lng, c["lat"], c["lng"]) <= 80
        )
        accident_count = sum(
            a["count"]
            for a in self.accidents
            if haversine_m(lat, lng, a["lat"], a["lng"]) <= 100
        )
        ped = self.pedestrian.get(cam.admin_district, 0.0)

        complaint_norm = min(complaint_count / 5.0, 1.0)
        accident_norm = min(accident_count / 3.0, 1.0)
        safety = min(0.6 * vulnerable + 0.4 * accident_norm, 1.0)

        location_uncertain = non_designated is None or cam.latitude == 0.0
        return GeoContext(
            camera=cam,
            approx_lat=lat,
            approx_lng=lng,
            location_uncertain=location_uncertain,
            permit_data_missing=permit_data_missing,
            permit_mismatch=permit_mismatch,
            non_designated_location=non_designated,
            expired_period=expired_period,
            complaint_norm=complaint_norm,
            accident_norm=accident_norm,
            vulnerable_norm=vulnerable,
            pedestrian_norm=min(max(ped, 0.0), 1.0),
            safety_risk=safety,
            matched_zones=zones,
            notes=notes,
        )

    def _load_cameras(self) -> dict[str, CameraRecord]:
        path = self.data_dir / "camera_registry.csv"
        out: dict[str, CameraRecord] = {}
        if not path.exists():
            return out
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                out[row["camera_id"]] = CameraRecord(
                    camera_id=row["camera_id"],
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    heading=float(row.get("heading", 0) or 0),
                    admin_district=row.get("admin_district")
                    or row.get("district")
                    or "",
                    location_name=row.get("location_name", ""),
                    is_sample=row.get("is_sample", "true").lower() == "true",
                )
        return out

    def _load_permits(self) -> list[dict]:
        path = self.data_dir / "permitted_banners.csv"
        if not path.exists():
            return []
        rows = []
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                end_raw = (row.get("end_date") or "").strip()
                end = datetime.strptime(end_raw, "%Y-%m-%d").date() if end_raw else None
                rows.append(
                    {
                        "permit_id": row["permit_id"],
                        "lat": float(row["latitude"]),
                        "lng": float(row["longitude"]),
                        "end_date": end,
                        "is_sample": row.get("is_sample", "true"),
                    }
                )
        return rows

    def _load_point_features(self, filename: str) -> list[dict]:
        path = self.data_dir / filename
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        feats = []
        for ft in data.get("features", []):
            props = ft.get("properties", {})
            coords = ft.get("geometry", {}).get("coordinates", [0, 0])
            feats.append(
                {
                    "name": props.get("name", filename),
                    "lat": float(coords[1]),
                    "lng": float(coords[0]),
                    "radius_m": float(props.get("radius_m", 100)),
                    "is_sample": props.get("is_sample", True),
                }
            )
        return feats

    def _load_complaints(self) -> list[dict]:
        path = self.data_dir / "complaint_history.csv"
        if not path.exists():
            return []
        with open(path, encoding="utf-8") as f:
            return [
                {
                    "lat": float(r["latitude"]),
                    "lng": float(r["longitude"]),
                    "count": int(r["count_90d"]),
                }
                for r in csv.DictReader(f)
            ]

    def _load_accidents(self) -> list[dict]:
        path = self.data_dir / "accident_history.csv"
        if not path.exists():
            return []
        with open(path, encoding="utf-8") as f:
            return [
                {
                    "lat": float(r["latitude"]),
                    "lng": float(r["longitude"]),
                    "count": int(r["count_3y"]),
                }
                for r in csv.DictReader(f)
            ]

    def _load_pedestrian(self) -> dict[str, float]:
        path = self.data_dir / "pedestrian_volume.csv"
        if not path.exists():
            return {}
        with open(path, encoding="utf-8") as f:
            return {
                r["admin_district"]: float(r["volume_norm"])
                for r in csv.DictReader(f)
            }
