from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

class GridCellRisk(BaseModel):
    row: int
    col: int
    latitude: float
    longitude: float
    probability: float
    risk_level: str

class DroughtMapResponse(BaseModel):
    lead_month: int
    target_date: str
    issued_date: str
    grid_shape: Tuple[int, int]
    bbox: Tuple[float, float, float, float]
    mean_probability: float
    min_probability: float
    max_probability: float
    probabilities: List[List[float]]
    cells: List[GridCellRisk]

class CellRiskQuery(BaseModel):
    row: Optional[int] = Field(None, ge=0, le=7)
    col: Optional[int] = Field(None, ge=0, le=7)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lead_month: int = Field(1, ge=1, le=3)
