"""Connectors for the observational inputs the study specifies.

Each module downloads one source into ``data/raw/sources/`` and records what it retrieved in
``data/raw/manifests/``. ``build.assemble`` then intersects them into the arrays the pipeline
trains on, and ``validate.run`` checks ERA5 against CHIRPS.

Nothing here invents a value. A connector that cannot reach its provider raises, so a stale or
missing source is visible rather than quietly filled in.
"""

from __future__ import annotations

from collections.abc import Callable

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.ingest import build, chirps, crops, era5, ndvi, nino34, validate, wind
from ai_drews.ingest.base import INGEST_START, IngestError, Manifest, read_manifest, read_manifests

#: Download order. ERA5 and CHIRPS must both land before the validation step can compare them.
#: Wind runs last: it is the longest download (hourly ERA5 for the full grid), is resumable, and
#: does not block the other connectors. Assemble runs after all of these.
CONNECTORS: dict[str, Callable[[DataPaths, PipelineConfig], Manifest]] = {
    "nino34": lambda paths, cfg: nino34.fetch(paths),
    "era5": lambda paths, cfg: era5.fetch(paths, cfg, start=INGEST_START),
    "chirps": lambda paths, cfg: chirps.fetch(paths, cfg, start=INGEST_START),
    "crops": lambda paths, cfg: crops.fetch(paths),
    "validation": lambda paths, cfg: validate.run(paths, cfg),
    "wind": lambda paths, cfg: wind.fetch(paths, cfg, start=INGEST_START),
}

#: Not in `all`. MODIS is the one input that takes hours rather than minutes, and no source the
#: study names supplies a vegetation index, so it is requested by name or not at all.
OPT_IN_CONNECTORS: dict[str, Callable[[DataPaths, PipelineConfig], Manifest]] = {
    "ndvi": lambda paths, cfg: ndvi.fetch(paths, cfg, start=INGEST_START),
}

#: Everything `ai-drews ingest <source>` accepts.
ALL_CONNECTORS = CONNECTORS | OPT_IN_CONNECTORS


def fetch_all(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> dict[str, Manifest]:
    """Run every connector, then assemble the dataset.

    Raises on the first source that fails, so a half-connected deployment is visible rather than
    silently partial. Wind runs last; it is the longest connector (resumable hourly ERA5 download)
    but is part of the standard ingest. MODIS is left out; see ``OPT_IN_CONNECTORS``.
    """
    results = {name: connector(paths, cfg) for name, connector in CONNECTORS.items()}
    results[build.KEY] = build.assemble(paths, cfg)
    return results


__all__ = [
    "ALL_CONNECTORS",
    "CONNECTORS",
    "OPT_IN_CONNECTORS",
    "INGEST_START",
    "IngestError",
    "Manifest",
    "build",
    "chirps",
    "crops",
    "era5",
    "fetch_all",
    "ndvi",
    "nino34",
    "read_manifest",
    "read_manifests",
    "validate",
    "wind",
]
