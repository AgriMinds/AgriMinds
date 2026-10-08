from __future__ import annotations

from pydantic import BaseModel, Field

from agriminds_api.schemas.common import EnsoCategoryName, ForecastProvenance


class EnsoPoint(BaseModel):
    date: str = Field(description="YYYY-MM")
    nino34: float
    is_forecast: bool = False
    category: EnsoCategoryName | None = Field(None, description="Five-way band (Table 2)")


class EnsoOutlookResponse(BaseModel):
    current_nino34: float
    current_state: str = Field(description="Coarse phase: El Niño | La Niña | Neutral")
    current_category: EnsoCategoryName = Field(
        description="Five-way band from Table 2; 'High' bands warrant a changed recommendation"
    )
    is_extreme: bool = Field(description="True for High El Niño or High La Niña")
    classification_version: str
    citation: str
    forecast_horizon_months: int
    historical_series: list[EnsoPoint]
    forecast_series: list[EnsoPoint] = Field(description="Empty when the ENSO model has not been trained")
    teleconnection_summary: str
    provenance: ForecastProvenance
