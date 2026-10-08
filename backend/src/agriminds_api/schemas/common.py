from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RiskLevelName = Literal["Low", "Moderate", "High", "Severe"]
CropName = Literal["tef", "wheat", "maize"]

#: Five-way Niño 3.4 bands, Table 2 of the study.
EnsoCategoryName = Literal["High El Niño", "Moderate El Niño", "Neutral", "Moderate La Niña", "High La Niña"]

#: Seven-way Sc-PDSI drought-intensity bands, Table 2 of the study.
PdsiCategoryName = Literal[
    "Extremely wet",
    "Very wet",
    "Moderately wet",
    "Normal",
    "Moderately dry",
    "Very dry",
    "Extremely dry",
]


class ForecastProvenance(BaseModel):
    """Attached to every forecast-derived response so clients can show where the numbers come from."""

    model_version: str = Field(description="Version string written by `ai-drews train drought`")
    data_source: str = Field(
        description="'real' or 'synthetic' training data, as recorded in drought_meta.json"
    )
    source: Literal["model", "precomputed"] = Field(description="Live inference or last precomputed raster")
    issued_date: str = Field(description="Last month of input data the forecast is issued from (YYYY-MM-DD)")


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
