"""Raw-data persistence.

Real-data format (monthly, start..end, one common grid):
  raw/nino_indices.csv : date,nino34,nino12,nino4,soi
  raw/grids.npz        : rain (CHIRPS), tmax (ERA5), soilm (ERA5), ndvi (MODIS) -> each (T, H, W),
                         plus `dates` as YYYY-MM-DD strings.
                         Optional: tmean (ERA5 monthly mean temperature, deg C). Without it the
                         Palmer water balance has no evapotranspiration term, so Sc-PDSI is
                         skipped rather than estimated from the maxima.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.data.synthetic import make_synthetic

log = logging.getLogger(__name__)

GRID_VARIABLES = ("rain", "tmax", "soilm", "ndvi")
OPTIONAL_GRID_VARIABLES = ("tmean",)


def save_raw(paths: DataPaths, ind: pd.DataFrame, grids: dict) -> None:
    paths.ensure()
    ind.to_csv(paths.nino_indices_csv, index=False)
    np.savez_compressed(paths.grids_npz, **grids)


def load_raw(paths: DataPaths) -> tuple[pd.DataFrame, dict]:
    ind = pd.read_csv(paths.nino_indices_csv, parse_dates=["date"])
    g = np.load(paths.grids_npz, allow_pickle=True)
    grids = {k: g[k] for k in g.files}
    missing = [v for v in GRID_VARIABLES if v not in grids]
    if missing:
        raise ValueError(f"grids.npz is missing variables: {missing}")
    return ind, grids


def build_dataset(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> dict:
    """Step 1: use real files if present in raw/, otherwise write synthetic data. Returns a summary."""
    if paths.has_raw_data():
        ind, g = load_raw(paths)
        source = "real"
    else:
        ind, g = make_synthetic(cfg)
        save_raw(paths, ind, g)
        source = "synthetic"
    missing = {k: int(np.isnan(v).sum()) for k, v in g.items() if k != "dates"}
    summary = dict(
        source=source,
        months=len(ind),
        grid=tuple(int(x) for x in g["rain"].shape[1:]),
        missing=missing,
        scpdsi_inputs="present" if "tmean" in g else "absent (no tmean: Sc-PDSI is skipped)",
    )
    log.info("dataset built: %s", summary)
    return summary
