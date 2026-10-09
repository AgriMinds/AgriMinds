"""Schemas for the model-performance metrics endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DroughtLeadMetric(BaseModel):
    """One row of drought_metrics.csv — what each lead scored on held-out data."""

    lead: int
    AUC: float
    AUC_persistence: float
    Brier: float
    BSS_vs_climatology: float
    POD: float
    FAR: float
    threshold: float
    skilful: bool


class EnsoLeadMetric(BaseModel):
    """One row of enso_metrics.csv — RMSE / MAE / correlation for one model × lead."""

    model: str
    lead: int
    RMSE: float
    MAE: float
    corr: float


class ModelMetricsResponse(BaseModel):
    """Full payload returned by GET /api/v1/drought/metrics.

    ``drought`` contains the classification/probability metrics for the CNN-LSTM drought
    model at each of the twelve leads.  ``enso`` contains regression error metrics for every
    model (CNN-LSTM, Persistence, Ridge) across all ENSO leads, so a frontend chart can
    draw all three curves together and let the reader see where CNN-LSTM beats the baselines.

    Provenance is included so the frontend can warn the user when metrics come from a
    synthetic-data run rather than the observed record.
    """

    drought: list[DroughtLeadMetric] = Field(
        description="Per-lead classification metrics (AUC, BSS, POD, FAR, Brier) from drought_metrics.csv"
    )
    enso: list[EnsoLeadMetric] = Field(
        description="Per-model-per-lead regression metrics (RMSE, MAE, corr) from enso_metrics.csv"
    )
    model_version: str = Field(description="The model version that produced these metrics")
    data_source: str = Field(description="'real' or 'synthetic' — shown as a banner on the page")
    trained_at: str | None = Field(None, description="ISO-8601 timestamp of the training run")
