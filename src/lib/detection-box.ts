import type { CSSProperties } from "react";

export interface DetectionBoxPercent {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 탐지 박스가 이미지 영역(0–100%) 밖으로 나가지 않도록 보정 */
export function clampDetectionBox(box: DetectionBoxPercent): DetectionBoxPercent {
  const x = Math.max(0, Math.min(100, box.x));
  const y = Math.max(0, Math.min(100, box.y));
  const width = Math.max(0, Math.min(100 - x, box.width));
  const height = Math.max(0, Math.min(100 - y, box.height));
  return { x, y, width, height };
}

export function detectionBoxStyle(box: DetectionBoxPercent): CSSProperties {
  const clamped = clampDetectionBox(box);
  return {
    left: `${clamped.x}%`,
    top: `${clamped.y}%`,
    width: `${clamped.width}%`,
    height: `${clamped.height}%`,
  };
}
