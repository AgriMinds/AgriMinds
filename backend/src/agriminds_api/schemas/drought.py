from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from agriminds_api.schemas.common import ForecastProvenance, PdsiCategoryName, RiskLevelName


class GridCellRisk(BaseModel):
    row: int
    col: int
    latitude: float
    longitude: float
    probability: float = Field(ge=0, le=1)
    risk_level: RiskLevelName
    pdsi: float | None = Field(None, description="Observed self-calibrated Palmer index for the issue month")
    pdsi_category: PdsiCategoryName | None = Field(
        None, description="Drought intensity band for `pdsi` (Table 2)"
    )


class ObservedConditions(BaseModel):
    """How dry the ground already is, as opposed to how likely drought is next season."""

    index: str = Field("scpdsi", description="Self-calibrated Palmer Drought Severity Index")
    as_of: str = Field(description="Month the observation refers to, e.g. 'June 2026'")
    mean: float
    category: PdsiCategoryName = Field(description="Band for the basin mean")
    driest_category: PdsiCategoryName = Field(description="Worst band present anywhere in the basin")
    cells_in_drought: int = Field(description="Cells in any of the three dry bands")
    classification_version: str
    citation: str
    method_note: str


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
    conditions: ObservedConditions | None = Field(
        None, description="Observed Sc-PDSI; null when the record carries no mean temperature"
    )
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
