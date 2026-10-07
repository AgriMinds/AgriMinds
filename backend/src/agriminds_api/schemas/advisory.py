from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from agriminds_api.schemas.common import CropName, ForecastProvenance, RiskLevelName


class AdvisoryRequest(BaseModel):
    crop: CropName = Field("tef", description="Target staple crop")
    lead_month: int = Field(1, ge=1, le=3, description="Forecast lead time in months")
    row: int | None = Field(None, ge=0, description="Watershed grid row index (north = 0)")
    col: int | None = Field(None, ge=0, description="Watershed grid column index (west = 0)")
    latitude: float | None = Field(None, ge=-90, le=90, description="GPS latitude (alternative to row/col)")
    longitude: float | None = Field(
        None, ge=-180, le=180, description="GPS longitude (alternative to row/col)"
    )
    iek_agrees: bool | None = Field(
        None, description="Indigenous ecological knowledge: True = local indicators agree with a dry outlook"
    )

    @model_validator(mode="after")
    def _pairs(self) -> AdvisoryRequest:
        if (self.row is None) != (self.col is None):
            raise ValueError("row and col must be provided together")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class AdvisoryResponse(BaseModel):
    crop: CropName
    lead_month: int
    row: int
    col: int
    target_date: str
    raw_probability: float
    adjusted_probability: float
    risk_level: RiskLevelName
    season: str
    enso_state: str
    crop_note: str
    crop_recommendation: str
    planting_window: str
    water_management: str
    preparedness_action: str
    iek_assessment: str
    confidence_level: str
    rules_version: str = Field(
        description="Version of the advisory rule set (ai_drews.advisory.RULES_VERSION)"
    )
    provenance: ForecastProvenance
