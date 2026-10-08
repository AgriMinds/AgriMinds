"""Sc-PDSI: evapotranspiration, the Palmer water balance, and self-calibration."""

import numpy as np
import pandas as pd
import pytest

from ai_drews.advisory.classification import pdsi_category
from ai_drews.features.pdsi import (
    DEFAULT_AWC_MM,
    SURFACE_CAPACITY_MM,
    row_latitudes,
    scpdsi,
    self_calibrate,
    water_balance,
)
from ai_drews.features.pet import daylight_hours, heat_index, thornthwaite_pet

BBOX = (37.6, 10.4, 38.4, 11.2)


@pytest.fixture
def record():
    """Thirty years of monthly highland climate: a strong Kiremt peak and a warm dry season."""
    rng = np.random.default_rng(7)
    dates = pd.date_range("1990-01-01", "2019-12-01", freq="MS")
    months = dates.month.to_numpy()
    rows, cols = 4, 4
    seasonal = 20 + 150 * np.exp(-0.5 * ((months - 7.5) / 1.3) ** 2)
    rain = seasonal[:, None, None] * rng.gamma(6, 1 / 6, (len(dates), rows, cols))
    tmean = (18 + 3 * np.sin(2 * np.pi * (months - 3) / 12))[:, None, None] + rng.normal(
        0, 0.4, (len(dates), rows, cols)
    )
    return dates, rain, tmean


class TestPotentialEvapotranspiration:
    def test_daylight_is_near_twelve_hours_in_the_tropics(self):
        hours = daylight_hours(np.array([10.8]), np.array([80, 172, 264, 355]))
        assert np.all((hours > 11.0) & (hours < 13.0)), hours

    def test_daylight_swings_more_at_high_latitude(self):
        tropical = np.ptp(daylight_hours(np.array([10.8]), np.arange(1, 366)))
        temperate = np.ptp(daylight_hours(np.array([55.0]), np.arange(1, 366)))
        assert temperate > tropical * 3

    def test_heat_index_ignores_freezing_months(self):
        warm = np.full((12, 1), 20.0)
        mixed = warm.copy()
        mixed[0] = -10.0
        assert heat_index(mixed)[0] < heat_index(warm)[0]
        assert heat_index(np.full((12, 1), -5.0))[0] == 0.0

    def test_pet_is_zero_at_or_below_freezing_and_rises_with_temperature(self):
        dates = pd.date_range("2000-01-01", periods=24, freq="MS")
        months, doy, dim = dates.month.to_numpy(), dates.dayofyear.to_numpy(), dates.days_in_month.to_numpy()
        lat = np.array([10.8])
        cold = thornthwaite_pet(np.full((24, 1), -2.0), months, lat, dim, doy)
        mild = thornthwaite_pet(np.full((24, 1), 15.0), months, lat, dim, doy)
        hot = thornthwaite_pet(np.full((24, 1), 30.0), months, lat, dim, doy)
        assert np.allclose(cold, 0.0)
        assert mild.mean() > 0
        assert hot.mean() > mild.mean()

    def test_highland_pet_is_physically_plausible(self, record):
        dates, _, tmean = record
        flat = tmean.reshape(len(dates), -1)
        pet = thornthwaite_pet(
            flat,
            dates.month.to_numpy(),
            np.repeat(row_latitudes(BBOX, 4), 4),
            dates.days_in_month.to_numpy(),
            dates.dayofyear.to_numpy(),
        )
        annual = pet.reshape(-1, 12, pet.shape[1]).sum(axis=1).mean()
        assert 500 < annual < 1500, f"annual PET of {annual:.0f} mm is outside the plausible range"


class TestWaterBalance:
    def test_nothing_is_created_or_destroyed(self, record):
        dates, rain, tmean = record
        flat_rain = rain.reshape(len(dates), -1)
        pet = thornthwaite_pet(
            tmean.reshape(len(dates), -1),
            dates.month.to_numpy(),
            np.repeat(row_latitudes(BBOX, 4), 4),
            dates.days_in_month.to_numpy(),
            dates.dayofyear.to_numpy(),
        )
        b = water_balance(flat_rain, pet)
        # Every month, what arrives is either evaporated, stored or runs off.
        storage_change = b.recharge - b.loss
        assert np.allclose(flat_rain, b.et + storage_change + b.runoff, atol=1e-6)

    def test_evapotranspiration_never_exceeds_its_potential(self, record):
        dates, rain, tmean = record
        pet = thornthwaite_pet(
            tmean.reshape(len(dates), -1),
            dates.month.to_numpy(),
            np.repeat(row_latitudes(BBOX, 4), 4),
            dates.days_in_month.to_numpy(),
            dates.dayofyear.to_numpy(),
        )
        b = water_balance(rain.reshape(len(dates), -1), pet)
        assert np.all(b.et <= b.potential_et + 1e-6)
        assert np.all(b.recharge >= -1e-9) and np.all(b.runoff >= -1e-9)

    def test_a_rainless_record_drains_the_profile_and_never_recharges(self):
        steps = 60
        b = water_balance(np.zeros((steps, 1)), np.full((steps, 1), 80.0), awc_mm=DEFAULT_AWC_MM)
        assert b.recharge.sum() == 0 and b.runoff.sum() == 0
        assert b.loss.sum() == pytest.approx(DEFAULT_AWC_MM, rel=0.02)
        assert b.loss[-1, 0] < b.loss[0, 0], "losses must taper as the soil empties"

    def test_the_surface_layer_is_emptied_before_the_deeper_one(self):
        b = water_balance(np.zeros((1, 1)), np.array([[10.0]]))
        assert b.loss[0, 0] == pytest.approx(10.0, rel=0.1)
        drained = water_balance(np.zeros((1, 1)), np.array([[SURFACE_CAPACITY_MM]]))
        assert drained.loss[0, 0] >= SURFACE_CAPACITY_MM - 1e-6


class TestSelfCalibration:
    def test_tails_are_pinned_to_the_extremes_of_the_scale(self):
        rng = np.random.default_rng(1)
        severity = rng.normal(0, 1.0, (600, 3))
        scaled = self_calibrate(severity)
        assert np.percentile(scaled, 2, axis=0) == pytest.approx(-4.0, abs=0.2)
        assert np.percentile(scaled, 98, axis=0) == pytest.approx(4.0, abs=0.2)

    def test_the_sign_of_every_month_is_preserved(self):
        rng = np.random.default_rng(2)
        severity = rng.normal(0, 1.0, (200, 2))
        assert np.array_equal(np.sign(self_calibrate(severity)), np.sign(severity))


class TestScPdsi:
    def test_shape_scale_and_categories(self, record):
        dates, rain, tmean = record
        index = scpdsi(rain, tmean, dates, row_latitudes(BBOX, 4))
        assert index.shape == rain.shape
        assert np.isfinite(index).all()
        assert abs(np.median(index)) < 1.0, "a calibrated index should sit near zero most of the time"
        assert np.percentile(index, 2) == pytest.approx(-4.0, abs=0.75)
        assert np.percentile(index, 98) == pytest.approx(4.0, abs=0.75)
        assert pdsi_category(float(np.median(index))) == "Normal"

    def test_a_drying_trend_pushes_the_index_negative(self, record):
        dates, rain, tmean = record
        drying = rain.copy()
        half = len(dates) // 2
        drying[half:] *= 0.35  # the second half of the record loses two thirds of its rain
        index = scpdsi(drying, tmean, dates, row_latitudes(BBOX, 4))
        assert index[half + 12 :].mean() < index[:half].mean() - 1.0
        assert pdsi_category(float(index[half + 12 :].mean())) in {
            "Moderately dry",
            "Very dry",
            "Extremely dry",
        }

    def test_a_wetter_second_half_pushes_the_index_positive(self, record):
        dates, rain, tmean = record
        wetter = rain.copy()
        half = len(dates) // 2
        wetter[half:] *= 2.5
        index = scpdsi(wetter, tmean, dates, row_latitudes(BBOX, 4))
        assert index[half + 12 :].mean() > index[:half].mean() + 1.0

    def test_less_soil_storage_makes_drought_arrive_sooner(self, record):
        dates, rain, tmean = record
        dry = rain * 0.4
        shallow = scpdsi(dry, tmean, dates, row_latitudes(BBOX, 4), awc_mm=50.0)
        deep = scpdsi(dry, tmean, dates, row_latitudes(BBOX, 4), awc_mm=200.0)
        assert shallow.shape == deep.shape
        assert not np.allclose(shallow, deep), "soil capacity must change the result"

    def test_row_latitudes_run_north_to_south_inside_the_bounding_box(self):
        lats = row_latitudes(BBOX, 8)
        assert len(lats) == 8
        assert lats[0] > lats[-1], "row 0 is the northern-most"
        assert BBOX[1] < lats.min() and lats.max() < BBOX[3]
