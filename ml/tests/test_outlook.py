"""Forecast skill gating and the seasonal outlook that replaces an unskilful probability."""

from __future__ import annotations

import pytest

from ai_drews.advisory.classification import (
    MIN_SKILFUL_BSS,
    horizon_kind,
    is_skilful,
    skilful_leads,
)
from ai_drews.advisory.outlook import (
    MIN_ENSO_ANOMALY,
    SeasonalOutlook,
    seasonal_outlook,
)

# Measured on the committed model: skill is gone by lead 3.
MEASURED = [
    {"lead": 1, "BSS_vs_climatology": 0.218},
    {"lead": 2, "BSS_vs_climatology": 0.125},
    {"lead": 3, "BSS_vs_climatology": -0.002},
    {"lead": 4, "BSS_vs_climatology": -0.051},
]


class TestSkillGating:
    def test_a_lead_that_ties_climatology_is_not_published_as_a_forecast(self):
        """Quoting the long-run average is not a forecast, however it is dressed up."""
        assert is_skilful(0.0) is False
        assert is_skilful(-0.002) is False

    def test_a_lead_must_clear_the_margin_not_merely_the_line(self):
        assert is_skilful(MIN_SKILFUL_BSS - 0.001) is False
        assert is_skilful(MIN_SKILFUL_BSS) is True

    def test_a_missing_measurement_is_not_skill(self):
        assert is_skilful(None) is False

    def test_the_measured_model_publishes_only_its_first_two_leads(self):
        assert skilful_leads(MEASURED) == [1, 2]

    def test_each_lead_is_judged_on_its_own_measurement(self):
        """Skill need not decay monotonically on a short record; truncating would hide that."""
        patchy = [
            {"lead": 1, "BSS_vs_climatology": 0.22},
            {"lead": 2, "BSS_vs_climatology": -0.01},
            {"lead": 3, "BSS_vs_climatology": 0.08},
        ]
        assert skilful_leads(patchy) == [1, 3]

    def test_an_unskilful_lead_is_served_as_an_outlook(self):
        assert horizon_kind(1, MEASURED) == "forecast"
        assert horizon_kind(3, MEASURED) == "outlook"
        assert horizon_kind(12, MEASURED) == "outlook"


class TestSeasonalOutlook:
    def test_el_nino_leans_the_season_drier_where_the_record_says_so(self):
        outlook = seasonal_outlook(7, "2027-05-01", 2.1, -0.62)
        assert outlook.direction == "drier"
        assert outlook.is_drought_leaning and not outlook.is_flood_leaning
        assert "High El Niño" in outlook.basis

    def test_la_nina_leans_the_other_way(self):
        outlook = seasonal_outlook(7, "2027-05-01", -1.4, -0.62)
        assert outlook.direction == "wetter"
        assert outlook.is_flood_leaning

    def test_the_direction_follows_the_data_not_an_assumption(self):
        """A record where the correlation is positive must flip the lean, not report a wrong one."""
        assert seasonal_outlook(5, "2027-03-01", 2.0, +0.62).direction == "wetter"
        assert seasonal_outlook(5, "2027-03-01", 2.0, -0.62).direction == "drier"

    def test_a_neutral_pacific_says_nothing(self):
        outlook = seasonal_outlook(4, "2027-02-01", MIN_ENSO_ANOMALY - 0.01, -0.7)
        assert outlook.direction == "near normal"
        assert outlook.confidence == "low"

    def test_a_weak_teleconnection_is_not_leaned_on(self):
        outlook = seasonal_outlook(9, "2027-07-01", 2.1, -0.08)
        assert outlook.direction == "near normal"
        assert "too weakly" in outlook.basis

    def test_a_missing_signal_is_admitted_rather_than_guessed(self):
        outlook = seasonal_outlook(12, "2027-10-01", None, -0.6)
        assert outlook.direction == "near normal"
        assert outlook.enso_anomaly is None
        assert "No ENSO signal" in outlook.basis

    def test_an_outlook_is_never_more_than_moderately_confident(self):
        """It has not been scored against climatology, so it must not sound like a forecast."""
        strongest = seasonal_outlook(1, "2026-07-01", 3.0, -0.99)
        assert strongest.confidence == "moderate"

    def test_a_carried_forward_enso_value_lowers_the_confidence_and_says_so(self):
        outlook = seasonal_outlook(11, "2027-09-01", 2.1, -0.62, enso_is_forecast=False)
        assert outlook.confidence == "low"
        assert "carried forward" in outlook.basis

    def test_an_outlook_never_carries_a_probability(self):
        """The whole point of the split: an outlook leans, it does not quantify."""
        payload = seasonal_outlook(8, "2027-06-01", 2.1, -0.62).to_dict()
        assert not any("prob" in key for key in payload)
        assert isinstance(SeasonalOutlook(**payload), SeasonalOutlook)


@pytest.mark.parametrize("lead", range(1, 13))
def test_every_lead_in_the_year_produces_an_outlook(lead):
    outlook = seasonal_outlook(lead, "2027-01-01", 1.2, -0.5)
    assert outlook.lead_month == lead
    assert outlook.direction in {"drier", "near normal", "wetter"}
