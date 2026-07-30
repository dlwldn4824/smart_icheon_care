from priority.engine import PriorityEngine, PriorityInputs


def test_priority_fixed_inputs():
    engine = PriorityEngine()
    result = engine.calculate(
        PriorityInputs(
            illegal_likelihood=0.91,
            safety_risk=0.8,
            vulnerable_zone=1.0,
            complaint_frequency=0.6,
            pedestrian_volume=0.75,
            detection_duration=0.5,
        )
    )
    expected = round(
        0.35 * 0.91 + 0.25 * 0.8 + 0.15 * 1.0 + 0.10 * 0.6 + 0.10 * 0.75 + 0.05 * 0.5,
        4,
    )
    assert result.score == expected
    assert result.level == "P1"
