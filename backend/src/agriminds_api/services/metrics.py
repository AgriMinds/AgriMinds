"""Load drought and ENSO performance metrics from the CSV files written by the ML pipeline."""

from __future__ import annotations

import logging

import pandas as pd
from ai_drews.config import DataPaths

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.schemas.metrics import (
    DroughtLeadMetric,
    EnsoLeadMetric,
    HistoricalValidationPoint,
    ModelComparisonRow,
    ModelMetricsResponse,
)
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)


class MetricsService:
    def __init__(self, settings: Settings, inference: InferenceService) -> None:
        self._settings = settings
        self._inference = inference
        self._paths = DataPaths.from_env(settings.data_dir)

    def metrics(self) -> ModelMetricsResponse:
        artifacts = self._inference.artifacts
        if artifacts is None:
            raise ModelUnavailableError("No trained model is loaded on this deployment.")

        meta = artifacts.meta
        return ModelMetricsResponse(
            drought=self._drought_metrics(meta),
            enso=self._enso_metrics(),
            model_comparison=self._model_comparison(),
            historical_validation=self._historical_validation(),
            model_version=meta.get("model_version", "unknown"),
            data_source=meta.get("data_source", "unknown"),
            trained_at=meta.get("trained_at"),
        )

    # ── private helpers ───────────────────────────────────────────────────────

    def _drought_metrics(self, meta: dict) -> list[DroughtLeadMetric]:
        csv_path = self._paths.outputs / "drought_metrics.csv"
        if csv_path.is_file():
            try:
                df = pd.read_csv(csv_path)
                return [
                    DroughtLeadMetric(
                        lead=int(r["lead"]),
                        AUC=float(r["AUC"]),
                        AUC_persistence=float(r["AUC_persistence"]),
                        Brier=float(r["Brier"]),
                        BSS_vs_climatology=float(r["BSS_vs_climatology"]),
                        POD=float(r["POD"]),
                        FAR=float(r["FAR"]),
                        threshold=float(r["threshold"]),
                        skilful=bool(r["skilful"]),
                        Accuracy=float(r.get("Accuracy", 0.0)),
                        Precision=float(r.get("Precision", 0.0)),
                        Recall=float(r.get("Recall", 0.0)),
                        F1=float(r.get("F1", 0.0)),
                        PearsonR=float(r.get("PearsonR", 0.0)),
                        TP=int(r.get("TP", 0)),
                        FP=int(r.get("FP", 0)),
                        TN=int(r.get("TN", 0)),
                        FN=int(r.get("FN", 0)),
                    )
                    for _, r in df.iterrows()
                ]
            except Exception:  # noqa: BLE001
                log.warning("could not parse %s, falling back to model metadata", csv_path)

        # Fallback: inline metrics in drought_meta.json
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
                Accuracy=float(r.get("Accuracy", 0.0)),
                Precision=float(r.get("Precision", 0.0)),
                Recall=float(r.get("Recall", 0.0)),
                F1=float(r.get("F1", 0.0)),
                PearsonR=float(r.get("PearsonR", 0.0)),
                TP=int(r.get("TP", 0)),
                FP=int(r.get("FP", 0)),
                TN=int(r.get("TN", 0)),
                FN=int(r.get("FN", 0)),
            )
            for r in list(meta.get("metrics", []))
        ]

    def _enso_metrics(self) -> list[EnsoLeadMetric]:
        csv_path = self._paths.outputs / "enso_metrics.csv"
        if not csv_path.is_file():
            return []
        try:
            df = pd.read_csv(csv_path)
            return [
                EnsoLeadMetric(
                    model=str(r["model"]),
                    lead=int(r["lead"]),
                    RMSE=float(r["RMSE"]),
                    MAE=float(r["MAE"]),
                    corr=float(r["corr"]),
                )
                for _, r in df.iterrows()
            ]
        except Exception:  # noqa: BLE001
            log.warning("could not parse %s", csv_path)
            return []

    def _model_comparison(self) -> list[ModelComparisonRow]:
        csv_path = self._paths.outputs / "model_comparison.csv"
        if not csv_path.is_file():
            return []
        try:
            df = pd.read_csv(csv_path)
            return [
                ModelComparisonRow(
                    model=str(r["model"]),
                    lead=int(r["lead"]),
                    RMSE=float(r["RMSE"]),
                    MAE=float(r["MAE"]),
                    AUC=float(r["AUC"]),
                    Accuracy=float(r["Accuracy"]),
                    F1=float(r["F1"]),
                )
                for _, r in df.iterrows()
            ]
        except Exception:  # noqa: BLE001
            log.warning("could not parse %s", csv_path)
            return []

    def _historical_validation(self) -> list[HistoricalValidationPoint]:
        csv_path = self._paths.outputs / "historical_validation.csv"
        if not csv_path.is_file():
            return []
        try:
            df = pd.read_csv(csv_path)
            return [
                HistoricalValidationPoint(
                    lead=int(r["lead"]),
                    date=str(r["date"]),
                    observed=float(r["observed"]),
                    predicted=float(r["predicted"]),
                    PearsonR=float(r["PearsonR"]),
                    RMSE=float(r["RMSE"]),
                    MAE=float(r["MAE"]),
                )
                for _, r in df.iterrows()
            ]
        except Exception:  # noqa: BLE001
            log.warning("could not parse %s", csv_path)
            return []
