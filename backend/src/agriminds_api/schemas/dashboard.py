"""Response shapes for the two role dashboards.

Every count in these models is read from the database; nothing is estimated or illustrative.
Risk figures come from the live model and carry the same `provenance` block as the raw forecast
endpoints, so a demonstration model can never be mistaken for an operational one.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from agriminds_api.schemas.advisory import AdvisoryResponse
from agriminds_api.schemas.auth import UserOut
from agriminds_api.schemas.common import CropName, ForecastProvenance, RiskLevelName
from agriminds_api.schemas.farm import FarmOut


# ------------------------------------------------------------------ farmer
class FarmerDashboard(BaseModel):
    user: UserOut
    farms: list[FarmOut]
    advisory: AdvisoryResponse | None = Field(None, description="Advisory for the highest-risk plot")
    advisory_farm_id: uuid.UUID | None = None
    enso_state: str | None = None
    enso_summary: str | None = None
    provenance: ForecastProvenance | None = None


# ------------------------------------------------------------------ ministry
class CoverageStats(BaseModel):
    farmers: int
    agents: int
    active_farmers_30d: int = Field(description="Farmers who signed in within the last 30 days")
    farms: int
    hectares: float
    woredas_covered: int
    woredas_total: int


class RiskBucket(BaseModel):
    risk_level: RiskLevelName
    farms: int
    farmers: int
    hectares: float


class RiskExposure(BaseModel):
    lead_month: int
    target_date: str
    buckets: list[RiskBucket]
    farms_at_risk: int = Field(description="Plots in a High or Severe cell")
    farmers_at_risk: int
    hectares_at_risk: float


class WoredaRisk(BaseModel):
    woreda_id: uuid.UUID
    name_en: str
    name_am: str
    name_om: str
    zone_name_en: str
    farmers: int
    farms: int
    hectares: float
    mean_probability: float
    worst_risk_level: RiskLevelName


class CropMixEntry(BaseModel):
    crop: CropName
    farms: int
    hectares: float
    farms_at_risk: int


class AdvisoryDelivery(BaseModel):
    issued_total: int
    issued_30d: int
    acknowledged_30d: int
    acknowledgement_rate: float | None = Field(
        None, description="null until at least one advisory has been issued in the window"
    )


class MinistryDashboard(BaseModel):
    generated_at: datetime
    scope: str = Field(description="Whole watershed, or the woreda an agent is assigned to")
    coverage: CoverageStats
    exposure: RiskExposure | None = Field(None, description="null when the forecast model is unavailable")
    by_woreda: list[WoredaRisk]
    crop_mix: list[CropMixEntry]
    advisories: AdvisoryDelivery
    provenance: ForecastProvenance | None = None
