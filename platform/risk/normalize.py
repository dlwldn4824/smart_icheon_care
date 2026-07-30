"""Feature normalization helpers (0–1)."""

from __future__ import annotations


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def complaint_norm(count: int, cap: int = 5) -> float:
    return clamp01(count / cap)


def accident_norm(count: int, cap: int = 3) -> float:
    return clamp01(count / cap)


def facility_norm(grade: str) -> float:
    return {"low": 0.3, "mid": 0.6, "medium": 0.6, "high": 1.0}.get(grade.lower(), 0.5)


def travel_closeness(distance_m: float, cap_m: float = 5000.0) -> float:
    """Closer => higher priority contribution."""
    return clamp01(1.0 - distance_m / cap_m)


def workload_capacity(open_cases: int, cap: int = 10) -> float:
    """Fewer open cases => higher capacity to take a new job."""
    return clamp01(1.0 - open_cases / cap)


def dwell_norm(days: int, cap: int = 30) -> float:
    return clamp01(days / cap)
