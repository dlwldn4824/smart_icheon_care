"""Unified frame iterator for image / folder / video / webcam / RTSP."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class FrameSampler:
    def __init__(self, source: str, target_fps: float = 2.0) -> None:
        self.source = source
        self.target_fps = target_fps

    def iter_frames(self) -> Iterator[tuple[int, float, np.ndarray]]:
        src = self.source
        path = Path(src)
        if src.isdigit():
            yield from self._from_capture(int(src))
            return
        if src.lower().startswith(("rtsp://", "http://", "https://")):
            yield from self._from_capture(src)
            return
        if path.is_dir():
            images = sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXTS)
            if not images:
                raise RuntimeError(f"No images in folder: {path}")
            for i, img_path in enumerate(images):
                frame = cv2.imread(str(img_path))
                if frame is None:
                    continue
                yield i, float(i) / max(self.target_fps, 1e-6), frame
            return
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
            frame = cv2.imread(str(path))
            if frame is None:
                raise RuntimeError(f"Cannot read image: {path}")
            yield 0, 0.0, frame
            return
        if path.is_file():
            yield from self._from_capture(str(path))
            return
        raise RuntimeError(f"Unsupported source: {src}")

    def _from_capture(self, src) -> Iterator[tuple[int, float, np.ndarray]]:
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {src}")
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        stride = max(int(round(src_fps / max(self.target_fps, 1e-6))), 1)
        index = 0
        emitted = 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if index % stride == 0:
                    yield emitted, index / src_fps, frame
                    emitted += 1
                index += 1
        finally:
            cap.release()
