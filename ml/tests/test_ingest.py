"""Connector parsing and assembly, without touching the network."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from ai_drews.config import DataPaths, PipelineConfig
from ai_drews.ingest import build, nino34
from ai_drews.ingest.base import IngestError, Manifest, read_manifest, read_manifests, write_manifest

PSL_TABLE = """  1950        1952
 1950    -1.41   -1.47   -1.07   -1.25   -1.35   -1.03   -0.80   -0.92   -1.27   -0.91   -1.29   -1.05
 1951    -0.80   -0.52   -0.03    0.21    0.37    0.65    0.84    0.88    0.98    1.09    0.95    0.75
 1952     0.44    0.21    0.26    0.33  -99.99  -99.99  -99.99  -99.99  -99.99  -99.99  -99.99  -99.99
  -99.99
 ERSST V6
 Anomaly from 1981-2010
"""


def test_psl_table_is_parsed_month_by_month():
    series = nino34.parse_psl_table(PSL_TABLE)
    assert series.index[0] == pd.Timestamp("1950-01-01")
    assert series.loc["1951-09-01"] == pytest.approx(0.98)


def test_psl_padding_is_not_read_as_an_anomaly():
    """The current year is padded with the missing marker; -99.99 degC is not a cold event."""
    series = nino34.parse_psl_table(PSL_TABLE)
    assert series.index[-1] == pd.Timestamp("1952-04-01")
    assert series.min() > -5.0
    assert len(series) == 28  # 12 + 12 + 4 real months


def test_a_table_without_rows_is_rejected():
    with pytest.raises(IngestError):
        nino34.parse_psl_table("  1950        1952\n")


def _manifest(key: str = "era5", records: int = 3) -> Manifest:
    return Manifest.now(
        key=key,
        provider="Test provider",
        source_url="https://example.invalid/data",
        citation="Test citation",
        records=records,
        coverage=("2020-01-01", "2020-03-01"),
        variables=("rain",),
        notes="note",
    )


def test_a_manifest_survives_a_round_trip(tmp_path):
    paths = DataPaths(tmp_path)
    written = _manifest()
    write_manifest(paths, written)
    assert read_manifest(paths, "era5") == written
    assert read_manifests(paths) == {"era5": written}


def test_an_unreadable_manifest_is_treated_as_no_manifest(tmp_path):
    """Corrupt provenance must mean 'unknown', never 'real'."""
    paths = DataPaths(tmp_path)
    write_manifest(paths, _manifest())
    (tmp_path / "raw" / "manifests" / "era5.json").write_text("{ not json")
    assert read_manifest(paths, "era5") is None
    assert read_manifests(paths) == {}


def _write_sources(tmp_path, cfg: PipelineConfig, months: list[str], *, ndvi_months=None):
    paths = DataPaths(tmp_path).ensure()
    sources = tmp_path / "raw" / "sources"
    sources.mkdir(parents=True, exist_ok=True)

    rows = [
        {
            "date": m,
            "row": r,
            "col": c,
            "lat": 11.0,
            "lon": 38.0,
            "rain": 50.0 + r,
            "tmax": 28.0,
            "tmean": 20.0,
            "soilm": 0.2,
            "pet_fao": 120.0,
        }
        for m in months
        for r in range(cfg.rows)
        for c in range(cfg.cols)
    ]
    pd.DataFrame(rows).to_csv(sources / "era5_cells.csv", index=False)

    ndvi_rows = [
        {"date": m, "row": r, "col": c, "ndvi": 0.5}
        for m in (ndvi_months if ndvi_months is not None else months)
        for r in range(cfg.rows)
        for c in range(cfg.cols)
    ]
    pd.DataFrame(ndvi_rows).to_csv(sources / "ndvi_cells.csv", index=False)

    index = pd.DataFrame({"date": months, "nino34": 0.5, "nino12": 0.4, "nino4": 0.3, "soi": -0.2})
    index.to_csv(sources / "nino34.csv", index=False)
    return paths


def test_assemble_writes_the_pipeline_inputs(tmp_path):
    cfg = PipelineConfig(grid=(2, 2))
    months = ["2020-01-01", "2020-02-01", "2020-03-01"]
    paths = _write_sources(tmp_path, cfg, months)

    manifest = build.assemble(paths, cfg)

    assert manifest.records == 3
    with np.load(paths.grids_npz, allow_pickle=True) as z:
        assert z["rain"].shape == (3, 2, 2)
        assert list(z["dates"]) == months
        assert "pet_fao" in z.files
    assert list(pd.read_csv(paths.nino_indices_csv).columns) == ["date", "nino34", "nino12", "nino4", "soi"]


def test_assemble_keeps_only_months_every_source_observed(tmp_path):
    """A month NDVI never saw would otherwise reach the model as a hole."""
    cfg = PipelineConfig(grid=(2, 2))
    months = ["2020-01-01", "2020-02-01", "2020-03-01"]
    paths = _write_sources(tmp_path, cfg, months, ndvi_months=months[:2])

    manifest = build.assemble(paths, cfg)

    assert manifest.records == 2
    with np.load(paths.grids_npz, allow_pickle=True) as z:
        assert list(z["dates"]) == months[:2]


def test_assemble_refuses_sources_that_share_no_months(tmp_path):
    cfg = PipelineConfig(grid=(2, 2))
    paths = _write_sources(tmp_path, cfg, ["2020-01-01"], ndvi_months=["2021-01-01"])
    with pytest.raises(IngestError, match="share no months"):
        build.assemble(paths, cfg)


def test_synthetic_data_is_never_reported_as_observed(tmp_path):
    """The generator writes to the same paths; only a manifest proves the data is real."""
    from ai_drews.data.io import build_dataset

    cfg = PipelineConfig(grid=(2, 2), start="2000-01-01", end="2003-12-01")
    paths = DataPaths(tmp_path).ensure()

    first = build_dataset(paths, cfg)
    assert first["source"] == "synthetic"

    # Second run: the raw files now exist, but nothing downloaded them.
    second = build_dataset(paths, cfg)
    assert second["source"] == "synthetic"
    assert not build.dataset_is_observed(paths)


def test_assembled_data_is_reported_as_observed(tmp_path):
    from ai_drews.data.io import build_dataset

    cfg = PipelineConfig(grid=(2, 2))
    months = [f"2020-{m:02d}-01" for m in range(1, 13)]
    paths = _write_sources(tmp_path, cfg, months)
    build.assemble(paths, cfg)

    assert build.dataset_is_observed(paths)
    assert build_dataset(paths, cfg)["source"] == "real"


def test_the_dataset_manifest_names_its_upstream_sources(tmp_path):
    cfg = PipelineConfig(grid=(2, 2))
    paths = _write_sources(tmp_path, cfg, ["2020-01-01", "2020-02-01"])
    write_manifest(paths, _manifest("era5"))
    write_manifest(paths, _manifest("ndvi"))
    write_manifest(paths, _manifest("nino34"))

    manifest = build.assemble(paths, cfg)
    assert "era5" in manifest.provider and "ndvi" in manifest.provider
    assert json.loads((tmp_path / "raw" / "manifests" / "dataset.json").read_text())["records"] == 2


def _era5_payload(latitudes: str, longitudes: str, start: str, end: str) -> list[dict]:
    """A minimal Open-Meteo archive response: one block per requested coordinate."""
    days = pd.date_range(start, end, freq="D")
    blocks = []
    for _ in latitudes.split(","):
        blocks.append(
            {
                "daily": {
                    "time": [d.strftime("%Y-%m-%d") for d in days],
                    "precipitation_sum": [2.0] * len(days),
                    "temperature_2m_max": [28.0] * len(days),
                    "temperature_2m_mean": [20.0] * len(days),
                    "soil_moisture_7_to_28cm_mean": [0.2] * len(days),
                    "et0_fao_evapotranspiration": [4.0] * len(days),
                }
            }
        )
    return blocks


class _CountingArchive:
    """Stands in for the Open-Meteo archive, counting how often it is actually called."""

    def __init__(self, fail_after: int | None = None):
        self.calls = 0
        self.fail_after = fail_after

    def __call__(self, url, *, params=None):
        self.calls += 1
        if self.fail_after is not None and self.calls > self.fail_after:
            raise IngestError("rate limited")
        return _era5_payload(
            params["latitude"], params["longitude"], params["start_date"], params["end_date"]
        )


def test_era5_monthly_values_aggregate_the_right_way(tmp_path, monkeypatch):
    """Rainfall is a monthly total; temperature is a monthly mean. One endpoint cannot do both."""
    from ai_drews.ingest import era5

    cfg = PipelineConfig(grid=(1, 2), start="2020-01-01", end="2020-02-01")
    monkeypatch.setattr(era5, "fetch_json", _CountingArchive())
    monkeypatch.setattr(era5, "time", type("_", (), {"sleep": staticmethod(lambda _: None)}))

    era5.fetch(DataPaths(tmp_path).ensure(), cfg, start="2020-01-01")

    months, grids = era5.load(DataPaths(tmp_path), cfg)
    january = months.index("2020-01-01")
    assert grids["rain"][january, 0, 0] == pytest.approx(31 * 2.0)  # summed
    assert grids["tmean"][january, 0, 0] == pytest.approx(20.0)  # averaged
    assert grids["pet_fao"][january, 0, 0] == pytest.approx(31 * 4.0)  # summed


def test_a_rate_limited_era5_run_resumes_instead_of_starting_over(tmp_path, monkeypatch):
    """One full grid sits close to the archive's hourly allowance; losing progress is expensive."""
    from ai_drews.ingest import era5

    cfg = PipelineConfig(grid=(4, 4), start="2000-01-01", end="2020-01-01")
    paths = DataPaths(tmp_path).ensure()
    monkeypatch.setattr(era5, "time", type("_", (), {"sleep": staticmethod(lambda _: None)}))

    # First run gives up part way through, as a 429 eventually does.
    stopping = _CountingArchive(fail_after=3)
    monkeypatch.setattr(era5, "fetch_json", stopping)
    with pytest.raises(IngestError):
        era5.fetch(paths, cfg, start="2000-01-01")
    cached = list((tmp_path / "raw" / "sources" / "era5_parts").glob("*.csv"))
    assert len(cached) == 3, "completed requests must be kept"

    # Second run only fetches what is missing.
    resuming = _CountingArchive()
    monkeypatch.setattr(era5, "fetch_json", resuming)
    manifest = era5.fetch(paths, cfg, start="2000-01-01")

    total_requests = stopping.calls - 1 + resuming.calls
    assert resuming.calls < total_requests, "a resumed run must re-use the cached parts"
    assert manifest.records == 241 * 16  # months x cells
    assert not (tmp_path / "raw" / "sources" / "era5_parts").exists(), "parts are cleared on success"


def test_assemble_works_without_a_greenness_cache(tmp_path):
    """`ingest all` must not depend on MODIS: no study source supplies a vegetation index."""
    cfg = PipelineConfig(grid=(2, 2))
    months = ["2020-01-01", "2020-02-01"]
    paths = _write_sources(tmp_path, cfg, months)
    (tmp_path / "raw" / "sources" / "ndvi_cells.csv").unlink()

    manifest = build.assemble(paths, cfg)

    assert manifest.records == 2
    assert "ndvi" not in manifest.variables
    with np.load(paths.grids_npz, allow_pickle=True) as z:
        assert "ndvi" not in z.files
        assert z["rain"].shape == (2, 2, 2)
    assert build.dataset_is_observed(paths)


def test_the_slow_source_is_not_in_ingest_all():
    """MODIS takes hours; `make ingest` must stay a minutes-long command."""
    from ai_drews.ingest import ALL_CONNECTORS, CONNECTORS, OPT_IN_CONNECTORS

    assert "ndvi" not in CONNECTORS
    assert "ndvi" in OPT_IN_CONNECTORS
    assert "ndvi" in ALL_CONNECTORS
    assert set(CONNECTORS) == {"nino34", "era5", "chirps", "crops", "validation"}
