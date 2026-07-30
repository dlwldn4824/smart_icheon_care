"""
Rule-based municipal Risk Score (0–100). No ML / no LLM.

Breakdown keys (sum capped at 100):
  base 30
  + complaint_hotspot 20
  + school_zone 15
  + high_population 10
  + no_permission 15
  + far_from_legal_board 10
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from risk.engine import IllegalInputs, IllegalLikelihoodEngine, IllegalLikelihoodResult, RiskEngine

__all__ = [
    "IllegalInputs",
    "IllegalLikelihoodEngine",
    "IllegalLikelihoodResult",
    "RiskEngine",
    "RuleRiskInputs",
    "RuleRiskResult",
    "MunicipalRiskEngine",
    "build_priority_reason",
    "recommended_action_for",
]


@dataclass(slots=True)
class RuleRiskInputs:
    complaint_hotspot: bool = False
    school_zone: bool = False
    high_population: bool = False
    no_permission: bool = False
    far_from_legal_board: bool = False


@dataclass(slots=True)
class RuleRiskResult:
    score: float  # 0–100
    risk_breakdown: dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)
    priority_reason: str = ""
    recommended_action: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def breakdown(self) -> dict[str, float]:
        return self.risk_breakdown


def build_priority_reason(inputs: RuleRiskInputs) -> str:
    parts: list[str] = []
    if inputs.no_permission:
        parts.append("허가 이력이 없고")
    if inputs.school_zone:
        parts.append("학교 인접 지역이며")
    if inputs.complaint_hotspot:
        parts.append("최근 민원이 많아")
    if inputs.far_from_legal_board:
        parts.append("지정 게시대에서 벗어나")
    if inputs.high_population:
        parts.append("유동인구가 높아")
    if not parts:
        return "탐지된 현수막에 대해 일반 확인이 필요합니다."
    # Korean connective cleanup
    body = " ".join(parts)
    if body.endswith("이며"):
        body = body[:-2] + "이며"
    return f"{body} 우선 확인이 필요합니다."


def recommended_action_for(priority: str) -> str:
    mapping = {
        "Critical": "24시간 이내 현장 확인 권장",
        "High": "48시간 이내 현장 확인 권장",
        "Medium": "행정 일정에 따라 현장 확인",
        "Low": "관찰 유지 · 재탐지 시 재평가",
    }
    return mapping.get(priority, "행정 일정에 따라 확인")


class MunicipalRiskEngine:
    BASE = 30.0
    ADD_COMPLAINT = 20.0
    ADD_SCHOOL = 15.0
    ADD_POPULATION = 10.0
    ADD_NO_PERMIT = 15.0
    ADD_FAR_BOARD = 10.0

    def calculate(self, inputs: RuleRiskInputs) -> RuleRiskResult:
        breakdown: dict[str, float] = {
            "base": self.BASE,
            "complaint_hotspot": self.ADD_COMPLAINT if inputs.complaint_hotspot else 0.0,
            "school_zone": self.ADD_SCHOOL if inputs.school_zone else 0.0,
            "high_population": self.ADD_POPULATION if inputs.high_population else 0.0,
            "no_permission": self.ADD_NO_PERMIT if inputs.no_permission else 0.0,
            "far_from_legal_board": self.ADD_FAR_BOARD if inputs.far_from_legal_board else 0.0,
        }
        raw = sum(breakdown.values())
        score = max(0.0, min(100.0, raw))
        reasons = [f"기본점수 {int(self.BASE)}"]
        if inputs.complaint_hotspot:
            reasons.append(f"민원 다발지역 +{int(self.ADD_COMPLAINT)}")
        if inputs.school_zone:
            reasons.append(f"학교 인접 +{int(self.ADD_SCHOOL)}")
        if inputs.high_population:
            reasons.append(f"유동인구 높음 +{int(self.ADD_POPULATION)}")
        if inputs.no_permission:
            reasons.append(f"허가 이력 없음 +{int(self.ADD_NO_PERMIT)}")
        if inputs.far_from_legal_board:
            reasons.append(f"지정 게시대 이탈 +{int(self.ADD_FAR_BOARD)}")

        # Priority band for recommended_action (local thresholds mirror MunicipalPriorityEngine)
        if score >= 90:
            pri = "Critical"
        elif score >= 70:
            pri = "High"
        elif score >= 40:
            pri = "Medium"
        else:
            pri = "Low"

        return RuleRiskResult(
            score=round(score, 1),
            risk_breakdown=breakdown,
            reasons=reasons,
            priority_reason=build_priority_reason(inputs),
            recommended_action=recommended_action_for(pri),
        )

    def from_geo(self, geo: Any) -> RuleRiskResult:
        no_permit = bool(
            geo.permit_data_missing
            or (geo.permit_mismatch is not None and geo.permit_mismatch >= 0.5)
        )
        far_board = bool(
            geo.non_designated_location is not None and geo.non_designated_location >= 0.5
        )
        return self.calculate(
            RuleRiskInputs(
                complaint_hotspot=float(geo.complaint_norm) >= 0.4,
                school_zone=float(geo.vulnerable_norm) >= 0.5,
                high_population=float(geo.pedestrian_norm) >= 0.5,
                no_permission=no_permit,
                far_from_legal_board=far_board,
            )
        )
