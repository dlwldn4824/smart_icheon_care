#!/usr/bin/env python3
"""Generate samples/banner_test.mp4 for pipeline smoke tests (synthetic, labeled as sample)."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "samples" / "banner_test.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    w, h, fps, n = 640, 360, 30, 150
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(n):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (40, 50, 45)
        # road
        cv2.rectangle(frame, (0, 220), (w, h), (70, 70, 70), -1)
        # synthetic banner cloth
        x1, y1, x2, y2 = 120, 80, 520, 160
        cv2.rectangle(frame, (x1, y1), (x2, y2), (30, 60, 200), -1)
        cv2.putText(
            frame,
            "SAMPLE BANNER",
            (150, 130),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (255, 255, 255),
            2,
        )
        cv2.putText(
            frame,
            f"frame={i}",
            (10, 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (200, 200, 200),
            1,
        )
        writer.write(frame)
    writer.release()
    print(f"[sample] wrote {out} ({n} frames @ {fps}fps, synthetic)")


if __name__ == "__main__":
    main()
