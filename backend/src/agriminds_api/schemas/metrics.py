"""Schemas for the model-performance metrics endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DroughtLeadMetric(BaseModel):
    """One row of drought_metrics.csv — full scorecard per lead on held-out data."""

    lead: int
    AUC: float
    AUC_persistence: float
    Brier: float
    BSS_vs_climatology: float
    POD: float
    FAR: float
    threshold: float
    skilful: bool
    # Classification metrics
    Accuracy: float = Field(0.0)
    Precision: float = Field(0.0)
    Recall: float = Field(0.0)
    F1: float = Field(0.0)
    PearsonR: float = Field(0.0)
    # Confusion matrix counts
    TP: int = Field(0)
    FP: int = Field(0)
    TN: int = Field(0)
    FN: int = Field(0)


class EnsoLeadMetric(BaseModel):
    """One row of enso_metrics.csv — RMSE / MAE / correlation for one model × lead."""

    model: str
    lead: int
    RMSE: float
    MAE: float
    corr: float


class ModelComparisonRow(BaseModel):
    """One row of model_comparison.csv — Figure 1: all models at one lead."""

    model: str
    lead: int
    RMSE: float
    MAE: float
    AUC: float
    Accuracy: float
    F1: float


class HistoricalValidationPoint(BaseModel):
    """One row of historical_validation.csv — Figure 2: observed vs predicted per date × lead."""

    lead: int
    date: str
    observed: float
    predicted: float
    PearsonR: float
    RMSE: float
    MAE: float


class ModelMetricsResponse(BaseModel):
    """Full payload returned by GET /api/v1/drought/metrics."""

    drought: list[DroughtLeadMetric] = Field(
        description="Per-lead classification metrics (AUC, BSS, Accuracy, Precision, Recall, F1, confusion matrix)"
    )
    enso: list[EnsoLeadMetric] = Field(
        description="Per-model regression metrics (RMSE, MAE, corr) from enso_metrics.csv"
    )
    model_comparison: list[ModelComparisonRow] = Field(
        default_factory=list,
        description="Figure 1 — SuperHybrid vs CNN-LSTM, CNN, ANN, LSTM at every lead",
    )
    historical_validation: list[HistoricalValidationPoint] = Field(
        default_factory=list,
        description="Figure 2 — observed vs predicted Sc-PDSI for the test period",
    )
    model_version: str
    data_source: str
    trained_at: str | None = None
