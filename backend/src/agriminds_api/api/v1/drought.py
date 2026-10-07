"""Handlers are plain `def`: FastAPI runs them in a threadpool so CPU-bound inference never blocks the loop."""

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import get_drought
from agriminds_api.schemas.drought import CellRiskQuery, CellRiskResponse, DroughtMapResponse
from agriminds_api.services.drought import DroughtService

router = APIRouter(prefix="/drought", tags=["Drought Early Warning"])

LeadMonth = Query(1, ge=1, le=3, description="Forecast lead time (1, 2 or 3 months)")


@router.get("/map", response_model=DroughtMapResponse, summary="Gridded drought probability for one lead")
def drought_map(
    lead_month: int = LeadMonth, service: DroughtService = Depends(get_drought)
) -> DroughtMapResponse:
    return service.map(lead_month)


@router.get("/cell", response_model=CellRiskResponse, summary="Risk for one cell by row/col or GPS")
def cell_risk(
    lead_month: int = LeadMonth,
    row: int | None = Query(None, ge=0),
    col: int | None = Query(None, ge=0),
    latitude: float | None = Query(None, ge=-90, le=90),
    longitude: float | None = Query(None, ge=-180, le=180),
    service: DroughtService = Depends(get_drought),
) -> CellRiskResponse:
    return service.cell(
        CellRiskQuery(lead_month=lead_month, row=row, col=col, latitude=latitude, longitude=longitude)
    )


@router.post("/cell", response_model=CellRiskResponse, summary="Risk for one cell (JSON body)")
def cell_risk_post(query: CellRiskQuery, service: DroughtService = Depends(get_drought)) -> CellRiskResponse:
    return service.cell(query)
