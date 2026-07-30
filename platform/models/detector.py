"""YOLO11 detector wrapper (Ultralytics)."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from models.base import BaseDetector, Detection


class YOLODetector(BaseDetector):
    """
    Production MVP: YOLO11s.
    Why wrap Ultralytics: swap weights/task without changing pipeline code.
    """

    def __init__(
        self,
        weights: str | Path = "yolo11s.pt",
        class_names: list[str] | None = None,
        device: str | int = 0,
    ) -> None:
        self.weights = str(weights)
        self.class_names = class_names or ["banner"]
        self.device = device
        self._model = None

    def load(self, weights_path: str | None = None) -> None:
        from ultralytics import YOLO

        path = weights_path or self.weights
        self._model = YOLO(path)
        # Prefer names from checkpoint when available
        names = getattr(self._model, "names", None)
        if isinstance(names, dict):
            self.class_names = [names[i] for i in sorted(names)]

    def predict(self, frame_bgr: np.ndarray, conf: float = 0.25) -> list[Detection]:
        if self._model is None:
            self.load()
        assert self._model is not None

        results = self._model.predict(
            source=frame_bgr,
            conf=conf,
            verbose=False,
            device=self.device,
        )
        detections: list[Detection] = []
        if not results:
            return detections

        result = results[0]
        if result.boxes is None:
            return detections

        boxes = result.boxes
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(int)

        for box, score, cls_id in zip(xyxy, confs, clss, strict=False):
            name = (
                self.class_names[cls_id]
                if cls_id < len(self.class_names)
                else str(cls_id)
            )
            detections.append(
                Detection(
                    class_name=name,
                    confidence=float(score),
                    bbox_xyxy=(float(box[0]), float(box[1]), float(box[2]), float(box[3])),
                    class_id=int(cls_id),
                )
            )
        return detections


class BannerTask:
    """Task 1 module: banner presence detection only."""

    task_id = "banner"
    class_names = ["banner"]

    def __init__(self, weights: str = "weights/banner/yolo11s_best.pt") -> None:
        self.detector = YOLODetector(weights=weights, class_names=self.class_names)

    def detect(self, frame_bgr) -> list[Detection]:
        return self.detector.predict(frame_bgr)
