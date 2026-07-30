#!/usr/bin/env python3
"""Deterministic Risk/Priority smoke test (no GPU, no random)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from geospatial.repository import PublicDataRepository
from priority.engine import PRIORITY_LABELS, PriorityEngine, PriorityInputs
from risk.engine import IllegalInputs, RiskEngine


def main() -> None:
    repo = PublicDataRepository()
    geo = repo.build_context("CCTV-001")
    risk = RiskEngine()
    priority = PriorityEngine()
    illegal = risk.calculate(
        IllegalInputs(
            permit_mismatch=geo.permit_mismatch,
            non_designated_location=geo.non_designated_location,
            expired_period=geo.expired_period,
            detection_persistence=0.7,
            complaint_history=geo.complaint_norm,
            location_uncertain=geo.location_uncertain,
            permit_data_missing=geo.permit_data_missing,
        )
    )
    pri = priority.calculate(
        PriorityInputs(
            illegal_likelihood=illegal.score,
            safety_risk=geo.safety_risk,
            vulnerable_zone=geo.vulnerable_norm,
            complaint_frequency=geo.complaint_norm,
            pedestrian_volume=geo.pedestrian_norm,
            detection_duration=0.7,
        )
    )
    print(
        json.dumps(
            {
                "illegal": illegal.to_dict(),
                "priority": {**pri.to_dict(), "label": PRIORITY_LABELS[pri.level]},
                "geo_notes": geo.notes,
                "note": "Human-in-the-loop: requires_human_review is always true",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
