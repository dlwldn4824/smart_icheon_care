"""
Priority from Risk Score (0–100). Rule-based, no ML.

90+ Critical · 70+ High · 40+ Medium · else Low
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from priority.engine import PRIORITY_LABELS, PriorityEngine, PriorityInputs, PriorityResult
from risk.risk_engine import recommended_action_for

__all__ = [
    "PRIORITY_LABELS",
    "PriorityEngine",
    "PriorityInputs",
    "PriorityResult",
    "MunicipalPriorityEngine",
    "PriorityBand",
]


@dataclass(slots=True)
class PriorityBand:
    priority: str  # Critical | High | Medium | Low
    level: str  # P1–P4
    label: str
    risk_score: float
    priority_reason: str = ""
    recommended_action: str = ""
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MunicipalPriorityEngine:
    def calculate(
        self,
        risk_score: float,
        *,
        priority_reason: str = "",
    ) -> PriorityBand:
        score = max(0.0, min(100.0, float(risk_score)))
        if score >= 90:
            priority, level = "Critical", "P1"
        elif score >= 70:
            priority, level = "High", "P2"
        elif score >= 40:
            priority, level = "Medium", "P3"
        else:
            priority, level = "Low", "P4"
        label = PRIORITY_LABELS[level]
        action = recommended_action_for(priority)
        reason = priority_reason or f"Risk Score {score:.1f} → {priority} ({label})"
        return PriorityBand(
            priority=priority,
            level=level,
            label=label,
            risk_score=round(score, 1),
            priority_reason=reason,
            recommended_action=action,
            reasons=[reason, action],
        )
