"""The wet half of the Palmer index, which drives the flood warning."""

from __future__ import annotations

import pytest

from ai_drews.advisory.classification import PDSI_DRY_CATEGORIES, pdsi_category
from ai_drews.advisory.flood import (
    CROP_WATERLOGGING,
    assess_flood,
    flood_level,
    is_flood_risk,
)
from ai_drews.advisory.rules import CROPS


class TestFloodLevel:
    @pytest.mark.parametrize(
        ("pdsi", "expected"),
        [
            (-4.0, "None"),
            (-2.5, "None"),
            (-1.5, "None"),
            (0.0, "None"),
            (1.0, "None"),  # the band edge belongs to Normal
            (1.5, "Watch"),
            (2.0, "Warning"),
            (3.0, "Warning"),
            (3.5, "Severe"),
        ],
    )
    def test_the_level_follows_the_published_bands(self, pdsi, expected):
        assert flood_level(pdsi) == expected

    def test_no_dry_condition_ever_raises_a_flood_warning(self):
        for pdsi in (-5.0, -3.0, -2.0, -1.5, -1.01):
            assert pdsi_category(pdsi) in PDSI_DRY_CATEGORIES
            assert flood_level(pdsi) == "None"
            assert is_flood_risk(pdsi) is False

    def test_the_two_warnings_can_never_fire_at_once(self):
        """A plot is either drying out or drowning; the same index decides both."""
        from ai_drews.advisory.classification import pdsi_is_drought

        for pdsi in [v / 10 for v in range(-50, 51)]:
            assert not (pdsi_is_drought(pdsi) and is_flood_risk(pdsi))


class TestFloodAdvisory:
    def test_a_normal_plot_is_told_to_do_nothing(self):
        advisory = assess_flood(0.2, "tef")
        assert advisory.level == "None"
        assert not advisory.is_actionable
        assert "No action needed" in advisory.drainage_action

    def test_a_saturated_plot_gets_drainage_and_timing_advice(self):
        advisory = assess_flood(2.6, "wheat")
        assert advisory.level == "Warning"
        assert advisory.is_actionable
        assert "drainage furrows" in advisory.drainage_action
        assert advisory.timing_action != "No change to your plans."

    def test_it_says_this_is_soil_water_and_not_a_river(self):
        """Sc-PDSI cannot see a river, and the advice must not imply that it can."""
        advisory = assess_flood(3.9, "maize")
        assert "not a reading from a river gauge" in advisory.basis
        assert "river" not in advisory.headline.lower()

    def test_kiremt_is_called_out_when_a_warning_is_live(self):
        assert "Kiremt" in assess_flood(2.6, "tef", target_month=7).headline
        assert "Kiremt" not in assess_flood(2.6, "tef", target_month=1).headline

    def test_a_quiet_month_is_not_dressed_up_with_the_season(self):
        assert "Kiremt" not in assess_flood(0.0, "tef", target_month=7).headline

    def test_waterlogging_tolerance_is_not_the_drought_ranking_reversed_by_accident(self):
        """Maize is the most drought-sensitive crop and the most waterlogging-tolerant. Reusing
        the drought multiplier here would give precisely the wrong advice."""
        assert CROPS["maize"].sensitivity > CROPS["tef"].sensitivity
        assert CROP_WATERLOGGING["maize"].tolerance == "moderate"
        assert CROP_WATERLOGGING["tef"].tolerance == "low"

    def test_every_crop_the_platform_advises_on_has_a_waterlogging_profile(self):
        assert set(CROP_WATERLOGGING) == set(CROPS)

    def test_an_unknown_crop_is_refused_rather_than_guessed(self):
        with pytest.raises(ValueError, match="unknown crop"):
            assess_flood(2.5, "barley")

    def test_the_advisory_round_trips(self):
        payload = assess_flood(2.2, "tef", target_month=8).to_dict()
        assert payload["level"] == "Warning"
        assert payload["rules_version"].startswith("flood-")
