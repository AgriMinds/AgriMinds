"""Crop-yield outlook: quintals per hectare by crop and altitude belt.

A second model with its own record, so it carries its own provenance rather than
``ForecastProvenance`` (which describes the drought weights and the watershed grid).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from agriminds_api.schemas.common import CropName

#: The three Ethiopian agro-ecological belts the model was fitted on.
AgroZoneName = Literal["Lowland", "Midland", "Highland"]

#: Where the Niño 3.4 value in a response came from.
EnsoBasis = Literal["forecast", "observed", "dataset", "requested"]


class CropYieldInputs(BaseModel):
    """Everything the regressor saw. Shown next to a number so it can be argued with."""

    year: int
    temperature_c: float = Field(description="Watershed mean temperature (°C)")
    precipitation_mm: float = Field(description="Watershed mean monthly rainfall (mm/month)")
    enso_index: float = Field(description="Niño 3.4 anomaly (°C)")
    enso_phase: str = Field(description="El Nino | La Nina | Neutral, as the training panel labelled it")
    yield_lag1: float = Field(description="Last observed yield for this crop and belt (q/ha)")
    yield_rolling3_mean: float = Field(description="Mean of the three last observed yields (q/ha)")


class CropYieldCell(BaseModel):
    crop: CropName
    zone: AgroZoneName
    zone_local_name: str = Field(description="Kolla | Woina Dega | Dega")
    altitude_approx_m: int
    predicted_yield_q_ha: float = Field(description="Predicted yield under `inputs` (quintals/hectare)")
    neutral_yield_q_ha: float = Field(
        description="Same inputs with Niño 3.4 forced to 0.0, so the ENSO term can be read on its own"
    )
    enso_delta_pct: float = Field(description="Predicted vs neutral, as a percentage of neutral")
    last_observed_yield_q_ha: float = Field(description="Final year of the training record")
    change_vs_last_observed_pct: float
    inputs: CropYieldInputs


class CropYieldProvenance(BaseModel):
    model_name: str = Field(description="Winning candidate, e.g. XGBoost")
    model_version: str
    trained_at: str = Field(description="ISO-8601 timestamp of the training run")
    dataset_file: str = Field(description="Spreadsheet the model was fitted on")
    record_years: list[int] = Field(description="[first_year, last_year] of the training record")
    test_rmse_q_ha: float = Field(description="Holdout RMSE on the final seven years")
    test_r2: float


class CropYieldOutlook(BaseModel):
    year: int = Field(description="Season being predicted")
    enso_index: float
    enso_phase: str
    enso_basis: EnsoBasis = Field(
        description=(
            "'forecast': the platform's own CNN-LSTM Niño 3.4 forecast for `lead_month`. "
            "'observed': the last observed month. 'dataset': the last year of the crop record, "
            "used when the drought pipeline has not been trained on this deployment."
        )
    )
    lead_month: int | None = Field(None, description="ENSO lead used, when the basis is a forecast")
    baseline_year: int = Field(description="Last year of the crop record, where the lag features come from")
    cells: list[CropYieldCell] = Field(description="One entry per crop and belt")
    caveats: list[str] = Field(description="What this model cannot support, carried from the artifact")
    provenance: CropYieldProvenance


class CropYieldScenarioRequest(BaseModel):
    """A what-if: name the climate, keep the observed lags."""

    crop: CropName = Field("tef")
    zone: AgroZoneName = Field("Midland")
    year: int | None = Field(None, ge=1990, le=2100, description="Default: the season after the record")
    temperature_c: float | None = Field(None, ge=-10, le=50)
    precipitation_mm: float | None = Field(None, ge=0, le=1000)
    enso_index: float | None = Field(None, ge=-5, le=5, description="Niño 3.4 anomaly (°C)")


class CropYieldScenario(BaseModel):
    cell: CropYieldCell
    caveats: list[str]
    provenance: CropYieldProvenance


class CropYieldCandidate(BaseModel):
    """One of the five candidates scored on the same chronological holdout."""

    model: str
    train_rmse: float
    test_rmse: float
    test_mae: float
    test_r2: float
    test_mape: float
    selected: bool


class CropYieldFeature(BaseModel):
    feature: str
    importance: float = Field(description="Share of the model's gain (tree models) in [0, 1]")


class CropYieldZone(BaseModel):
    zone: AgroZoneName
    local_name: str
    altitude_approx_m: int
    altitude_min_m: int
    altitude_max_m: int


class CropYieldModelCard(BaseModel):
    """Everything needed to present the model honestly: scores, what it leans on, and the limits."""

    provenance: CropYieldProvenance
    upstream_repo: str = Field(description="Hugging Face repository the pipeline came from")
    upstream_revision: str
    record_rows: int
    train_years: list[int]
    test_years: list[int]
    test_rows: int
    mean_yield_q_ha: float
    candidates: list[CropYieldCandidate]
    feature_importance: list[CropYieldFeature]
    zones: list[CropYieldZone]
    caveats: list[str]
