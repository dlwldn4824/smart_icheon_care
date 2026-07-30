"""Administrative Priority Score (separate from Illegal Likelihood)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

PRIORITY_WEIGHTS = {
    "illegal_likelihood": 0.35,
    "safety_risk": 0.25,
    "vulnerable_zone": 0.15,
    "complaint_frequency": 0.10,
    "pedestrian_volume": 0.10,
    "detection_duration": 0.05,
}


@dataclass(slots=True)
class PriorityInputs:
    illegal_likelihood: float
    safety_risk: float
    vulnerable_zone: float
    complaint_frequency: float
    pedestrian_volume: float
    detection_duration: float


@dataclass(slots=True)
class PriorityResult:
    score: float
    level: str
    reasons: list[str] = field(default_factory=list)
    breakdown: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _level(score: float) -> str:
    if score >= 0.80:
        return "P1"
    if score >= 0.60:
        return "P2"
    if score >= 0.40:
        return "P3"
    return "P4"


PRIORITY_LABELS = {
    "P1": "긴급 확인",
    "P2": "우선 확인",
    "P3": "일반 확인",
    "P4": "관찰",
}


class PriorityEngine:
    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = dict(weights or PRIORITY_WEIGHTS)
        total = sum(self.weights.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Priority weights must sum to 1.0, got {total}")

    def calculate(self, inputs: PriorityInputs) -> PriorityResult:
        breakdown = {
            "illegal_likelihood": _clamp01(inputs.illegal_likelihood),
            "safety_risk": _clamp01(inputs.safety_risk),
            "vulnerable_zone": _clamp01(inputs.vulnerable_zone),
            "complaint_frequency": _clamp01(inputs.complaint_frequency),
            "pedestrian_volume": _clamp01(inputs.pedestrian_volume),
            "detection_duration": _clamp01(inputs.detection_duration),
        }
        score = round(sum(self.weights[k] * breakdown[k] for k in self.weights), 4)
        level = _level(score)
        reasons = [
            f"불법 가능성 {breakdown['illegal_likelihood']:.2f}",
            f"안전 위험 {breakdown['safety_risk']:.2f}",
            f"취약지역 {breakdown['vulnerable_zone']:.2f}",
            f"민원 빈도 {breakdown['complaint_frequency']:.2f}",
            f"보행량 {breakdown['pedestrian_volume']:.2f}",
            f"탐지 지속 {breakdown['detection_duration']:.2f}",
            f"우선순위 {level} ({PRIORITY_LABELS[level]})",
        ]
        return PriorityResult(
            score=score,
            level=level,
            reasons=reasons,
            breakdown={k: round(v, 4) for k, v in breakdown.items()},
        )
