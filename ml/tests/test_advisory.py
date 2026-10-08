import pytest

from ai_drews.advisory import CROPS, advise, enso_state, risk_level, season_name


@pytest.mark.parametrize(
    ("p", "level"),
    [
        (0.0, "Low"),
        (0.249, "Low"),
        (0.25, "Moderate"),
        (0.449, "Moderate"),
        (0.45, "High"),
        (0.65, "Severe"),
        (1.0, "Severe"),
    ],
)
def test_risk_level_boundaries(p, level):
    assert risk_level(p) == level


@pytest.mark.parametrize(
    ("nino", "state"),
    [
        (0.6, "El Niño"),
        (1.5, "El Niño"),
        (-0.6, "La Niña"),
        (-1.5, "La Niña"),
        (0.0, "Neutral"),
        (0.49, "Neutral"),
        # Table 2 of the study puts exactly +/-0.50 in the Neutral band. NOAA's ONI convention
        # would call these a phase. The table governs here so that the coarse phase and the
        # five-way category can never disagree; see advisory/classification.py.
        (0.5, "Neutral"),
        (-0.5, "Neutral"),
    ],
)
def test_enso_state(nino, state):
    assert enso_state(nino) == state


def test_seasons():
    assert season_name(7).startswith("Kiremt")
    assert season_name(3).startswith("Belg")
    assert season_name(12).startswith("Bega")
    assert season_name(1).startswith("Bega")


def test_maize_is_more_sensitive_than_tef():
    tef = advise(0.4, 1, "tef", 7)
    maize = advise(0.4, 1, "maize", 7)
    assert maize.adjusted_probability > tef.adjusted_probability
    assert tef.risk_level == "Moderate"
    assert maize.risk_level == "High"


def test_adjusted_probability_is_capped():
    assert advise(0.95, 1, "maize", 7).adjusted_probability == 1.0


def test_iek_changes_confidence_not_probability():
    base = advise(0.3, 2, "wheat", 8, iek_agrees=None)
    agree = advise(0.3, 2, "wheat", 8, iek_agrees=True)
    assert base.adjusted_probability == agree.adjusted_probability
    assert agree.confidence_level.startswith("HIGH")
    assert base.confidence_level.startswith("STANDARD")


def test_unknown_crop_rejected():
    with pytest.raises(ValueError):
        advise(0.3, 1, "barley", 7)


def test_all_crops_have_profiles():
    for crop in ("tef", "wheat", "maize"):
        assert crop in CROPS
        assert advise(0.1, 1, crop, 7).to_dict()["crop"] == crop
