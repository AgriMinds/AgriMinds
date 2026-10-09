"""What the forecast is actually built from.

Every entry is derived from the ingest manifests and the model metadata present on this
deployment. A source is only reported as connected when something real is supplying it; the rest
say plainly that they are not, because a platform that advises farmers should not imply
observational backing it does not have.

Provenance is never inferred from a file merely existing: the synthetic generator writes to the
same paths as the connectors, so the manifest written at download time is the only evidence that
a source is real.
"""

from __future__ import annotations

import numpy as np
from ai_drews.config import DataPaths
from ai_drews.ingest import read_manifests
from ai_drews.ingest.base import Manifest

from agriminds_api.core.config import Settings
from agriminds_api.schemas.provenance import DataInventory, DataSource
from agriminds_api.services.inference import InferenceService

#: The inputs the study specifies, in the order a reader meets them, and the ingest manifest
#: that supplies each. `scpdsi` is computed here rather than downloaded.
_CATALOGUE = (
    ("nino34", "Niño 3.4 index", "El Niño / La Niña phase, and the ENSO forecast", "nino34"),
    (
        "era5",
        "Temperature, rainfall, soil moisture, evaporation",
        "Rainfall patterns and the Sc-PDSI water balance",
        "era5",
    ),
    (
        "chirps_emi",
        "Rainfall and temperature for validation",
        "Checking ERA5 against station and satellite records",
        "validation",
    ),
    (
        "csa_crops",
        "Crop statistics for tef, wheat and maize",
        "Crop selection and sensitivity in the advisory rules",
        "crops",
    ),
    ("scpdsi", "Sc-PDSI drought index", "Drought monitoring and flood warning", None),
    (
        "wind",
        "10 m wind (u and v components)",
        "Penman-Monteith evapotranspiration and flood-risk lodging advisory",
        "wind",
    ),
)

#: Shown when a source has never been ingested.
_FALLBACK_PROVIDER = {
    "nino34": "NOAA",
    "era5": "ERA5 reanalysis",
    "chirps_emi": "CHIRPS and the Ethiopian Meteorological Institute",
    "csa_crops": "Central Statistical Agency",
    "scpdsi": "Computed here",
    "wind": "ERA5 reanalysis (ECMWF), served by the Open-Meteo archive",
}


class ProvenanceService:
    def __init__(self, settings: Settings, inference: InferenceService) -> None:
        self._paths = DataPaths.from_env(settings.data_dir)
        self._inference = inference

    def inventory(self) -> DataInventory:
        artifacts = self._inference.artifacts
        data_source = artifacts.data_source if artifacts else None
        trained_on_real = data_source == "real"
        grids = self._grid_variables()
        manifests = self._manifests()

        sources = [
            self._nino(manifests.get("nino34")),
            self._era5(manifests.get("era5"), grids),
            self._validation(manifests.get("validation")),
            self._crops(manifests.get("crops")),
            self._scpdsi(grids),
            self._wind(manifests.get("wind"), grids),
        ]
        connected = sum(1 for s in sources if s.status == "connected")
        return DataInventory(
            model_version=artifacts.model_version if artifacts else None,
            data_source=data_source,
            issued_date=artifacts.issued_date if artifacts else None,
            sources=sources,
            connected=connected,
            total=len(sources),
            caveat=self._caveat(trained_on_real, connected, len(sources)),
        )

    # ------------------------------------------------------------------ helpers
    def _manifests(self) -> dict[str, Manifest]:
        try:
            return read_manifests(self._paths)
        except Exception:  # noqa: BLE001 - an unreadable manifest tree means nothing is proven real
            return {}

    def _grid_variables(self) -> set[str]:
        if not self._paths.grids_npz.exists():
            return set()
        try:
            with np.load(self._paths.grids_npz, allow_pickle=True) as z:
                return {name for name in z.files if name != "dates"}
        except Exception:  # noqa: BLE001 - an unreadable archive means nothing is supplying this
            return set()

    def _caveat(self, trained_on_real: bool, connected: int, total: int) -> str | None:
        if not trained_on_real:
            return (
                "The current forecast was trained on synthetic stand-in data. It shows that the "
                "pipeline works; it is not a statement about real drought risk."
            )
        if connected < total:
            return (
                f"{total - connected} of {total} inputs are still not supplying real data. The "
                "forecast is trained on observations, but is not yet fully sourced."
            )
        return None

    def _entry(self, index: int, status: str, detail: str, manifest: Manifest | None = None) -> DataSource:
        key, name, feeds, _ = _CATALOGUE[index]
        return DataSource(
            key=key,
            name=name,
            provider=manifest.provider if manifest else _FALLBACK_PROVIDER[key],
            feeds=feeds,
            status=status,
            detail=detail,
            records=manifest.records if manifest else None,
            coverage_start=manifest.coverage_start if manifest else None,
            coverage_end=manifest.coverage_end if manifest else None,
            retrieved_at=manifest.retrieved_at if manifest else None,
            citation=manifest.citation if manifest else None,
        )

    def _nino(self, manifest: Manifest | None) -> DataSource:
        if manifest:
            return self._entry(
                0,
                "connected",
                f"Observed monthly anomalies, {manifest.records} months "
                f"({manifest.coverage_start} to {manifest.coverage_end}).",
                manifest,
            )
        if not self._paths.nino_indices_csv.exists():
            return self._entry(0, "not_connected", "No climate index file has been supplied.")
        return self._entry(
            0, "synthetic", "A generated index stands in for the NOAA series until it is supplied."
        )

    def _era5(self, manifest: Manifest | None, grids: set[str]) -> DataSource:
        expected = {"rain", "tmax", "tmean", "soilm"}
        if manifest:
            missing = sorted(expected - grids)
            detail = (
                f"{manifest.records} cell-months ({manifest.coverage_start} to "
                f"{manifest.coverage_end}) for {', '.join(manifest.variables)}."
            )
            return self._entry(
                1,
                "connected",
                detail + (f" Not yet in the grid: {', '.join(missing)}." if missing else ""),
                manifest,
            )
        present = sorted(expected & grids)
        if not present:
            return self._entry(1, "not_connected", "No gridded climate archive has been supplied.")
        return self._entry(1, "synthetic", f"Stand-in grids present: {', '.join(present)}.")

    def _validation(self, manifest: Manifest | None) -> DataSource:
        if manifest:
            return self._entry(2, "connected", manifest.notes, manifest)
        return self._entry(
            2,
            "not_connected",
            "No station or CHIRPS comparison runs yet, so the reanalysis is unvalidated here.",
        )

    def _crops(self, manifest: Manifest | None) -> DataSource:
        if manifest:
            return self._entry(
                3,
                "connected",
                f"Area harvested, yield and production, {manifest.records} yearly records "
                f"({manifest.coverage_start} to {manifest.coverage_end}). {manifest.notes}",
                manifest,
            )
        return self._entry(
            3,
            "not_connected",
            "Crop sensitivities in the advisory rules are placeholders to be replaced with "
            "Central Statistical Agency figures and co-validated with agronomists.",
        )

    def _scpdsi(self, grids: set[str]) -> DataSource:
        if "tmean" not in grids:
            return self._entry(
                4,
                "not_connected",
                "Needs mean temperature for evapotranspiration; it is skipped rather than estimated.",
            )
        return self._entry(
            4,
            "connected",
            "Computed from the water balance: evapotranspiration, recharge, runoff and loss, "
            "each against its potential. Dry bands drive drought warning, wet bands flood warning.",
        )

    def _wind(self, manifest: Manifest | None, grids: set[str]) -> DataSource:
        wind_vars = {"u10", "v10", "wind_speed"}
        if manifest:
            detail = (
                f"{manifest.records} cell-months ({manifest.coverage_start} to "
                f"{manifest.coverage_end}). Hourly ERA5 10 m speed and direction converted to "
                "u/v components per hour, then averaged — the vector mean the Climate Data "
                "Store's u/v fields carry, not a scalar mean with a dominant direction."
            )
            missing = sorted(wind_vars - grids)
            return self._entry(
                5,
                "connected",
                detail + (f" Not yet in the grid: {', '.join(missing)}." if missing else ""),
                manifest,
            )
        if wind_vars & grids:
            present = sorted(wind_vars & grids)
            return self._entry(5, "synthetic", f"Stand-in wind grids present: {', '.join(present)}.")
        return self._entry(
            5,
            "not_connected",
            "Hourly ERA5 10 m u/v wind not yet ingested. Run `ai-drews ingest wind` "
            "(opt-in: hours of download for the full grid, 1994 to present).",
        )
