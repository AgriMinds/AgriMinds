from typing import List
from pydantic import BaseModel

class EnsoPoint(BaseModel):
    date: str
    nino34: float
    is_forecast: bool = False

class EnsoOutlookResponse(BaseModel):
    current_nino34: float
    current_state: str  # El Nino, La Nina, Neutral
    forecast_horizon_months: int
    historical_series: List[EnsoPoint]
    forecast_series: List[EnsoPoint]
    teleconnection_summary: str
