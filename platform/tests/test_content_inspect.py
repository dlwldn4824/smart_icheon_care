"""Unit tests for content illegality heuristics (no OCR required)."""

from __future__ import annotations

import numpy as np

from content.illegal_text import find_keyword_hits, has_permit_pattern
from content.inspect import inspect_banner_crop, verdict_from_risk


def test_verdict_from_risk():
    assert verdict_from_risk(70) == (True, "ILLEGAL_SUSPECT")
    assert verdict_from_risk(69.9) == (False, "LOW_RISK")


def test_keyword_and_permit_patterns():
    assert "대부" in find_keyword_hits("저금리 대부 상담")
    assert has_permit_pattern("허가번호 제2024-0012호")
    assert not has_permit_pattern("그냥 광고 문구")


def test_inspect_without_easyocr_or_with_blank(monkeypatch):
    # Force OCR path to report unavailable
    import content.inspect as mod

    monkeypatch.setattr(mod, "_run_ocr", lambda crop: ("", False))
    img = np.zeros((120, 200, 3), dtype=np.uint8)
    img[:] = (40, 40, 40)
    out = inspect_banner_crop(img, [10, 10, 180, 100])
    assert out.content_verdict == "NEEDS_REVIEW"
    assert out.flags.get("ocr_available") is False
    assert out.crop_preview_base64


def test_inspect_banned_keyword_synthetic(monkeypatch):
    import content.inspect as mod

    monkeypatch.setattr(mod, "_run_ocr", lambda crop: ("저금리 대부 상담 지금 전화", True))
    monkeypatch.setattr(mod, "_detect_possible_stamp", lambda crop: False)
    img = np.zeros((120, 200, 3), dtype=np.uint8)
    out = inspect_banner_crop(img, [5, 5, 190, 110])
    assert out.content_verdict == "ILLEGAL_SUSPECT"
    assert "대부" in (out.flags.get("keyword_hits") or [])
