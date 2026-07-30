from risk.engine import IllegalInputs, RiskEngine


def test_illegal_likelihood_fixed_inputs():
    engine = RiskEngine()
    result = engine.calculate(
        IllegalInputs(
            permit_mismatch=1.0,
            non_designated_location=1.0,
            expired_period=1.0,
            detection_persistence=0.5,
            complaint_history=0.6,
            location_uncertain=False,
            permit_data_missing=False,
        )
    )
    assert result.score == 0.91
    assert result.level == "HIGH"
    assert result.requires_human_review is True
    assert any("허가" in r for r in result.reasons)


def test_review_required_when_permit_missing():
    engine = RiskEngine()
    result = engine.calculate(
        IllegalInputs(
            permit_mismatch=None,
            non_designated_location=None,
            expired_period=None,
            detection_persistence=0.2,
            complaint_history=0.0,
            location_uncertain=False,
            permit_data_missing=True,
        )
    )
    assert result.level == "REVIEW_REQUIRED"
    assert result.requires_human_review is True
