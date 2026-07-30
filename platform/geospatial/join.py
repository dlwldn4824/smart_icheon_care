"""
GeoSpatial feature join.

In production this queries PostGIS. Here we provide an in-memory adapter
so the Risk pipeline is testable without a database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from math import asin, cos, radians, sin, sqrt

from risk.factors import RiskFeatures


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * r * asin(sqrt(a))


@dataclass
class PermitRecord:
    permit_id: str
    lat: float
    lng: float
    end_date: date | None
    on_board: bool = False


@dataclass
class ZonePolygonApprox:
    """Circle approximation for MVP (center + radius_m)."""

    name: str
    lat: float
    lng: float
    radius_m: float
    feature_type: str


@dataclass
class GeoContextStore:
    permits: list[PermitRecord] = field(default_factory=list)
    zones: list[ZonePolygonApprox] = field(default_factory=list)
    complaints: list[tuple[float, float, int]] = field(default_factory=list)  # lat,lng,count
    accidents: list[tuple[float, float, int]] = field(default_factory=list)

    def join(
        self,
        lat: float,
        lng: float,
        det_conf: float,
        today: date | None = None,
    ) -> RiskFeatures:
        today = today or date.today()
        permit_matched: bool | None = None
        on_board = False
        expired: bool | None = None

        nearest = None
        nearest_d = 1e18
        for p in self.permits:
            d = haversine_m(lat, lng, p.lat, p.lng)
            if d < nearest_d:
                nearest_d = d
                nearest = p
        if nearest is not None and nearest_d <= 30:
            permit_matched = True
            on_board = nearest.on_board
            if nearest.end_date:
                expired = nearest.end_date < today
        elif self.permits:
            permit_matched = False

        zones = [
            z.name
            for z in self.zones
            if haversine_m(lat, lng, z.lat, z.lng) <= z.radius_m
        ]

        complaint_90d = sum(
            c for la, ln, c in self.complaints if haversine_m(lat, lng, la, ln) <= 80
        )
        accident_3y = sum(
            c for la, ln, c in self.accidents if haversine_m(lat, lng, la, ln) <= 100
        )

        improper = 0.1 if on_board else 0.9
        return RiskFeatures(
            det_conf=det_conf,
            permit_matched=permit_matched,
            on_designated_board=on_board,
            permit_expired=expired,
            complaint_90d=complaint_90d,
            facility_grade="high" if zones else "mid",
            vulnerable_zones=zones,
            accident_3y=accident_3y,
            improper_location_hint=improper,
        )
