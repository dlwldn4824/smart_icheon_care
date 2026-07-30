"""Task-agnostic perception interfaces for Municipal Vision Platform."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class Detection:
    """Single-frame object detection. Legality is NOT encoded in class_name."""

    class_name: str
    confidence: float
    bbox_xyxy: tuple[float, float, float, float]
    class_id: int = 0
    frame_index: int = 0
    timestamp: float = 0.0
    extras: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TrackedObject:
    track_id: int
    class_name: str
    confidence: float
    bbox_xyxy: tuple[float, float, float, float]
    age: int = 1
    hits: int = 1
    time_since_update: int = 0
    is_confirmed: bool = True


class VisionTask(ABC):
    """Extend this for dumping, road_damage, child_safety, etc."""

    task_id: str
    class_names: list[str]

    @abstractmethod
    def detect(self, frame_bgr) -> list[Detection]:
        raise NotImplementedError


class BaseDetector(ABC):
    @abstractmethod
    def predict(self, frame_bgr, conf: float = 0.25) -> list[Detection]:
        raise NotImplementedError

    @abstractmethod
    def load(self, weights_path: str) -> None:
        raise NotImplementedError
