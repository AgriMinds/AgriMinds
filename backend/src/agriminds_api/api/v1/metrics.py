"""Model-performance metrics: how well the drought and ENSO models scored on held-out data."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.metrics import ModelMetricsResponse
from agriminds_api.services.inference import InferenceService
from agriminds_api.services.metrics import MetricsService

router = APIRouter(prefix="/drought", tags=["Drought Early Warning"])


def _get_metrics_service(request: Request) -> MetricsService:
    settings: Settings = request.app.state.settings
    inference: InferenceService = request.app.state.inference
    return MetricsService(settings, inference)


@router.get(
    "/metrics",
    response_model=ModelMetricsResponse,
    responses={503: {"model": ErrorResponse, "description": "No trained model is loaded"}},
    summary="CNN-LSTM drought model performance metrics vs baselines",
    description=(
        "Returns the full set of evaluation metrics produced at training time:\n\n"
        "- **drought**: per-lead classification metrics for the drought model "
        "(AUC, Brier Score, BSS vs climatology, POD, FAR) with the persistence baseline AUC.\n"
        "- **enso**: per-model regression metrics (RMSE, MAE, correlation) for the ENSO "
        "CNN-LSTM, a Persistence baseline, and a Ridge baseline, across all twelve leads.\n\n"
        "These figures were measured once on held-out data at training time and are served "
        "unchanged. Nothing here is re-derived at request time."
    ),
)
def model_metrics(
    service: MetricsService = Depends(_get_metrics_service),
) -> ModelMetricsResponse:
    return service.metrics()
