from __future__ import annotations

from pydantic import BaseModel, Field

from agriminds_api.schemas.common import ForecastProvenance


class EnsoPoint(BaseModel):
    date: str = Field(description="YYYY-MM")
    nino34: float
    is_forecast: bool = False


class EnsoOutlookResponse(BaseModel):
    current_nino34: float
    current_state: str = Field(description="El Niño | La Niña | Neutral")
    forecast_horizon_months: int
    historical_series: list[EnsoPoint]
    forecast_series: list[EnsoPoint] = Field(description="Empty when the ENSO model has not been trained")
    teleconnection_summary: str
    provenance: ForecastProvenance
