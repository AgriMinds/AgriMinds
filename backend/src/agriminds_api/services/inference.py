"""Owns the trained artifacts and the (cached) risk cube.

The probability field only changes when a new month of data is ingested and the pipeline re-runs,
so it is computed once per (issued_date, model_version) and cached. There is NO random fallback:
if neither weights nor a precomputed raster are available the service reports itself unavailable.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from ai_drews.config import DataPaths
from ai_drews.inference import Artifacts, ArtifactsMissingError, load_artifacts, predict_risk

from agriminds_api.core.cache import Cache
from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.domain.risk import RiskSource
from agriminds_api.schemas.common import ForecastProvenance

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class RiskCube:
    probs: np.ndarray  # (leads, rows, cols) in [0, 1]
    issued_date: str  # YYYY-MM-DD
    model_version: str
    data_source: str
    source: RiskSource

    @property
    def issued(self) -> pd.Timestamp:
        return pd.Timestamp(self.issued_date)

    def target(self, lead_month: int) -> pd.Timestamp:
        return self.issued + pd.DateOffset(months=lead_month)

    def provenance(self) -> ForecastProvenance:
        return ForecastProvenance(
            model_version=self.model_version,
            data_source=self.data_source,
            source=self.source.value,
            issued_date=self.issued_date,
        )


class InferenceService:
    def __init__(self, settings: Settings, cache: Cache) -> None:
        self._settings = settings
        self._cache = cache
        self._paths = DataPaths.from_env(settings.data_dir)
        self._artifacts: Artifacts | None = None
        self._precomputed: RiskCube | None = None

    # ---- lifecycle -----------------------------------------------------------------------
    def load(self) -> None:
        try:
            self._artifacts = load_artifacts(self._paths)
            log.info(
                "loaded drought model %s (data_source=%s, issued=%s)",
                self._artifacts.model_version,
                self._artifacts.data_source,
                self._artifacts.issued_date,
            )
        except ArtifactsMissingError as exc:
            log.error("model artifacts missing: %s", exc)
            self._artifacts = None
        if self._artifacts is None and self._settings.allow_precomputed_fallback:
            self._precomputed = self._load_precomputed()
        if self._artifacts is None and self._precomputed is None:
            log.error("no model and no precomputed raster: forecast endpoints will return 503")

    def _load_precomputed(self) -> RiskCube | None:
        f = self._paths.latest_risk_npz
        if not f.exists():
            return None
        z = np.load(f, allow_pickle=True)
        cube = RiskCube(
            probs=np.asarray(z["probs"], dtype="float32"),
            issued_date=str(z["issued"]),
            model_version=str(z["model_version"]) if "model_version" in z.files else "unversioned",
            data_source="unknown",
            source=RiskSource.PRECOMPUTED,
        )
        log.warning("serving PRECOMPUTED raster from %s issued %s", f, cube.issued_date)
        return cube

    # ---- status --------------------------------------------------------------------------
    @property
    def artifacts(self) -> Artifacts | None:
        return self._artifacts

    @property
    def available(self) -> bool:
        return self._artifacts is not None or self._precomputed is not None

    @property
    def source(self) -> RiskSource | None:
        if self._artifacts is not None:
            return RiskSource.MODEL
        if self._precomputed is not None:
            return RiskSource.PRECOMPUTED
        return None

    # ---- inference -----------------------------------------------------------------------
    def risk_cube(self) -> RiskCube:
        if self._artifacts is None:
            if self._precomputed is not None:
                return self._precomputed
            raise ModelUnavailableError()
        art = self._artifacts
        key = f"risk:{art.issued_date}:{art.model_version}"
        cached = self._cache.get(key)
        if cached is not None:
            probs = np.load(io.BytesIO(cached), allow_pickle=False)
        else:
            probs = predict_risk(art).astype("float32")
            buf = io.BytesIO()
            np.save(buf, probs, allow_pickle=False)
            self._cache.set(key, buf.getvalue(), self._settings.cache_ttl_seconds)
            log.info("computed risk cube %s", key)
        return RiskCube(
            probs=probs,
            issued_date=art.issued_date,
            model_version=art.model_version,
            data_source=art.data_source,
            source=RiskSource.MODEL,
        )

    def observed_pdsi(self) -> np.ndarray | None:
        """Observed Sc-PDSI for the issue month, or None when the record lacks mean temperature."""
        if self._artifacts is None:
            return None
        return self._artifacts.latest_pdsi()

    def nino_for_lead(self, lead_month: int) -> float:
        """Nino3.4 expected at the target month: ENSO forecast if available, else last observed value."""
        if self._artifacts is None:
            return 0.0
        fc = self._artifacts.latest_enso_forecast()
        if fc is not None and lead_month - 1 < len(fc):
            return float(fc[lead_month - 1])
        return float(self._artifacts.nino_history[-1])
