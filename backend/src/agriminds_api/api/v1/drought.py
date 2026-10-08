"""Handlers are plain `def`: FastAPI runs them in a threadpool so CPU-bound inference never blocks the loop."""

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import get_drought
from agriminds_api.core.exceptions import NotFoundError
from agriminds_api.schemas.drought import (
    CellRiskQuery,
    CellRiskResponse,
    DroughtMapResponse,
    WatershedBoundary,
)
from agriminds_api.services.drought import DroughtService

router = APIRouter(prefix="/drought", tags=["Drought Early Warning"])

LeadMonth = Query(1, ge=1, le=3, description="Forecast lead time (1, 2 or 3 months)")


@router.get("/map", response_model=DroughtMapResponse, summary="Gridded drought probability for one lead")
def drought_map(
    lead_month: int = LeadMonth, service: DroughtService = Depends(get_drought)
) -> DroughtMapResponse:
    return service.map(lead_month)


@router.get(
    "/watershed",
    response_model=WatershedBoundary,
    summary="The surveyed catchment outline and which grid cells fall inside it",
    description=(
        "Lets a map draw the real catchment instead of a bare rectangle, and grey out the cells "
        "that are not part of it. The outline is simplified for display; the server keeps the "
        "full-precision version for deciding whether a plot is inside."
    ),
)
def watershed(service: DroughtService = Depends(get_drought)) -> WatershedBoundary:
    outline = service.boundary()
    if outline is None:
        raise NotFoundError("No surveyed catchment boundary is configured on this deployment.")
    return outline


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
