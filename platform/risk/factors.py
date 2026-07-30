"""Geo/public-data features feeding RiskEngine."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class RiskFeatures:
    det_conf: float
    permit_matched: bool | None  # None = unknown
    on_designated_board: bool
    permit_expired: bool | None
    complaint_90d: int = 0
    facility_grade: str = "mid"
    vulnerable_zones: list[str] = field(default_factory=list)
    accident_3y: int = 0
    improper_location_hint: float = 0.0  # model/rule estimate 0–1

    def unpermitted_score(self) -> float:
        if self.permit_matched is True:
            return 0.0
        if self.permit_matched is False:
            return 1.0
        return 0.7

    def expired_score(self) -> float:
        if self.permit_expired is True:
            return 1.0
        if self.permit_expired is False:
            return 0.0
        # unknown + unmatched → treat as elevated
        return 0.8 if self.permit_matched is False else 0.4

    def improper_loc_score(self) -> float:
        if self.on_designated_board:
            return 0.1
        if self.improper_location_hint > 0:
            return self.improper_location_hint
        return 0.85

    def vulnerable_score(self) -> float:
        weights = {
            "어린이보호구역": 1.0,
            "school_zone": 1.0,
            "노인보호구역": 0.9,
            "elderly_zone": 0.9,
            "교차로": 0.85,
            "횡단보도": 0.8,
            "통학로": 0.95,
            "버스정류장": 0.7,
        }
        if not self.vulnerable_zones:
            return 0.0
        return max(weights.get(z, 0.5) for z in self.vulnerable_zones)
