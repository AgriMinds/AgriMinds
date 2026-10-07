import pandas as pd
from fastapi import APIRouter, HTTPException
from app.schemas.advisory import AdvisoryRequest, AdvisoryResponse
from app.services.inference_service import model_service
from app.services.advisory_service import AdvisoryService
from app.core.config import settings

router = APIRouter(prefix="/advisories", tags=["Agro-Decision Support"])

@router.post("/evaluate", response_model=AdvisoryResponse)
async def evaluate_advisory(req: AdvisoryRequest):
    try:
        P = model_service.get_latest_risk_probabilities()
        lead_idx = max(0, min(req.lead_month - 1, settings.DROUGHT_LEADS - 1))
        
        # Determine row and col
        if req.row is not None and req.col is not None:
            r = min(max(0, req.row), settings.GRID_ROWS - 1)
            c = min(max(0, req.col), settings.GRID_COLS - 1)
        elif req.latitude is not None and req.longitude is not None:
            lon_min, lat_min, lon_max, lat_max = settings.BBOX
            lat_clamped = min(max(lat_min, req.latitude), lat_max)
            lon_clamped = min(max(lon_min, req.longitude), lon_max)
            r = int((lat_max - lat_clamped) / (lat_max - lat_min) * (settings.GRID_ROWS - 1))
            c = int((lon_clamped - lon_min) / (lon_max - lon_min) * (settings.GRID_COLS - 1))
        else:
            r, c = settings.GRID_ROWS // 2, settings.GRID_COLS // 2

        raw_prob = float(P[lead_idx, r, c])

        # Get latest Nino3.4 value or forecast
        nino34 = 0.0
        if model_service.fc is not None and len(model_service.fc) > 0 and model_service.fc.any():
            nino34 = float(model_service.fc[-1, lead_idx])
        elif model_service.F is not None and "nino" in model_service.F:
            nino34 = float(model_service.F["nino"][-1])

        # Target month calculation
        issue_date_str = str(model_service.dates[-1]) if model_service.dates else "2026-06-01"
        target_date = pd.to_datetime(issue_date_str) + pd.DateOffset(months=req.lead_month)
        target_month = target_date.month

        advisory = AdvisoryService.generate_advisory(
            req=req,
            raw_prob=raw_prob,
            nino34=nino34,
            target_month=target_month
        )
        return advisory
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advisory generation failed: {str(e)}")
