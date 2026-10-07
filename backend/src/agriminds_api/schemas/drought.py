from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from agriminds_api.schemas.common import ForecastProvenance, RiskLevelName


class GridCellRisk(BaseModel):
    row: int
    col: int
    latitude: float
    longitude: float
    probability: float = Field(ge=0, le=1)
    risk_level: RiskLevelName


class DroughtMapResponse(BaseModel):
    lead_month: int
    target_date: str = Field(description="Target month, e.g. 'July 2026'")
    issued_date: str = Field(description="Issue month, e.g. 'June 2026'")
    grid_shape: tuple[int, int]
    bbox: tuple[float, float, float, float] = Field(description="lon_min, lat_min, lon_max, lat_max")
    mean_probability: float
    min_probability: float
    max_probability: float
    probabilities: list[list[float]]
    cells: list[GridCellRisk]
    provenance: ForecastProvenance


class CellRiskQuery(BaseModel):
    """Either (row, col) or (latitude, longitude). Neither -> watershed centre cell."""

    lead_month: int = Field(1, ge=1, le=3)
    row: int | None = Field(None, ge=0)
    col: int | None = Field(None, ge=0)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def _pairs(self) -> CellRiskQuery:
        if (self.row is None) != (self.col is None):
            raise ValueError("row and col must be provided together")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class CellRiskResponse(GridCellRisk):
    lead_month: int
    provenance: ForecastProvenance
