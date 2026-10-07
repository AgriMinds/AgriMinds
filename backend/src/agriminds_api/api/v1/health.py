from fastapi import APIRouter, Depends, Request, Response, status

from agriminds_api import __version__
from agriminds_api.api.deps import get_app_settings, get_inference
from agriminds_api.core.config import Settings
from agriminds_api.schemas.health import CacheStatus, HealthResponse, ModelStatus
from agriminds_api.services.inference import InferenceService

router = APIRouter(tags=["System"])


def _health(request: Request, inference: InferenceService, settings: Settings) -> HealthResponse:
    art = inference.artifacts
    cache = request.app.state.cache
    model = ModelStatus(
        loaded=art is not None,
        source=inference.source.value if inference.source else "unavailable",
        model_version=art.model_version if art else None,
        data_source=art.data_source if art else None,
        issued_date=art.issued_date if art else None,
        enso_forecast_available=bool(art and art.latest_enso_forecast() is not None),
    )
    if art is not None:
        overall = "healthy"
    elif inference.available:
        overall = "degraded"
    else:
        overall = "unavailable"
    return HealthResponse(
        status=overall,
        service=settings.project_name,
        version=__version__,
        environment=settings.env,
        auth_enabled=settings.auth_enabled,
        model=model,
        cache=CacheStatus(backend=cache.backend, reachable=cache.ping()),
    )


@router.get(
    "/health", response_model=HealthResponse, summary="Liveness: process is up (200 even when degraded)"
)
def health(
    request: Request,
    inference: InferenceService = Depends(get_inference),
    settings: Settings = Depends(get_app_settings),
) -> HealthResponse:
    return _health(request, inference, settings)


@router.get(
    "/health/ready", response_model=HealthResponse, summary="Readiness: 503 until forecasts can be served"
)
def ready(
    request: Request,
    response: Response,
    inference: InferenceService = Depends(get_inference),
    settings: Settings = Depends(get_app_settings),
) -> HealthResponse:
    body = _health(request, inference, settings)
    if body.status == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return body
