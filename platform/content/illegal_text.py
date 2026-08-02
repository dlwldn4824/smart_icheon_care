"""Seed dictionaries and text rules for banner content illegality heuristics."""

from __future__ import annotations

import re
from typing import Iterable

# Seed banned / high-risk advertising phrases (MVP — not a full legal catalog)
BANNED_KEYWORDS: tuple[str, ...] = (
    "대부",
    "대출",
    "사채",
    "성인",
    "조건만남",
    "카지노",
    "바카라",
    "도박",
    "불법",
    "무허가",
    "강제철거",
    "전단지무단",
)

# Patterns that look like municipal permit / registration numbers
PERMIT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"제?\s*\d{2,4}\s*[-–]?\s*\d{2,6}\s*호"),
    re.compile(r"허가\s*번호"),
    re.compile(r"신고\s*번호"),
    re.compile(r"게시대\s*No\.?\s*\d+", re.IGNORECASE),
    re.compile(r"AD[-_]?\d{4,}", re.IGNORECASE),
)


def normalize_ocr_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def find_keyword_hits(text: str, keywords: Iterable[str] = BANNED_KEYWORDS) -> list[str]:
    t = text or ""
    hits: list[str] = []
    for kw in keywords:
        if kw and kw in t:
            hits.append(kw)
    return hits


def has_permit_pattern(text: str) -> bool:
    t = text or ""
    return any(p.search(t) for p in PERMIT_PATTERNS)


def permit_text_overlap(ocr_text: str, permit_phrases: Iterable[str]) -> list[str]:
    """Return permit DB phrases that partially appear in OCR text."""
    t = (ocr_text or "").replace(" ", "")
    if not t:
        return []
    matched: list[str] = []
    for phrase in permit_phrases:
        p = (phrase or "").replace(" ", "").strip()
        if len(p) >= 2 and p in t:
            matched.append(phrase)
    return matched
