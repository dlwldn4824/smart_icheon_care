"""Event lifecycle manager: NEW → TRACKING → FINISHED (deduped)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from models.base import TrackedObject
from tracking.track_manager import MunicipalEvent, _iou


@dataclass
class LiveTrack:
    camera_id: str
    track_id: int
    class_name: str
    best_confidence: float
    best_bbox: tuple[float, float, float, float]
    hit_count: int = 0
    miss_count: int = 0
    first_ts: float = 0.0
    last_ts: float = 0.0
    first_frame: int = 0
    last_frame: int = 0
    representative_frame_index: int = 0
    event_id: str | None = None
    status: str = "CANDIDATE"  # CANDIDATE | NEW | TRACKING | FINISHED


@dataclass
class EventUpdate:
    """Delta emitted each frame for persistence / dashboard."""

    event: MunicipalEvent
    change: str  # created | updated | finished


class EventManager:
    """
    Create an event once a track survives `min_hits` frames.
    Finish when the track is missing for more than `max_age` frames.
    Prevent duplicate events for the same location within cooldown.
    """

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
        self._tracks: dict[int, LiveTrack] = {}
        self._recent: list[MunicipalEvent] = []
        self._active: dict[str, MunicipalEvent] = {}
        self._event_seq = 0
        self._emitted_ids: set[str] = set()

    def update(
        self,
        objects: list[TrackedObject],
        timestamp: float,
        frame_index: int,
    ) -> list[EventUpdate]:
        seen: set[int] = set()
        out: list[EventUpdate] = []

        for obj in objects:
            seen.add(obj.track_id)
            tr = self._tracks.get(obj.track_id)
            if tr is None:
                self._tracks[obj.track_id] = LiveTrack(
                    camera_id=self.camera_id,
                    track_id=obj.track_id,
                    class_name=obj.class_name,
                    best_confidence=obj.confidence,
                    best_bbox=obj.bbox_xyxy,
                    hit_count=1,
                    first_ts=timestamp,
                    last_ts=timestamp,
                    first_frame=frame_index,
                    last_frame=frame_index,
                    representative_frame_index=frame_index,
                )
            else:
                tr.hit_count += 1
                tr.miss_count = 0
                tr.last_ts = timestamp
                tr.last_frame = frame_index
                if obj.confidence >= tr.best_confidence:
                    tr.best_confidence = obj.confidence
                    tr.best_bbox = obj.bbox_xyxy
                    tr.representative_frame_index = frame_index

            tr = self._tracks[obj.track_id]
            if tr.event_id is None and tr.hit_count >= self.min_hits:
                created = self._maybe_create(tr)
                if created:
                    out.append(EventUpdate(event=created, change="created"))
            elif tr.event_id is not None and tr.status in {"NEW", "TRACKING"}:
                evt = self._active[tr.event_id]
                evt.last_ts = tr.last_ts
                evt.hit_count = tr.hit_count
                if tr.best_confidence >= evt.best_confidence:
                    evt.best_confidence = tr.best_confidence
                    evt.best_bbox = tr.best_bbox
                    evt.representative_frame_index = tr.representative_frame_index
                if evt.status == "NEW":
                    evt.status = "TRACKING"
                    tr.status = "TRACKING"
                out.append(EventUpdate(event=evt, change="updated"))

        for tid, tr in list(self._tracks.items()):
            if tid not in seen:
                tr.miss_count += 1
            if tr.miss_count > self.max_age:
                finished = self._finish(tr)
                if finished:
                    out.append(EventUpdate(event=finished, change="finished"))
                del self._tracks[tid]
        return out

    def flush(self) -> list[EventUpdate]:
        out: list[EventUpdate] = []
        for tr in list(self._tracks.values()):
            finished = self._finish(tr)
            if finished:
                out.append(EventUpdate(event=finished, change="finished"))
        self._tracks.clear()
        return out

    def _maybe_create(self, tr: LiveTrack) -> MunicipalEvent | None:
        # Merge with recent finished/active event at same place
        for prev in reversed(self._recent):
            if prev.camera_id != tr.camera_id:
                continue
            if tr.first_ts - prev.last_ts > self.event_cooldown_seconds:
                break
            if _iou(prev.best_bbox, tr.best_bbox) >= self.event_iou_threshold:
                # attach to existing instead of new id
                tr.event_id = prev.event_id
                tr.status = "TRACKING"
                prev.last_ts = max(prev.last_ts, tr.last_ts)
                prev.hit_count += tr.hit_count
                if tr.best_confidence >= prev.best_confidence:
                    prev.best_confidence = tr.best_confidence
                    prev.best_bbox = tr.best_bbox
                    prev.representative_frame_index = tr.representative_frame_index
                prev.status = "TRACKING"
                self._active[prev.event_id] = prev
                return None

        self._event_seq += 1
        eid = f"{self.camera_id}-E{self._event_seq:04d}"
        evt = MunicipalEvent(
            event_id=eid,
            camera_id=tr.camera_id,
            track_id=tr.track_id,
            class_name=tr.class_name,
            best_confidence=tr.best_confidence,
            best_bbox=tr.best_bbox,
            first_ts=tr.first_ts,
            last_ts=tr.last_ts,
            hit_count=tr.hit_count,
            representative_frame_index=tr.representative_frame_index,
            status="NEW",
            start_frame=tr.first_frame,
            end_frame=tr.last_frame,
        )
        tr.event_id = eid
        tr.status = "NEW"
        self._active[eid] = evt
        self._recent.append(evt)
        self._emitted_ids.add(eid)
        return evt

    def _finish(self, tr: LiveTrack) -> MunicipalEvent | None:
        if tr.event_id and tr.event_id in self._active:
            evt = self._active[tr.event_id]
            evt.last_ts = tr.last_ts
            evt.hit_count = tr.hit_count
            if tr.best_confidence >= evt.best_confidence:
                evt.best_confidence = tr.best_confidence
                evt.best_bbox = tr.best_bbox
                evt.representative_frame_index = tr.representative_frame_index
            evt.status = "FINISHED"
            evt.end_frame = tr.last_frame
            del self._active[tr.event_id]
            return evt
        # Never reached min_hits → no event
        if tr.hit_count < self.min_hits:
            return None
        # Edge: min_hits met but create was merged away — emit finished once
        created = self._maybe_create(tr)
        if created is None and tr.event_id and tr.event_id in self._active:
            return self._finish(tr)
        if created:
            created.status = "FINISHED"
            return created
        return None
