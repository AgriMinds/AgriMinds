"""Reading CMIP6 projections and turning them into a long-horizon drought outlook."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest

from ai_drews.analysis.scenario import scenario_outlook
from ai_drews.data.cmip6 import SECONDS_PER_DAY, load_projection

xr = pytest.importorskip("xarray")

BBOX = (35.5, 8.5, 40.5, 13.5)  # Amhara, the smallest area a ~2.8 deg grid can speak to


def _write_projection(
    path: Path, years: int = 56, rain_trend_per_year: float = 0.0, warming_per_year: float = 0.0
) -> Path:
    """A minimal CMIP6-shaped file: monthly, pressure-level temperature, NoLeap calendar."""
    import cftime

    months = years * 12
    time = [cftime.DatetimeNoLeap(2015 + i // 12, i % 12 + 1, 16) for i in range(months)]
    lon = np.array([33.75, 36.5625, 39.375, 42.1875])
    lat = np.array([6.977, 9.767, 12.558])
    plev = np.array([100000.0, 85000.0, 70000.0, 50000.0])

    month_of = np.array([t.month for t in time])
    year_index = np.arange(months) / 12.0
    seasonal = 1.0 + 4.0 * np.exp(-0.5 * ((month_of - 7.5) / 1.5) ** 2)  # mm/day, Kiremt peak
    # Real climate varies from year to year; without that there is no spread to calibrate
    # a drought index against, and the test would be measuring numerical noise.
    rng = np.random.default_rng(11)
    wobble = rng.gamma(9.0, 1 / 9.0, months)
    rain = ((seasonal * wobble) + rain_trend_per_year * year_index)[:, None, None] * np.ones(
        (1, len(lat), len(lon))
    )
    pr = rain / SECONDS_PER_DAY  # back to kg m-2 s-1

    base_t = 287.0 + 3.0 * np.sin(2 * np.pi * (month_of - 3) / 12) + rng.normal(0, 0.3, months)
    ta = np.zeros((months, len(plev), len(lat), len(lon)))
    for k, p in enumerate(plev):
        # roughly 6.5 K per km, with 1000 hPa near sea level and 700 hPa near 3000 m
        offset = {100000.0: 20.0, 85000.0: 10.0, 70000.0: 0.0, 50000.0: -18.0}[p]
        ta[:, k] = (base_t + offset + warming_per_year * year_index)[:, None, None]

    ds = xr.Dataset(
        {
            "pr": (("time", "lat", "lon"), pr),
            "ta": (("time", "plev", "lat", "lon"), ta),
            "clt": (("time", "lat", "lon"), np.full((months, len(lat), len(lon)), 45.0)),
        },
        coords={"time": time, "lon": lon, "lat": lat, "plev": plev},
        attrs={
            "source_id": "TestESM",
            "experiment_id": "ssp585",
            "variant_label": "r1i1p1f1",
            "frequency": "mon",
        },
    )
    ds.to_netcdf(path)
    return path


@pytest.fixture
def projection_file(tmp_path):
    return _write_projection(tmp_path / "proj.nc")


class TestLoader:
    def test_units_and_geometry(self, projection_file):
        p = load_projection(projection_file, BBOX)
        assert p.is_projection, "a scenario run must always be flagged as such"
        assert p.label == "TestESM ssp585 (r1i1p1f1)"
        assert len(p.dates) == len(p.precip_mm) == len(p.tmean_c)
        assert p.dates[0].year == 2015 and p.dates[0].day == 1
        # Monthly totals, not fluxes: a Kiremt month must be far wetter than a dry-season one.
        july = p.precip_mm[p.dates.month == 7].mean()
        january = p.precip_mm[p.dates.month == 1].mean()
        assert july > january * 3
        assert 300 < p.precip_mm.sum() / (len(p.dates) / 12) < 3000, "annual total is implausible"

    def test_the_highland_pressure_level_is_chosen_not_sea_level(self, projection_file):
        highland = load_projection(projection_file, BBOX)
        assert highland.pressure_level_pa == 70000.0
        sea_level = load_projection(projection_file, BBOX, pressure_level_pa=100000.0)
        assert sea_level.tmean_c.mean() > highland.tmean_c.mean() + 15, (
            "the 1000 hPa level is a sea-level value and must not be used for a 3000 m watershed"
        )

    def test_footprint_reports_when_the_grid_cannot_resolve_the_request(self, projection_file):
        watershed = (37.6, 10.4, 38.4, 11.2)  # the Choke box: smaller than one cell
        p = load_projection(projection_file, watershed)
        assert not p.footprint.resolves_request
        warning = p.footprint.warning()
        assert warning and "does not resolve" not in warning
        assert "nearest" in warning and "not the requested area" in warning

    def test_footprint_is_silent_when_the_grid_does_resolve_the_request(self, projection_file):
        p = load_projection(projection_file, BBOX)
        assert p.footprint.resolves_request
        assert p.footprint.warning() is None
        assert p.footprint.cell_count >= 4

    def test_a_region_outside_the_file_is_refused(self, projection_file):
        with pytest.raises(ValueError, match="does not cover"):
            load_projection(projection_file, (-10.0, -40.0, -5.0, -35.0))

    def test_provenance_records_what_it_came_from(self, projection_file):
        prov = load_projection(projection_file, BBOX).provenance()
        assert prov["experiment_id"] == "ssp585"
        assert prov["is_projection"] is True
        assert prov["months"] == 56 * 12
        assert "footprint" in prov


class TestScenarioOutlook:
    def test_a_drying_pathway_is_detected_and_classified(self, tmp_path):
        p = load_projection(_write_projection(tmp_path / "dry.nc", rain_trend_per_year=-0.035), BBOX)
        outlook, frame = scenario_outlook(p, latitude_deg=10.8)
        assert outlook.change_per_decade < 0, outlook.summary()
        assert outlook.trend_is_significant
        assert outlook.final_decade_months_in_drought_pct > outlook.baseline_months_in_drought_pct
        assert len(frame) == len(p.dates)
        assert set(frame.columns) >= {"date", "precip_mm", "tmean_c", "scpdsi", "category", "in_drought"}

    def test_a_wetting_pathway_moves_the_other_way(self, tmp_path):
        p = load_projection(_write_projection(tmp_path / "wet.nc", rain_trend_per_year=0.035), BBOX)
        outlook, _ = scenario_outlook(p, latitude_deg=10.8)
        assert outlook.change_per_decade > 0
        assert outlook.final_decade_months_in_drought_pct <= outlook.baseline_months_in_drought_pct

    def test_a_stable_climate_shows_no_meaningful_trend(self, projection_file):
        outlook, _ = scenario_outlook(load_projection(projection_file, BBOX), latitude_deg=10.8)
        assert abs(outlook.change_per_decade) < 0.3, outlook.summary()

    def test_warming_is_measured_from_the_temperature_field(self, tmp_path):
        p = load_projection(_write_projection(tmp_path / "warm.nc", warming_per_year=0.05), BBOX)
        outlook, _ = scenario_outlook(p, latitude_deg=10.8)
        assert outlook.warming_c_per_decade == pytest.approx(0.5, abs=0.05)

    def test_the_result_never_presents_itself_as_a_forecast(self, projection_file):
        outlook, _ = scenario_outlook(load_projection(projection_file, BBOX), latitude_deg=10.8)
        assert "not a forecast" in outlook.caveat
        assert outlook.provenance["is_projection"] is True

    def test_a_short_record_is_refused_rather_than_fitted(self, tmp_path):
        p = load_projection(_write_projection(tmp_path / "short.nc", years=10), BBOX)
        with pytest.raises(ValueError, match="at least 20 years"):
            scenario_outlook(p, latitude_deg=10.8)


REAL_FILE = Path(
    os.environ.get("AI_DREWS_SCENARIO_NC", "/home/eibrahim/Downloads/Telegram Desktop/out2015-2070.nc")
)


@pytest.mark.skipif(not REAL_FILE.exists(), reason="the CanESM5 projection is not on this machine")
class TestSuppliedProjection:
    """Guards the specific file this feature was built against."""

    def test_it_loads_and_is_what_it_claims_to_be(self):
        p = load_projection(REAL_FILE, BBOX)
        assert (p.source_id, p.experiment_id) == ("CanESM5-CanOE", "ssp585")
        assert p.dates[0].year == 2015 and p.dates[-1].year == 2070
        assert p.is_projection

    def test_its_grid_cannot_resolve_the_choke_watershed(self):
        p = load_projection(REAL_FILE, (37.6, 10.4, 38.4, 11.2))
        assert not p.footprint.resolves_request
        assert p.footprint.cell_size_deg[0] > 2.0, "a ~2.8 deg cell dwarfs an 88 km watershed"

    def test_the_outlook_is_computable_and_carries_its_caveats(self):
        outlook, frame = scenario_outlook(load_projection(REAL_FILE, BBOX), latitude_deg=10.8)
        assert outlook.months == 672
        assert np.isfinite(outlook.change_per_decade)
        assert outlook.warming_c_per_decade > 0, "SSP5-8.5 must warm"
        assert outlook.provenance["is_projection"] is True
