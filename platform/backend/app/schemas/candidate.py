from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CandidateOut(BaseModel):
    id: str
    task_id: str = "banner"
    track_id: str
    camera_id: str
    class_name: str = "banner"
    det_conf: float
    risk_score: int
    priority_score: int
    review_tier: Literal["urgent", "priority", "normal", "observe"]
    status: Literal["pending", "reviewing", "held", "resolved"]
    lat: float
    lng: float
    thumb_url: str | None = None
    reasons: list[str] = Field(default_factory=list)
    detected_at: datetime | None = None


class StatusUpdate(BaseModel):
    status: Literal["pending", "reviewing", "held", "resolved"]
    assignee: str | None = None


class HealthOut(BaseModel):
    status: str
    version: str
