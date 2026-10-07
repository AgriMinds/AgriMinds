from fastapi import APIRouter
from app.core.config import settings
from app.services.inference_service import model_service

router = APIRouter()

@router.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "artifacts_loaded": model_service.artifacts_loaded,
        "models": {
            "enso_cnnlstm": (settings.MODELS_DIR / "enso_cnnlstm.pt").exists(),
            "drought_superhybrid": (settings.MODELS_DIR / "drought_model.pt").exists()
        }
    }
