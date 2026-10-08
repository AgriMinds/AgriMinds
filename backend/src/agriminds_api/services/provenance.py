"""What the forecast is actually built from.

Every entry is derived from the files and model metadata present on this deployment. A source is
only reported as connected when something real is supplying it; the rest say plainly that they
are not, because a platform that advises farmers should not imply observational backing it does
not have.
"""

from __future__ import annotations

import numpy as np
from ai_drews.config import DataPaths

from agriminds_api.core.config import Settings
from agriminds_api.schemas.provenance import DataInventory, DataSource
from agriminds_api.services.inference import InferenceService

#: The inputs the study specifies, in the order a reader meets them.
_CATALOGUE = (
    ("nino34", "Niño 3.4 index", "NOAA", "El Niño / La Niña phase, and the ENSO forecast"),
    (
        "era5",
        "Temperature, rainfall, soil moisture, evaporation",
        "ERA5 reanalysis",
        "Rainfall patterns and the Sc-PDSI water balance",
    ),
    (
        "chirps_emi",
        "Rainfall and temperature for validation",
        "CHIRPS and the Ethiopian Meteorological Institute",
        "Checking ERA5 against station and satellite records",
    ),
    (
        "csa_crops",
        "Crop statistics for tef, wheat and maize",
        "Central Statistical Agency",
        "Crop selection and sensitivity in the advisory rules",
    ),
    ("scpdsi", "Sc-PDSI drought index", "Computed here", "Drought monitoring and flood warning"),
)


class ProvenanceService:
    def __init__(self, settings: Settings, inference: InferenceService) -> None:
        self._paths = DataPaths.from_env(settings.data_dir)
        self._inference = inference

    def inventory(self) -> DataInventory:
        artifacts = self._inference.artifacts
        data_source = artifacts.data_source if artifacts else None
        real = data_source == "real"
        grids = self._grid_variables()

        sources = [
            self._nino(real),
            self._era5(grids, real),
            self._validation(),
            self._crops(),
            self._scpdsi(grids),
        ]
        connected = sum(1 for s in sources if s.status == "connected")
        return DataInventory(
            model_version=artifacts.model_version if artifacts else None,
            data_source=data_source,
            issued_date=artifacts.issued_date if artifacts else None,
            sources=sources,
            connected=connected,
            total=len(sources),
            caveat=(
                None
                if real
                else "The current forecast was trained on synthetic stand-in data. It shows that "
                "the pipeline works; it is not a statement about real drought risk."
            ),
        )

    # ------------------------------------------------------------------ helpers
    def _grid_variables(self) -> set[str]:
        if not self._paths.grids_npz.exists():
            return set()
        try:
            with np.load(self._paths.grids_npz, allow_pickle=True) as z:
                return {name for name in z.files if name != "dates"}
        except Exception:  # noqa: BLE001 - an unreadable archive means nothing is supplying this
            return set()

    def _entry(self, index: int, status: str, detail: str) -> DataSource:
        key, name, provider, feeds = _CATALOGUE[index]
        return DataSource(key=key, name=name, provider=provider, feeds=feeds, status=status, detail=detail)

    def _nino(self, real: bool) -> DataSource:
        if not self._paths.nino_indices_csv.exists():
            return self._entry(0, "not_connected", "No climate index file has been supplied.")
        if real:
            return self._entry(0, "connected", "Observed Niño 3.4 is driving the ENSO forecast.")
        return self._entry(
            0, "synthetic", "A generated index stands in for the NOAA series until it is supplied."
        )

    def _era5(self, grids: set[str], real: bool) -> DataSource:
        expected = {"rain", "tmax", "tmean", "soilm"}
        present = sorted(expected & grids)
        if not present:
            return self._entry(1, "not_connected", "No gridded climate archive has been supplied.")
        missing = sorted(expected - grids)
        detail = f"Present: {', '.join(present)}." + (f" Missing: {', '.join(missing)}." if missing else "")
        return self._entry(1, "connected" if real else "synthetic", detail)

    def _validation(self) -> DataSource:
        # There is no validation step in the pipeline yet; saying otherwise would be a claim
        # about accuracy that nothing supports.
        return self._entry(
            2,
            "not_connected",
            "No station or CHIRPS comparison runs yet, so the reanalysis is unvalidated here.",
        )

    def _crops(self) -> DataSource:
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
