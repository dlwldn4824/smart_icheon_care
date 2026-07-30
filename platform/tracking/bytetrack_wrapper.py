"""ByteTrack via Ultralytics with IoU fallback ID association."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import yaml

from models.base import TrackedObject

DEFAULT_BYTETRACK = {
    "tracker_type": "bytetrack",
    "track_high_thresh": 0.5,
    "track_low_thresh": 0.1,
    "new_track_thresh": 0.6,
    "track_buffer": 30,
    "match_thresh": 0.8,
    "fuse_score": True,
}


def write_tracker_yaml(path: str | Path, frame_rate: float = 2.0) -> Path:
    cfg = dict(DEFAULT_BYTETRACK)
    cfg["frame_rate"] = frame_rate
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    return path


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


class ByteTrackSession:
    def __init__(self, model, tracker_yaml: str) -> None:
        self.model = model
        self.tracker_yaml = tracker_yaml
        self._next_id = 1
        self._prev: list[TrackedObject] = []

    @classmethod
    def create(cls, weights: str, tracker_yaml: str, device: str | int = "cpu"):
        from ultralytics import YOLO

        model = YOLO(weights)
        return cls(model=model, tracker_yaml=tracker_yaml)

    def update(self, frame_bgr: np.ndarray, conf: float = 0.35) -> list[TrackedObject]:
        tracked = self._track_ultralytics(frame_bgr, conf)
        if tracked and self._ids_look_unstable(tracked):
            tracked = self._associate_by_iou(tracked)
        elif not tracked:
            tracked = self._predict_and_associate(frame_bgr, conf)
        self._prev = tracked
        return tracked

    def _track_ultralytics(self, frame_bgr: np.ndarray, conf: float) -> list[TrackedObject]:
        try:
            results = self.model.track(
                source=frame_bgr,
                persist=True,
                tracker=self.tracker_yaml,
                conf=conf,
                verbose=False,
            )
        except Exception:
            return []
        return self._boxes_to_tracked(results, allow_missing_ids=False)

    def _predict_and_associate(self, frame_bgr: np.ndarray, conf: float) -> list[TrackedObject]:
        results = self.model.predict(source=frame_bgr, conf=conf, verbose=False)
        dets = self._boxes_to_tracked(results, allow_missing_ids=True)
        return self._associate_by_iou(dets)

    def _boxes_to_tracked(self, results, allow_missing_ids: bool) -> list[TrackedObject]:
        if not results:
            return []
        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return []
        xyxy = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        clss = r.boxes.cls.cpu().numpy().astype(int)
        names = r.names or {}
        ids = None
        if r.boxes.id is not None:
            ids = r.boxes.id.cpu().numpy().astype(int)
        elif not allow_missing_ids:
            return []

        out: list[TrackedObject] = []
        for i, (box, score, cid) in enumerate(zip(xyxy, confs, clss, strict=False)):
            name = str(names.get(int(cid), "banner"))
            tid = int(ids[i]) if ids is not None else -1
            out.append(
                TrackedObject(
                    track_id=tid,
                    class_name="banner" if name == "banner" else name,
                    confidence=float(score),
                    bbox_xyxy=(float(box[0]), float(box[1]), float(box[2]), float(box[3])),
                )
            )
        return out

    def _ids_look_unstable(self, tracked: list[TrackedObject]) -> bool:
        if not self._prev or not tracked:
            return False
        # If every ID is brand new vs previous frame, treat as unstable tracker output
        prev_ids = {t.track_id for t in self._prev}
        cur_ids = {t.track_id for t in tracked}
        return len(prev_ids & cur_ids) == 0 and all(t.track_id > 0 for t in tracked)

    def _associate_by_iou(self, dets: list[TrackedObject], thr: float = 0.3) -> list[TrackedObject]:
        assigned_prev: set[int] = set()
        out: list[TrackedObject] = []
        for det in dets:
            best_iou, best_id = 0.0, None
            for prev in self._prev:
                if prev.track_id in assigned_prev:
                    continue
                val = _iou(det.bbox_xyxy, prev.bbox_xyxy)
                if val > best_iou:
                    best_iou, best_id = val, prev.track_id
            if best_id is not None and best_iou >= thr:
                tid = best_id
                assigned_prev.add(best_id)
            else:
                tid = self._next_id
                self._next_id += 1
            out.append(
                TrackedObject(
                    track_id=tid,
                    class_name=det.class_name,
                    confidence=det.confidence,
                    bbox_xyxy=det.bbox_xyxy,
                )
            )
        return out
