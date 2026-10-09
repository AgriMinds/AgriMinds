"""Wind components: the conversion, and why it is done hourly."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ai_drews.ingest.wind import components, monthly_components

MS = 1 / 3.6


class TestComponents:
    @pytest.mark.parametrize(
        ("bearing", "expected_u", "expected_v"),
        [
            (0, 0.0, -10.0),  # from the north -> blows southward
            (90, -10.0, 0.0),  # from the east  -> blows westward
            (180, 0.0, 10.0),  # from the south -> blows northward
            (270, 10.0, 0.0),  # from the west  -> blows eastward
        ],
    )
    def test_the_meteorological_convention_is_direction_the_wind_comes_from(
        self, bearing, expected_u, expected_v
    ):
        u, v = components(np.array([36.0]), np.array([bearing]))
        assert u[0] == pytest.approx(expected_u, abs=1e-9)
        assert v[0] == pytest.approx(expected_v, abs=1e-9)

    def test_the_magnitude_is_preserved_and_converted_to_metres_per_second(self):
        u, v = components(np.array([36.0]), np.array([217.0]))
        assert float(np.hypot(u, v)[0]) == pytest.approx(10.0)

    def test_calm_is_calm_in_any_direction(self):
        u, v = components(np.zeros(4), np.array([0.0, 90.0, 180.0, 270.0]))
        assert np.allclose(u, 0.0) and np.allclose(v, 0.0)


def _hourly(speeds_kmh, bearings, start="2020-06-01"):
    times = pd.date_range(start, periods=len(speeds_kmh), freq="h")
    return pd.DataFrame({"time": times, "wind_speed_10m": speeds_kmh, "wind_direction_10m": bearings})


class TestMonthlyAggregation:
    def test_a_steady_wind_keeps_its_speed(self):
        hours = 24 * 30
        monthly = monthly_components(_hourly([36.0] * hours, [270.0] * hours))
        assert monthly["u10"].iloc[0] == pytest.approx(10.0, abs=1e-6)
        assert monthly["wind_speed"].iloc[0] == pytest.approx(10.0, abs=1e-6)
        assert monthly["wind_constancy"].iloc[0] == pytest.approx(1.0, abs=1e-6)

    def test_a_reversing_wind_has_a_near_zero_vector_mean_but_a_real_speed(self):
        """This is the whole reason the download is hourly. A scalar mean speed with a dominant
        direction would report a strong steady wind where there is none."""
        hours = 24 * 30
        bearings = [90.0 if h % 2 == 0 else 270.0 for h in range(hours)]
        monthly = monthly_components(_hourly([36.0] * hours, bearings))

        assert monthly["u10"].iloc[0] == pytest.approx(0.0, abs=1e-6)
        assert monthly["wind_speed"].iloc[0] == pytest.approx(10.0, abs=1e-6)
        assert monthly["wind_constancy"].iloc[0] == pytest.approx(0.0, abs=1e-6)

    def test_constancy_separates_a_steady_month_from_a_reversing_one(self):
        hours = 24 * 30
        steady = monthly_components(_hourly([36.0] * hours, [180.0] * hours))
        mixed = monthly_components(_hourly([36.0] * hours, [180.0 if h % 4 else 0.0 for h in range(hours)]))
        assert steady["wind_constancy"].iloc[0] > mixed["wind_constancy"].iloc[0]

    def test_constancy_never_leaves_its_bounds(self):
        rng = np.random.default_rng(0)
        hours = 24 * 28
        monthly = monthly_components(_hourly(rng.uniform(0, 50, hours), rng.uniform(0, 360, hours)))
        assert 0.0 <= float(monthly["wind_constancy"].iloc[0]) <= 1.0

    def test_months_are_separated(self):
        hours = 24 * 62
        monthly = monthly_components(_hourly([36.0] * hours, [270.0] * hours, start="2020-06-01"))
        assert len(monthly) >= 2

    def test_missing_hours_are_dropped_rather_than_read_as_calm(self):
        """A null hour is an unobserved hour. Treating it as zero wind would bias every month
        with a gap towards calm."""
        frame = _hourly([36.0, None, 36.0, 36.0], [270.0, 270.0, None, 270.0])
        monthly = monthly_components(frame)
        assert monthly["wind_speed"].iloc[0] == pytest.approx(10.0, abs=1e-6)

    def test_an_empty_record_is_refused_rather_than_averaged(self):
        from ai_drews.ingest.base import IngestError

        with pytest.raises(IngestError):
            monthly_components(_hourly([None, None], [None, None]))


class TestWindowAlignment:
    def test_extending_the_record_backwards_keeps_the_existing_windows(self):
        """The cache keys on these dates. A shifting boundary would silently invalidate every
        part already downloaded — hours of refetching on a rate-limited archive."""
        from ai_drews.ingest.era5 import decade_windows

        later = decade_windows("2000-01-01", "2026-06-01")
        earlier = decade_windows("1994-01-01", "2026-06-01")
        assert later == earlier[1:]
        assert earlier[0] == ("1994-01-01", "1999-12-31")
