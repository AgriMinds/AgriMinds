from fastapi import APIRouter, HTTPException
from app.schemas.enso import EnsoOutlookResponse
from app.services.inference_service import model_service

router = APIRouter(prefix="/enso", tags=["Climate Engine"])

@router.get("/outlook", response_model=EnsoOutlookResponse)
async def get_enso_outlook():
    try:
        return model_service.get_enso_outlook()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch ENSO outlook: {str(e)}")
