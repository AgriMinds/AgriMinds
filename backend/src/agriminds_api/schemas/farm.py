from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from agriminds_api.schemas.advisory import AdvisoryResponse
from agriminds_api.schemas.auth import WoredaOut
from agriminds_api.schemas.common import CropName, PdsiCategoryName, RiskLevelName


class FarmRisk(BaseModel):
    """Forecast risk for the plot's cell, plus how dry that ground already is.

    The two are different quantities: ``probability`` is a likelihood for the target month,
    ``pdsi`` is a measurement for the issue month. Clients must label them separately.
    """

    lead_month: int
    probability: float = Field(ge=0, le=1, description="Chance of seasonal drought at the target month")
    risk_level: RiskLevelName
    pdsi: float | None = Field(None, description="Observed Sc-PDSI for the issue month")
    pdsi_category: PdsiCategoryName | None = Field(None, description="Drought intensity band (Table 2)")


class FarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    latitude: float
    longitude: float
    grid_row: int
    grid_col: int
    area_hectares: float
    primary_crop: CropName
    woreda: WoredaOut | None = None
    created_at: datetime
    risk: FarmRisk | None = Field(None, description="Current risk for this plot; null when the model is down")


class FarmCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    area_hectares: float = Field(gt=0, le=10000)
    primary_crop: CropName = "tef"
    woreda_id: uuid.UUID | None = None


class FarmUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    area_hectares: float | None = Field(None, gt=0, le=10000)
    primary_crop: CropName | None = None
    woreda_id: uuid.UUID | None = None


class FarmAdvisoryOut(AdvisoryResponse):
    """An advisory plus the delivery record it was logged against, so the farmer can acknowledge it."""

    record_id: uuid.UUID
    acknowledged_at: datetime | None = None
