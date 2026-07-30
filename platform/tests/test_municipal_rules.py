"""Rule-based municipal risk / priority tests."""

from priority.priority_engine import MunicipalPriorityEngine
from risk.risk_engine import MunicipalRiskEngine, RuleRiskInputs


def test_rule_risk_additive_max():
    eng = MunicipalRiskEngine()
    r = eng.calculate(
        RuleRiskInputs(
            complaint_hotspot=True,
            school_zone=True,
            high_population=True,
            no_permission=True,
            far_from_legal_board=True,
        )
    )
    assert r.score == 100.0
    assert abs(sum(r.risk_breakdown.values()) - 100.0) < 1e-6
    assert any("민원" in x for x in r.reasons)
    assert "허가" in r.priority_reason


def test_priority_bands():
    eng = MunicipalPriorityEngine()
    assert eng.calculate(95).priority == "Critical"
    assert eng.calculate(75).priority == "High"
    assert eng.calculate(50).priority == "Medium"
    assert eng.calculate(10).priority == "Low"
    assert eng.calculate(95).recommended_action.startswith("24시간")


def test_demo_fixture_geo_risk():
    from geospatial.repository import PublicDataRepository

    repo = PublicDataRepository("fixtures/demo_public_data")
    geo = repo.build_context("DEMO-CCTV-001")
    rule = MunicipalRiskEngine().from_geo(geo)
    band = MunicipalPriorityEngine().calculate(rule.score, priority_reason=rule.priority_reason)
    assert rule.score >= 80
    assert band.priority in {"High", "Critical"}
    assert rule.risk_breakdown["school_zone"] > 0
    assert rule.risk_breakdown["no_permission"] > 0
