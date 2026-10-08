"""Table 2 thresholds. Every published band edge is pinned, including the gaps the table leaves."""

import pytest

from ai_drews.advisory.classification import (
    ENSO_IS_EXTREME,
    ENSO_PHASE,
    PDSI_DRY_CATEGORIES,
    enso_category,
    pdsi_category,
    pdsi_is_drought,
)
from ai_drews.advisory.rules import enso_state


class TestEnsoCategories:
    @pytest.mark.parametrize(
        ("nino34", "expected"),
        [
            (2.5, "High El Niño"),
            (1.01, "High El Niño"),
            (0.99, "Moderate El Niño"),
            (0.51, "Moderate El Niño"),
            (0.50, "Neutral"),
            (0.0, "Neutral"),
            (-0.50, "Neutral"),
            (-0.51, "Moderate La Niña"),
            (-0.99, "Moderate La Niña"),
            (-1.01, "High La Niña"),
            (-2.5, "High La Niña"),
        ],
    )
    def test_published_bands(self, nino34, expected):
        assert enso_category(nino34) == expected

    @pytest.mark.parametrize(("nino34", "expected"), [(1.0, "High El Niño"), (-1.0, "High La Niña")])
    def test_gaps_in_the_table_resolve_to_the_stronger_band(self, nino34, expected):
        """The table jumps from '0.51 to 0.99' to 'greater than 1', leaving 1.00 unassigned."""
        assert enso_category(nino34) == expected

    def test_every_category_maps_to_a_three_way_phase(self):
        for value in (-3, -1, -0.7, 0, 0.7, 1, 3):
            category = enso_category(value)
            assert ENSO_PHASE[category] in {"El Niño", "La Niña", "Neutral"}
            assert category in ENSO_IS_EXTREME

    def test_the_coarse_phase_still_agrees_with_the_platform_wide_one(self):
        """`enso_state` is what the advisory rules already used; the finer table must not contradict it."""
        for value in (-2.0, -1.0, -0.6, -0.5, 0.0, 0.5, 0.6, 1.0, 2.0):
            assert ENSO_PHASE[enso_category(value)] == enso_state(value)

    def test_only_the_high_bands_count_as_extreme(self):
        assert ENSO_IS_EXTREME[enso_category(1.5)]
        assert ENSO_IS_EXTREME[enso_category(-1.5)]
        assert not ENSO_IS_EXTREME[enso_category(0.7)]
        assert not ENSO_IS_EXTREME[enso_category(0.0)]


class TestPdsiCategories:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (4.5, "Extremely wet"),
            (3.01, "Extremely wet"),
            (3.0, "Very wet"),
            (2.0, "Very wet"),
            (1.99, "Moderately wet"),
            (1.01, "Moderately wet"),
            (1.0, "Normal"),
            (0.0, "Normal"),
            (-1.0, "Normal"),
            (-1.01, "Moderately dry"),
            (-1.99, "Moderately dry"),
            (-2.0, "Very dry"),
            (-3.0, "Very dry"),
            (-3.01, "Extremely dry"),
            (-6.0, "Extremely dry"),
        ],
    )
    def test_published_bands(self, value, expected):
        assert pdsi_category(value) == expected

    def test_the_scale_is_symmetric_about_normal(self):
        for magnitude in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5):
            dry, wet = pdsi_category(-magnitude), pdsi_category(magnitude)
            assert dry.replace("dry", "") == wet.replace("wet", ""), f"asymmetric at {magnitude}"

    def test_drought_flag_covers_exactly_the_three_dry_bands(self):
        assert not pdsi_is_drought(-1.0) and not pdsi_is_drought(0.0) and not pdsi_is_drought(2.0)
        assert pdsi_is_drought(-1.5) and pdsi_is_drought(-2.5) and pdsi_is_drought(-5.0)
        assert all(pdsi_category(v) in PDSI_DRY_CATEGORIES for v in (-1.2, -2.4, -9.0))
