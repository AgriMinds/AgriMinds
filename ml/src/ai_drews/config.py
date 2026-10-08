"""Central, side-effect-free configuration for the AI-DREWS pipeline.

Nothing here touches the filesystem at import time. Call ``DataPaths.ensure()`` explicitly
when a pipeline step needs its output directories to exist.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PipelineConfig:
    """Scientific hyper-parameters. Frozen so a run is fully described by one object."""

    start: str = "1990-01-01"  # first month of the record
    end: str = "2026-06-01"  # last month of the record
    grid: tuple[int, int] = (8, 8)  # watershed cells (rows, cols)
    #: Bounding box of the Choke Mountain Watershed (lon_min, lat_min, lon_max, lat_max), taken
    #: from the surveyed boundary `cmw_max_boundary_wgs` (WGS84, 18,948 km2). Roughly a quarter
    #: of this rectangle lies outside the catchment, which is why the grid carries a mask.
    bbox: tuple[float, float, float, float] = (37.00780, 9.84375, 38.53125, 11.26234)

    window: int = 12  # months of history fed to the networks
    enso_leads: int = 6  # Objective 1: Nino3.4 forecast horizon (months)
    drought_leads: int = 3  # Objective 2: drought probability horizon (months)
    spi_scale: int = 3  # SPI-3 (seasonal drought)
    spi_drought: float = -1.0  # SPI <= -1 -> drought event
    # Available water capacity of the soil profile, used by the Palmer water balance (mm).
    # 100 mm is a mixed-agricultural default; replace it with survey values per woreda.
    awc_mm: float = 100.0

    train_end: str = "2013-12-01"  # chronological split (test = after val_end)
    val_end: str = "2018-12-01"
    seed: int = 42
    batch_size: int = 32
    epochs: int = 150
    patience: int = 15
    lr: float = 1e-3

    @property
    def rows(self) -> int:
        return self.grid[0]

    @property
    def cols(self) -> int:
        return self.grid[1]


DEFAULT_CONFIG = PipelineConfig()


@dataclass(frozen=True)
class DataPaths:
    """Where raw data, processed features, model weights and outputs live.

    Resolution order for the root: explicit argument > ``AI_DREWS_DATA_DIR`` > ``AGRIMINDS_DATA_DIR``
    > ``./data`` relative to the current working directory.
    """

    root: Path

    @classmethod
    def from_env(cls, root: str | os.PathLike[str] | None = None) -> DataPaths:
        value = root or os.environ.get("AI_DREWS_DATA_DIR") or os.environ.get("AGRIMINDS_DATA_DIR") or "data"
        return cls(Path(value).expanduser().resolve())

    @property
    def raw(self) -> Path:
        return self.root / "raw"

    @property
    def processed(self) -> Path:
        return self.root / "processed"

    @property
    def models(self) -> Path:
        return self.root / "models"

    @property
    def outputs(self) -> Path:
        return self.root / "outputs"

    # ---- well-known files -------------------------------------------------------------
    @property
    def nino_indices_csv(self) -> Path:
        return self.raw / "nino_indices.csv"

    @property
    def grids_npz(self) -> Path:
        return self.raw / "grids.npz"

    @property
    def fields_npz(self) -> Path:
        return self.processed / "fields.npz"

    @property
    def enso_forecast_csv(self) -> Path:
        return self.processed / "enso_forecast.csv"

    @property
    def drought_model_pt(self) -> Path:
        return self.models / "drought_model.pt"

    @property
    def drought_norm_npz(self) -> Path:
        return self.models / "drought_norm.npz"

    @property
    def drought_meta_json(self) -> Path:
        return self.models / "drought_meta.json"

    @property
    def enso_model_pt(self) -> Path:
        return self.models / "enso_cnnlstm.pt"

    @property
    def enso_norm_npz(self) -> Path:
        return self.models / "enso_norm.npz"

    @property
    def latest_risk_npz(self) -> Path:
        return self.outputs / "latest_risk.npz"

    @property
    def watershed_geojson(self) -> Path:
        """Surveyed catchment outline, converted from the shapefile. Plain JSON: no geo library."""
        return self.root / "geo" / "choke_watershed.geojson"

    def ensure(self) -> DataPaths:
        for p in (self.raw, self.processed, self.models, self.outputs, self.root / "geo"):
            p.mkdir(parents=True, exist_ok=True)
        return self

    def has_raw_data(self) -> bool:
        return self.nino_indices_csv.exists() and self.grids_npz.exists()

    def has_drought_artifacts(self) -> bool:
        return all(
            p.exists()
            for p in (self.drought_model_pt, self.drought_norm_npz, self.drought_meta_json, self.fields_npz)
        )
