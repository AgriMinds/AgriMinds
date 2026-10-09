"""Raw-data persistence.

Real-data format (monthly, start..end, one common grid):
  raw/nino_indices.csv : date,nino34,nino12,nino4,soi
  raw/grids.npz        : rain, tmax, soilm (ERA5), ndvi (MODIS) -> each (T, H, W),
                         plus `dates` as YYYY-MM-DD strings.
                         Optional: tmean (ERA5 monthly mean temperature, deg C). Without it the
                         Palmer water balance has no evapotranspiration term, so Sc-PDSI is
                         skipped rather than estimated from the maxima. Also optional: pet_fao
                         (ERA5 FAO reference evapotranspiration, mm/month).

These files are written either by `ai_drews.ingest.build.assemble` from downloaded observations,
or by the synthetic generator. Which one is recorded in `raw/manifests/dataset.json`; nothing
downstream may infer provenance from the files alone.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.data.synthetic import make_synthetic

log = logging.getLogger(__name__)

GRID_VARIABLES = ("rain", "tmax", "soilm")
#: `ndvi` is optional because no source the study names supplies a vegetation index, and MODIS is
#: slow enough to download that requiring it would block a deployment on hours of transfer.
#: Without it, VCI and the greenness channels are simply absent.
OPTIONAL_GRID_VARIABLES = ("tmean", "pet_fao", "ndvi", "u10", "v10", "wind_speed")


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
    """Step 1: use observed files if present in raw/, otherwise write synthetic data.

    Whether the data is real is decided by the ingest manifest, never by the files existing: the
    synthetic generator writes to the same paths, so a second run would otherwise load its own
    stand-ins and label the model "real".
    """
    from ai_drews.ingest.build import dataset_is_observed

    observed = dataset_is_observed(paths)
    if paths.has_raw_data():
        ind, g = load_raw(paths)
        source = "real" if observed else "synthetic"
        if not observed:
            log.warning(
                "raw/ holds data with no ingest manifest; treating it as synthetic. "
                "Run `ai-drews ingest all` to download the observed record."
            )
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
