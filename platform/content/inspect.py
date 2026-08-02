"""Crop a detected banner and run OCR + mark heuristics for content verdict."""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from content.illegal_text import (
    find_keyword_hits,
    has_permit_pattern,
    normalize_ocr_text,
    permit_text_overlap,
)

__all__ = ["InspectResult", "inspect_banner_crop", "verdict_from_risk"]

_OCR_READER = None


def verdict_from_risk(risk_0_100: float) -> tuple[bool, str]:
    """Stage-1 product verdict from municipal Risk score."""
    score = float(risk_0_100 or 0)
    if score >= 70:
        return True, "ILLEGAL_SUSPECT"
    return False, "LOW_RISK"


@dataclass
class InspectResult:
    content_verdict: str
    confidence: float
    ocr_text: str
    reasons: list[str] = field(default_factory=list)
    flags: dict[str, Any] = field(default_factory=dict)
    crop_preview_base64: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "content_verdict": self.content_verdict,
            "confidence": self.confidence,
            "ocr_text": self.ocr_text,
            "reasons": self.reasons,
            "flags": self.flags,
            "crop_preview_base64": self.crop_preview_base64,
        }


def _crop_with_pad(image: np.ndarray, bbox: list[float], pad_ratio: float = 0.04) -> np.ndarray:
    h, w = image.shape[:2]
    x1, y1, x2, y2 = [float(v) for v in bbox]
    bw, bh = max(x2 - x1, 1.0), max(y2 - y1, 1.0)
    px, py = bw * pad_ratio, bh * pad_ratio
    xa = max(int(x1 - px), 0)
    ya = max(int(y1 - py), 0)
    xb = min(int(x2 + px), w - 1)
    yb = min(int(y2 + py), h - 1)
    if xb <= xa or yb <= ya:
        return image.copy()
    return image[ya:yb, xa:xb].copy()


def _encode_jpeg_b64(image: np.ndarray) -> str | None:
    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _detect_possible_stamp(crop: np.ndarray) -> bool:
    """Heuristic: high-contrast circular/rectangular blob near corners (stamp/logo candidate)."""
    if crop.size == 0:
        return False
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    h, w = gray.shape[:2]
    corners = [
        gray[0 : max(h // 3, 1), 0 : max(w // 3, 1)],
        gray[0 : max(h // 3, 1), max(w - w // 3, 0) : w],
        gray[max(h - h // 3, 0) : h, 0 : max(w // 3, 1)],
        gray[max(h - h // 3, 0) : h, max(w - w // 3, 0) : w],
    ]
    for patch in corners:
        if patch.size < 25:
            continue
        edges = cv2.Canny(patch, 80, 160)
        edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
        if edge_ratio < 0.08:
            continue
        circles = cv2.HoughCircles(
            patch,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=max(patch.shape[0] // 4, 8),
            param1=100,
            param2=18,
            minRadius=4,
            maxRadius=max(min(patch.shape) // 2, 6),
        )
        if circles is not None and len(circles[0]) > 0:
            return True
        cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        area_patch = float(patch.shape[0] * patch.shape[1])
        for c in cnts[:20]:
            area = cv2.contourArea(c)
            if area < area_patch * 0.02 or area > area_patch * 0.6:
                continue
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.04 * peri, True)
            if 4 <= len(approx) <= 8:
                return True
    return False


def _run_ocr(crop: np.ndarray) -> tuple[str, bool]:
    """Returns (text, ocr_available)."""
    global _OCR_READER
    try:
        import easyocr  # type: ignore
    except ImportError:
        return "", False

    if _OCR_READER is None:
        _OCR_READER = easyocr.Reader(["ko", "en"], gpu=False, verbose=False)

    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB) if crop.ndim == 3 else crop
    try:
        results = _OCR_READER.readtext(rgb, detail=0, paragraph=True)
    except Exception:
        results = _OCR_READER.readtext(rgb, detail=0)
    if isinstance(results, list):
        text = " ".join(str(x) for x in results)
    else:
        text = str(results or "")
    return normalize_ocr_text(text), True


def inspect_banner_crop(
    image_bgr: np.ndarray,
    bbox_xyxy: list[float],
    *,
    permit_phrases: list[str] | None = None,
    on_designated_board: bool = False,
) -> InspectResult:
    crop = _crop_with_pad(image_bgr, bbox_xyxy)
    ocr_text, ocr_ok = _run_ocr(crop)
    stamp = _detect_possible_stamp(crop)
    hits = find_keyword_hits(ocr_text)
    permit_ok = has_permit_pattern(ocr_text)
    permit_hits = permit_text_overlap(ocr_text, permit_phrases or [])

    reasons: list[str] = []
    score = 0.35

    if not ocr_ok:
        reasons.append("OCR 엔진(easyocr) 미설치 — 내용 판정은 보류(NEEDS_REVIEW)")
        return InspectResult(
            content_verdict="NEEDS_REVIEW",
            confidence=0.4,
            ocr_text="",
            reasons=reasons,
            flags={
                "ocr_available": False,
                "possible_stamp": stamp,
                "keyword_hits": [],
                "permit_pattern": False,
                "permit_db_hits": [],
                "on_designated_board": on_designated_board,
            },
            crop_preview_base64=_encode_jpeg_b64(crop),
        )

    if not ocr_text:
        reasons.append("OCR 텍스트를 읽지 못함 — 해상도·각도 확인 필요")
        score += 0.1
    else:
        reasons.append(f"OCR 추출: {ocr_text[:80]}{'…' if len(ocr_text) > 80 else ''}")

    if hits:
        reasons.append("금칙어 매칭: " + ", ".join(hits))
        score += 0.35
    if not permit_ok and ocr_text:
        reasons.append("허가번호 패턴 없음")
        score += 0.15
    elif permit_ok:
        reasons.append("허가번호 유사 패턴 감지")
        score -= 0.12
    if permit_hits:
        reasons.append("허가 DB 문구 부분일치: " + ", ".join(permit_hits[:3]))
        score -= 0.2
    if stamp:
        reasons.append("도장·마크 후보(모서리 고대비 패치) 감지")
        if not hits:
            score -= 0.05
        else:
            score += 0.05
    if on_designated_board:
        reasons.append("지정게시대 영역 힌트(겹침)")
        score -= 0.15

    score = float(max(0.0, min(score, 0.98)))
    if hits or (not permit_ok and ocr_text and score >= 0.55):
        verdict = "ILLEGAL_SUSPECT"
    elif permit_ok or permit_hits or on_designated_board:
        verdict = "LIKELY_LEGAL" if score < 0.5 else "NEEDS_REVIEW"
    elif not ocr_text:
        verdict = "NEEDS_REVIEW"
    else:
        verdict = "NEEDS_REVIEW" if score >= 0.45 else "LIKELY_LEGAL"

    if verdict == "ILLEGAL_SUSPECT" and not hits:
        reasons.append("내용·허가 신호 부족으로 불법 의심")

    return InspectResult(
        content_verdict=verdict,
        confidence=round(score if verdict == "ILLEGAL_SUSPECT" else max(0.35, 1.0 - score), 3),
        ocr_text=ocr_text,
        reasons=reasons,
        flags={
            "ocr_available": True,
            "possible_stamp": stamp,
            "keyword_hits": hits,
            "permit_pattern": permit_ok,
            "permit_db_hits": permit_hits,
            "on_designated_board": on_designated_board,
        },
        crop_preview_base64=_encode_jpeg_b64(crop),
    )
