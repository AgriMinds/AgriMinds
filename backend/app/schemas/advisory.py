from typing import Literal, Optional
from pydantic import BaseModel, Field

class AdvisoryRequest(BaseModel):
    crop: Literal["tef", "wheat", "maize"] = Field("tef", description="Target staple crop")
    lead_month: int = Field(1, ge=1, le=3, description="Forecast lead time in months")
    row: Optional[int] = Field(4, ge=0, le=7, description="Watershed grid row index")
    col: Optional[int] = Field(4, ge=0, le=7, description="Watershed grid col index")
    latitude: Optional[float] = Field(None, description="Optional GPS latitude")
    longitude: Optional[float] = Field(None, description="Optional GPS longitude")
    iek_agrees: Optional[bool] = Field(None, description="Indigenous ecological knowledge consensus")

class AdvisoryResponse(BaseModel):
    crop: str
    lead_month: int
    raw_probability: float
    adjusted_probability: float
    risk_level: str
    season: str
    enso_state: str
    crop_note: str
    crop_recommendation: str
    planting_window: str
    water_management: str
    preparedness_action: str
    iek_assessment: str
    confidence_level: str
