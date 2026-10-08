"""The ENSO / drought correlation behind Fig. 5."""

import numpy as np
import pytest

from ai_drews.analysis.teleconnection import enso_drought_correlation


def test_a_perfect_inverse_relationship_is_detected_at_lag_zero():
    rng = np.random.default_rng(0)
    nino = rng.normal(0, 1, 300)
    result = enso_drought_correlation(nino, -nino, max_lag_months=3)
    assert result.correlation_at_lag_0 == pytest.approx(-1.0, abs=1e-6)
    assert result.best_lag_months == 0


def test_a_delayed_response_is_found_at_the_right_lag():
    rng = np.random.default_rng(1)
    nino = rng.normal(0, 1, 400)
    drought = np.zeros_like(nino)
    drought[4:] = -nino[:-4]  # the land responds four months after the ocean
    result = enso_drought_correlation(nino, drought, max_lag_months=9)
    assert result.best_lag_months == 4
    assert abs(result.best_correlation) > 0.95


def test_a_gridded_index_is_averaged_over_the_basin_first():
    rng = np.random.default_rng(2)
    nino = rng.normal(0, 1, 120)
    grid = np.repeat(np.repeat((-nino)[:, None, None], 3, 1), 3, 2)
    result = enso_drought_correlation(nino, grid, max_lag_months=2)
    assert result.months == 120
    assert result.correlation_at_lag_0 == pytest.approx(-1.0, abs=1e-6)


def test_unrelated_series_report_a_weak_correlation():
    rng = np.random.default_rng(3)
    result = enso_drought_correlation(rng.normal(0, 1, 500), rng.normal(0, 1, 500), max_lag_months=6)
    assert abs(result.correlation_at_lag_0) < 0.2


def test_mismatched_lengths_are_rejected():
    with pytest.raises(ValueError, match="series lengths differ"):
        enso_drought_correlation(np.zeros(10), np.zeros(11))


def test_a_constant_series_yields_no_correlation_rather_than_an_error():
    result = enso_drought_correlation(np.zeros(50), np.arange(50.0), max_lag_months=2)
    assert np.isnan(result.correlation_at_lag_0)


def test_the_result_states_that_the_published_value_is_not_reproduced():
    result = enso_drought_correlation(np.arange(50.0), np.arange(50.0), max_lag_months=1)
    assert "0.79" in result.note and "real" in result.note
    assert set(result.to_frame().columns) == {"lag_months", "correlation", "index", "months"}
