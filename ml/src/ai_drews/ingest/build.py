"""Assemble the downloaded sources into the arrays the pipeline trains on.

Each connector caches its own tidy table. This step intersects them on the months every source
actually observed and writes the two files the rest of the pipeline reads — ``raw/grids.npz`` and
``raw/nino_indices.csv`` — plus a ``dataset`` manifest saying where the numbers came from.

That manifest is the point. Before it existed, provenance was inferred from the raw files merely
being present, and the synthetic generator writes to exactly the same paths: a second run would
load its own stand-in data and stamp the model "real".
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.ingest import era5, ndvi, nino34, wind
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, read_manifests, write_manifest

log = logging.getLogger(__name__)

KEY = "dataset"

#: What `grids.npz` carries, and which connector supplies it.
GRID_SOURCES = {
    "rain": "era5",
    "tmax": "era5",
    "tmean": "era5",
    "soilm": "era5",
    "pet_fao": "era5",
}
#: Greenness is assembled when it has been ingested and skipped when it has not. No source the
#: study names supplies a vegetation index, and MODIS takes hours to download, so requiring it
#: would make `ingest all` an overnight job for a channel the study never asked for.
OPTIONAL_GRID_SOURCES = {"ndvi": "ndvi", "u10": "wind", "v10": "wind", "wind_speed": "wind"}
#: Index columns, in the order `io.load_raw` expects them.
INDEX_COLUMNS = ("nino34", "nino12", "nino4", "soi")


def assemble(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> Manifest:
    """Build ``raw/grids.npz`` and ``raw/nino_indices.csv`` from the cached sources."""
    era5_months, era5_grids = era5.load(paths, cfg)
    indices = nino34.load(paths)

    try:
        ndvi_months, ndvi_cube = ndvi.load(paths, cfg)
    except IngestError:
        ndvi_months, ndvi_cube = None, None
        log.info("no NDVI cache: assembling without greenness (run `ai-drews ingest ndvi` to add it)")

    try:
        wind_months, wind_grids = wind.load(paths, cfg)
    except IngestError:
        wind_months, wind_grids = None, {}
        log.info("no wind cache: assembling without wind (run `ai-drews ingest wind` to add it)")

    index_months = {d.strftime("%Y-%m-%d") for d in indices.index}
    common_set = set(era5_months) & index_months
    if ndvi_months is not None:
        common_set &= set(ndvi_months)
    if wind_months is not None:
        common_set &= set(wind_months)
    common = sorted(common_set)
    if not common:
        raise IngestError("the sources share no months; check each connector's coverage")
    log.info(
        "months: ERA5 %d, NDVI %s, wind %s, indices %d -> %d in common (%s..%s)",
        len(era5_months),
        len(ndvi_months) if ndvi_months is not None else "absent",
        len(wind_months) if wind_months is not None else "absent",
        len(index_months),
        len(common),
        common[0],
        common[-1],
    )

    era5_at = {month: i for i, month in enumerate(era5_months)}
    era5_rows = [era5_at[m] for m in common]

    grids: dict[str, np.ndarray] = {}
    for name in GRID_SOURCES:
        if name in era5_grids:
            grids[name] = era5_grids[name][era5_rows]
    missing_variables = sorted(set(GRID_SOURCES) - set(grids))
    if missing_variables:
        raise IngestError(f"no data for {missing_variables}; re-run those connectors")

    if ndvi_months is not None and ndvi_cube is not None:
        ndvi_at = {month: i for i, month in enumerate(ndvi_months)}
        grids["ndvi"] = ndvi_cube[[ndvi_at[m] for m in common]]

    if wind_months is not None and wind_grids:
        wind_at = {month: i for i, month in enumerate(wind_months)}
        rows = [wind_at[m] for m in common]
        for name in ("u10", "v10", "wind_speed"):
            if name in wind_grids:
                grids[name] = wind_grids[name][rows]

    holes = {k: int(np.isnan(v).sum()) for k, v in grids.items() if np.isnan(v).any()}
    if holes:
        # A gap would propagate silently into SPI and the water balance.
        raise IngestError(f"gaps remain after intersecting months: {holes}")

    grids["dates"] = np.array(common, dtype=object)
    frame = indices.loc[pd.DatetimeIndex(common), :].copy()
    for column in INDEX_COLUMNS:
        if column not in frame:
            frame[column] = np.nan
    frame = frame[list(INDEX_COLUMNS)]
    # The companion indices start later than Niño 3.4 and the newest months lag; carry the last
    # observation rather than leaving a hole the networks would read as a zero anomaly.
    frame = frame.ffill().bfill()
    frame.index.name = "date"

    paths.ensure()
    np.savez_compressed(paths.grids_npz, **grids)
    frame.reset_index().to_csv(paths.nino_indices_csv, index=False)
    log.info("wrote %s and %s", paths.grids_npz, paths.nino_indices_csv)

    upstream = read_manifests(paths)
    extra = {OPTIONAL_GRID_SOURCES[k] for k in grids if k in OPTIONAL_GRID_SOURCES}
    contributors = sorted(set(GRID_SOURCES.values()) | {"nino34"} | extra)
    manifest = Manifest.now(
        key=KEY,
        provider="; ".join(f"{k}: {upstream[k].provider}" for k in contributors if k in upstream)
        or "unknown",
        source_url="",
        citation=" | ".join(upstream[k].citation for k in contributors if k in upstream),
        records=len(common),
        coverage=coverage_of(common),
        variables=tuple(sorted(set(grids) - {"dates"} | set(INDEX_COLUMNS))),
        notes=(
            f"Observed data for {cfg.rows}x{cfg.cols} cells over {len(common)} months, "
            f"assembled from {', '.join(contributors)}."
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def dataset_is_observed(paths: DataPaths) -> bool:
    """True when ``raw/`` holds assembled observations rather than generated stand-ins."""
    manifests = read_manifests(paths)
    manifest = manifests.get(KEY)
    return manifest is not None and manifest.records > 0 and paths.has_raw_data()
