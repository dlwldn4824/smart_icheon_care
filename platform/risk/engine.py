"""
Illegal Likelihood engine.

CV does NOT decide legality. This engine combines detection persistence with
municipal/public-data features and returns human-reviewable levels.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

ILLEGAL_WEIGHTS = {
    "permit_mismatch": 0.35,
    "non_designated_location": 0.25,
    "expired_period": 0.20,
    "detection_persistence": 0.10,
    "complaint_history": 0.10,
}


@dataclass(slots=True)
class IllegalInputs:
    """All continuous fields are expected in [0, 1] or None (=unknown)."""

    permit_mismatch: float | None
    non_designated_location: float | None
    expired_period: float | None
    detection_persistence: float
    complaint_history: float
    location_uncertain: bool = False
    permit_data_missing: bool = False


@dataclass(slots=True)
class IllegalLikelihoodResult:
    score: float
    level: str
    reasons: list[str] = field(default_factory=list)
    requires_human_review: bool = True
    breakdown: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _level_from_score(score: float, forced_review: bool) -> str:
    if forced_review:
        return "REVIEW_REQUIRED"
    if score >= 0.75:
        return "HIGH"
    if score >= 0.45:
        return "MEDIUM"
    return "LOW"


class RiskEngine:
    """Alias-compatible name used across pipeline/API."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = dict(weights or ILLEGAL_WEIGHTS)
        total = sum(self.weights.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Illegal Likelihood weights must sum to 1.0, got {total}")

    def calculate(self, inputs: IllegalInputs) -> IllegalLikelihoodResult:
        forced = bool(inputs.permit_data_missing or inputs.location_uncertain)

        # Unknown administrative fields: use conservative mid values but force review.
        permit = (
            0.55 if inputs.permit_mismatch is None else _clamp01(inputs.permit_mismatch)
        )
        nondes = (
            0.55
            if inputs.non_designated_location is None
            else _clamp01(inputs.non_designated_location)
        )
        expired = (
            0.55 if inputs.expired_period is None else _clamp01(inputs.expired_period)
        )
        persist = _clamp01(inputs.detection_persistence)
        complaint = _clamp01(inputs.complaint_history)

        breakdown = {
            "permit_mismatch": permit,
            "non_designated_location": nondes,
            "expired_period": expired,
            "detection_persistence": persist,
            "complaint_history": complaint,
        }
        score = sum(self.weights[k] * breakdown[k] for k in self.weights)
        score = round(_clamp01(score), 4)
        level = _level_from_score(score, forced)

        reasons: list[str] = []
        if inputs.permit_data_missing:
            reasons.append("허가 데이터가 없어 확정 판정 불가 → 사람 검토 필요")
        if inputs.location_uncertain:
            reasons.append("위치 매칭 불확실 → 사람 검토 필요")
        if inputs.permit_mismatch is None:
            reasons.append("허가 현수막 목록 매칭 결과 불명")
        elif inputs.permit_mismatch >= 0.5:
            reasons.append("허가 현수막 목록에서 일치 항목을 찾지 못함")
        else:
            reasons.append("허가 현수막 후보와 위치가 근접함")

        if inputs.non_designated_location is None:
            reasons.append("지정 게시대 포함 여부 불명")
        elif inputs.non_designated_location >= 0.5:
            reasons.append("지정 게시대 반경 밖에서 탐지됨")
        else:
            reasons.append("지정 게시대 인근에서 탐지됨")

        if inputs.expired_period is not None and inputs.expired_period >= 0.5:
            reasons.append("게시 허가 기간이 만료되었거나 기간 정보가 없음")
        if persist >= 0.5:
            reasons.append("동일 객체가 지속적으로 탐지됨")
        if complaint >= 0.5:
            reasons.append("인근 민원 이력이 상대적으로 높음")

        return IllegalLikelihoodResult(
            score=score,
            level=level,
            reasons=reasons,
            requires_human_review=True,  # Human-in-the-loop always
            breakdown={k: round(v, 4) for k, v in breakdown.items()},
        )


# Backward-compatible alias
IllegalLikelihoodEngine = RiskEngine
