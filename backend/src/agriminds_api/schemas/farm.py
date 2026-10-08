from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from agriminds_api.schemas.auth import WoredaOut
from agriminds_api.schemas.common import CropName, RiskLevelName


class FarmRisk(BaseModel):
    lead_month: int
    probability: float = Field(ge=0, le=1)
    risk_level: RiskLevelName


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
