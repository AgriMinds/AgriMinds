from fastapi import APIRouter, Query, HTTPException
from app.schemas.drought import DroughtMapResponse, CellRiskQuery, GridCellRisk
from app.services.inference_service import model_service
from app.core.config import settings

router = APIRouter(prefix="/drought", tags=["Drought Early Warning"])

@router.get("/map", response_model=DroughtMapResponse)
async def get_drought_map(
    lead_month: int = Query(1, ge=1, le=3, description="Forecast lead time (1, 2, or 3 months)")
):
    try:
        return model_service.get_drought_map(lead_month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate drought map: {str(e)}")

@router.post("/cell", response_model=GridCellRisk)
async def get_cell_risk(query: CellRiskQuery):
    try:
        P = model_service.get_latest_risk_probabilities()
        lead_idx = max(0, min(query.lead_month - 1, settings.DROUGHT_LEADS - 1))
        
        # If row and col provided directly
        if query.row is not None and query.col is not None:
            r = min(max(0, query.row), settings.GRID_ROWS - 1)
            c = min(max(0, query.col), settings.GRID_COLS - 1)
        elif query.latitude is not None and query.longitude is not None:
            lon_min, lat_min, lon_max, lat_max = settings.BBOX
            # Map lat/lon to grid indices
            lat_clamped = min(max(lat_min, query.latitude), lat_max)
            lon_clamped = min(max(lon_min, query.longitude), lon_max)
            r = int((lat_max - lat_clamped) / (lat_max - lat_min) * (settings.GRID_ROWS - 1))
            c = int((lon_clamped - lon_min) / (lon_max - lon_min) * (settings.GRID_COLS - 1))
        else:
            r, c = settings.GRID_ROWS // 2, settings.GRID_COLS // 2

        val = float(P[lead_idx, r, c])
        lon_min, lat_min, lon_max, lat_max = settings.BBOX
        lat_step = (lat_max - lat_min) / settings.GRID_ROWS
        lon_step = (lon_max - lon_min) / settings.GRID_COLS
        cell_lat = lat_max - (r + 0.5) * lat_step
        cell_lon = lon_min + (c + 0.5) * lon_step
        risk = "Low" if val < 0.25 else ("Moderate" if val < 0.45 else ("High" if val < 0.65 else "Severe"))

        return GridCellRisk(
            row=r,
            col=c,
            latitude=round(cell_lat, 4),
            longitude=round(cell_lon, 4),
            probability=round(val, 3),
            risk_level=risk
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query cell risk: {str(e)}")
