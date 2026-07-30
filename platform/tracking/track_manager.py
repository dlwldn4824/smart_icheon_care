"""Track aggregation into municipal events (one banner => one event)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from models.base import TrackedObject


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


@dataclass
class AggregatedTrack:
    camera_id: str
    track_id: int
    class_name: str
    best_confidence: float
    best_bbox: tuple[float, float, float, float]
    hit_count: int = 0
    miss_count: int = 0
    first_ts: float = 0.0
    last_ts: float = 0.0
    closed: bool = False
    representative_frame_index: int = 0
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_s(self) -> float:
        return max(0.0, self.last_ts - self.first_ts)

    @property
    def key(self) -> str:
        return f"{self.camera_id}:{self.track_id}"


@dataclass
class MunicipalEvent:
    event_id: str
    camera_id: str
    track_id: int
    class_name: str
    best_confidence: float
    best_bbox: tuple[float, float, float, float]
    first_ts: float
    last_ts: float
    hit_count: int
    representative_frame_index: int
    status: str = "DETECTED"  # DETECTED | NEW | TRACKING | FINISHED
    start_frame: int = 0
    end_frame: int = 0


class TrackManager:
    def __init__(
        self,
        camera_id: str,
        min_hits: int = 3,
        max_age: int = 30,
        event_iou_threshold: float = 0.5,
        event_cooldown_seconds: float = 300.0,
    ) -> None:
        self.camera_id = camera_id
        self.min_hits = min_hits
        self.max_age = max_age
        self.event_iou_threshold = event_iou_threshold
        self.event_cooldown_seconds = event_cooldown_seconds
        self._tracks: dict[int, AggregatedTrack] = {}
        self._recent_events: list[MunicipalEvent] = []
        self._event_seq = 0

    def update(
        self,
        objects: list[TrackedObject],
        timestamp: float,
        frame_index: int,
    ) -> list[MunicipalEvent]:
        seen: set[int] = set()
        for obj in objects:
            seen.add(obj.track_id)
            agg = self._tracks.get(obj.track_id)
            if agg is None:
                self._tracks[obj.track_id] = AggregatedTrack(
                    camera_id=self.camera_id,
                    track_id=obj.track_id,
                    class_name=obj.class_name,
                    best_confidence=obj.confidence,
                    best_bbox=obj.bbox_xyxy,
                    hit_count=1,
                    first_ts=timestamp,
                    last_ts=timestamp,
                    representative_frame_index=frame_index,
                )
            else:
                agg.hit_count += 1
                agg.miss_count = 0
                agg.last_ts = timestamp
                if obj.confidence >= agg.best_confidence:
                    agg.best_confidence = obj.confidence
                    agg.best_bbox = obj.bbox_xyxy
                    agg.representative_frame_index = frame_index

        emitted: list[MunicipalEvent] = []
        for tid, agg in list(self._tracks.items()):
            if tid not in seen:
                agg.miss_count += 1
            if agg.miss_count > self.max_age:
                evt = self._close_track(agg)
                if evt:
                    emitted.append(evt)
                del self._tracks[tid]
        return emitted

    def flush(self) -> list[MunicipalEvent]:
        emitted: list[MunicipalEvent] = []
        for agg in list(self._tracks.values()):
            evt = self._close_track(agg)
            if evt:
                emitted.append(evt)
        self._tracks.clear()
        return emitted

    def _close_track(self, agg: AggregatedTrack) -> MunicipalEvent | None:
        agg.closed = True
        if agg.hit_count < self.min_hits:
            return None
        # Merge with recent event if same place within cooldown
        for prev in reversed(self._recent_events):
            if prev.camera_id != agg.camera_id:
                continue
            if agg.first_ts - prev.last_ts > self.event_cooldown_seconds:
                break
            if _iou(prev.best_bbox, agg.best_bbox) >= self.event_iou_threshold:
                prev.last_ts = max(prev.last_ts, agg.last_ts)
                prev.hit_count += agg.hit_count
                if agg.best_confidence >= prev.best_confidence:
                    prev.best_confidence = agg.best_confidence
                    prev.best_bbox = agg.best_bbox
                    prev.representative_frame_index = agg.representative_frame_index
                return None

        self._event_seq += 1
        event = MunicipalEvent(
            event_id=f"{self.camera_id}-E{self._event_seq:04d}",
            camera_id=self.camera_id,
            track_id=agg.track_id,
            class_name=agg.class_name,
            best_confidence=agg.best_confidence,
            best_bbox=agg.best_bbox,
            first_ts=agg.first_ts,
            last_ts=agg.last_ts,
            hit_count=agg.hit_count,
            representative_frame_index=agg.representative_frame_index,
            status="DETECTED",
        )
        self._recent_events.append(event)
        return event
