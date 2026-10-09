"""Load drought and ENSO performance metrics from the CSV files written by the ML pipeline.

This service reads the CSVs that are already present on disk; it does not re-derive the scores
at request time.  That is intentional: the metrics are fixed at training time and will not
change until the model is retrained, so there is nothing to compute here — only to parse and
serve.  If the CSVs are missing we still return whatever the model metadata contains, so the
endpoint degrades gracefully when only the model weights have been deployed.
"""

from __future__ import annotations

import logging

from ai_drews.config import DataPaths
import pandas as pd

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.schemas.metrics import DroughtLeadMetric, EnsoLeadMetric, ModelMetricsResponse
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)


class MetricsService:
    def __init__(self, settings: Settings, inference: InferenceService) -> None:
        self._settings = settings
        self._inference = inference
        self._paths = DataPaths.from_env(settings.data_dir)

    # ------------------------------------------------------------------
    def metrics(self) -> ModelMetricsResponse:
        artifacts = self._inference.artifacts
        if artifacts is None:
            raise ModelUnavailableError("No trained model is loaded on this deployment.")

        meta = artifacts.meta
        model_version: str = meta.get("model_version", "unknown")
        data_source: str = meta.get("data_source", "unknown")
        trained_at: str | None = meta.get("trained_at")

        drought = self._drought_metrics(meta)
        enso = self._enso_metrics()

        return ModelMetricsResponse(
            drought=drought,
            enso=enso,
            model_version=model_version,
            data_source=data_source,
            trained_at=trained_at,
        )

    # ------------------------------------------------------------------ private helpers

    def _drought_metrics(self, meta: dict) -> list[DroughtLeadMetric]:
        """Prefer the CSV; fall back to the inline metrics in the model metadata JSON."""
        csv_path = self._paths.outputs / "drought_metrics.csv"
        if csv_path.is_file():
            try:
                df = pd.read_csv(csv_path)
                rows: list[DroughtLeadMetric] = []
                for _, row in df.iterrows():
                    rows.append(
                        DroughtLeadMetric(
                            lead=int(row["lead"]),
                            AUC=float(row["AUC"]),
                            AUC_persistence=float(row["AUC_persistence"]),
                            Brier=float(row["Brier"]),
                            BSS_vs_climatology=float(row["BSS_vs_climatology"]),
                            POD=float(row["POD"]),
                            FAR=float(row["FAR"]),
                            threshold=float(row["threshold"]),
                            skilful=bool(row["skilful"]),
                        )
                    )
                return rows
            except Exception:  # noqa: BLE001
                log.warning("could not parse %s, falling back to model metadata", csv_path)

        # Fallback: the same data is embedded in drought_meta.json as `metrics`.
        inline: list[dict] = list(meta.get("metrics", []))
        return [
            DroughtLeadMetric(
                lead=int(r["lead"]),
                AUC=float(r["AUC"]),
                AUC_persistence=float(r.get("AUC_persistence", 0.5)),
                Brier=float(r["Brier"]),
                BSS_vs_climatology=float(r["BSS_vs_climatology"]),
                POD=float(r.get("POD", 0.0)),
                FAR=float(r.get("FAR", 0.0)),
                threshold=float(r.get("threshold", 0.1)),
                skilful=bool(r.get("skilful", False)),
            )
            for r in inline
        ]

    def _enso_metrics(self) -> list[EnsoLeadMetric]:
        """Read enso_metrics.csv, which has columns: model, lead, RMSE, MAE, corr."""
        csv_path = self._paths.outputs / "enso_metrics.csv"
        if not csv_path.is_file():
            log.info("enso_metrics.csv not found at %s, returning empty list", csv_path)
            return []
        try:
            df = pd.read_csv(csv_path)
            rows: list[EnsoLeadMetric] = []
            for _, row in df.iterrows():
                rows.append(
                    EnsoLeadMetric(
                        model=str(row["model"]),
                        lead=int(row["lead"]),
                        RMSE=float(row["RMSE"]),
                        MAE=float(row["MAE"]),
                        corr=float(row["corr"]),
                    )
                )
            return rows
        except Exception:  # noqa: BLE001
            log.warning("could not parse %s", csv_path)
            return []
