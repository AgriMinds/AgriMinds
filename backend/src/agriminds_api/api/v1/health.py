from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import text

from agriminds_api import __version__
from agriminds_api.api.deps import get_app_settings, get_inference
from agriminds_api.core.config import Settings
from agriminds_api.schemas.health import CacheStatus, DatabaseStatus, HealthResponse, ModelStatus
from agriminds_api.services.inference import InferenceService

router = APIRouter(tags=["System"])


async def _db_status(request: Request) -> DatabaseStatus:
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        return DatabaseStatus(configured=False, reachable=False)
    try:
        async with factory() as session:
            await session.execute(text("SELECT 1"))
        return DatabaseStatus(configured=True, reachable=True)
    except Exception:  # noqa: BLE001 - health must never raise
        return DatabaseStatus(configured=True, reachable=False)


def _health(request: Request, inference: InferenceService, settings: Settings, database: DatabaseStatus) -> HealthResponse:
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
    if art is not None and database.reachable:
        overall = "healthy"
    elif inference.available or database.reachable:
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
        database=database,
    )


@router.get(
    "/health", response_model=HealthResponse, summary="Liveness: process is up (200 even when degraded)"
)
async def health(
    request: Request,
    inference: InferenceService = Depends(get_inference),
    settings: Settings = Depends(get_app_settings),
) -> HealthResponse:
    return _health(request, inference, settings, await _db_status(request))


@router.get(
    "/health/ready", response_model=HealthResponse, summary="Readiness: 503 until forecasts can be served"
)
async def ready(
    request: Request,
    response: Response,
    inference: InferenceService = Depends(get_inference),
    settings: Settings = Depends(get_app_settings),
) -> HealthResponse:
    body = _health(request, inference, settings, await _db_status(request))
    if body.status != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return body
