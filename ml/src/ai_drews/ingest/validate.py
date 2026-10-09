"""Check ERA5 rainfall against CHIRPS over the catchment.

This is the job the study gives CHIRPS and the Ethiopian Meteorological Institute. Until it runs,
the reanalysis driving every forecast is unvalidated here, and the platform should say so rather
than imply the numbers have been checked against anything observed.

The comparison is basin-wide and monthly: ERA5 cell rainfall averaged over the catchment, against
the CHIRPS catchment mean for the same month.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.geo.watershed import grid_mask, load_boundary
from ai_drews.ingest import chirps, era5
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "validation"
PROVIDER = "CHIRPS v2.0 and the Ethiopian Meteorological Institute"
CITATION = "ERA5 monthly catchment rainfall compared against CHIRPS v2.0 catchment means."


@dataclass(frozen=True)
class Comparison:
    """How closely the reanalysis tracks the satellite-and-station product."""

    months: int
    correlation: float
    bias_mm: float
    mae_mm: float
    era5_mean_mm: float
    chirps_mean_mm: float

    @property
    def summary(self) -> str:
        direction = "wetter" if self.bias_mm > 0 else "drier"
        return (
            f"Over {self.months} months ERA5 tracks CHIRPS at r={self.correlation:.2f}, "
            f"running {abs(self.bias_mm):.1f} mm/month {direction} "
            f"(mean absolute difference {self.mae_mm:.1f} mm)."
        )


def compare(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> tuple[Comparison, pd.DataFrame]:
    months, grids = era5.load(paths, cfg)
    if "rain" not in grids:
        raise IngestError("the ERA5 cache has no rainfall to validate")

    # Only cells inside the basin: CHIRPS was averaged over the catchment, not the bounding box.
    inside = None
    if paths.watershed_geojson.exists():
        mask = grid_mask(load_boundary(paths.watershed_geojson), cfg.rows, cfg.cols)
        inside = np.array(mask.inside, dtype=bool)
        log.info("comparing over %d of %d cells inside the catchment", int(inside.sum()), inside.size)

    cube = grids["rain"]
    flat = cube[:, inside] if inside is not None and inside.any() else cube.reshape(len(months), -1)
    era5_series = pd.Series(np.nanmean(flat, axis=1), index=pd.DatetimeIndex(months), name="era5_mm")

    chirps_series = chirps.load(paths).rename("chirps_mm")
    frame = pd.concat([era5_series, chirps_series], axis=1).dropna()
    if len(frame) < 24:
        raise IngestError(f"only {len(frame)} overlapping months: too few to validate against")

    difference = frame["era5_mm"] - frame["chirps_mm"]
    result = Comparison(
        months=len(frame),
        correlation=float(frame["era5_mm"].corr(frame["chirps_mm"])),
        bias_mm=float(difference.mean()),
        mae_mm=float(difference.abs().mean()),
        era5_mean_mm=float(frame["era5_mm"].mean()),
        chirps_mean_mm=float(frame["chirps_mm"].mean()),
    )
    frame = frame.assign(difference_mm=difference.round(3)).round(3)
    frame.index.name = "date"
    return result, frame


def run(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> Manifest:
    """Compare, write ``outputs/era5_chirps_validation.csv`` and record the result."""
    result, frame = compare(paths, cfg)
    log.info("%s", result.summary)

    paths.outputs.mkdir(parents=True, exist_ok=True)
    frame.to_csv(paths.outputs / "era5_chirps_validation.csv")
    sources_dir(paths).mkdir(parents=True, exist_ok=True)
    pd.Series(asdict(result)).to_json(sources_dir(paths) / "validation.json", indent=2)

    dates = [d.strftime("%Y-%m-%d") for d in frame.index]
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url="https://climateserv.servirglobal.net/",
        citation=CITATION,
        records=result.months,
        coverage=coverage_of(dates),
        variables=("correlation", "bias_mm", "mae_mm"),
        notes=result.summary,
    )
    write_manifest(paths, manifest)
    return manifest
