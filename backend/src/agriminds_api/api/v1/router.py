from fastapi import APIRouter, Depends

from agriminds_api.api.deps import require_principal
from agriminds_api.api.v1 import (
    advisory,
    analytics,
    auth,
    dashboard,
    drought,
    enso,
    farms,
    health,
    system,
)
from agriminds_api.schemas.common import ErrorResponse

api_router = APIRouter()

# Public: liveness/readiness and the sign-in endpoints.
api_router.include_router(health.router)
api_router.include_router(auth.router)

# Forecast data: a signed-in person or a trusted service (X-API-Key).
_forecast = APIRouter(
    dependencies=[Depends(require_principal)],
    responses={
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse, "description": "Model unavailable"},
    },
)
_forecast.include_router(drought.router)
_forecast.include_router(advisory.router)
_forecast.include_router(enso.router)
api_router.include_router(_forecast)

# Per-person data: a signed-in user only; each router enforces its own role.
_private = APIRouter(
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse, "description": "Role not allowed"},
    },
)
_private.include_router(farms.router)
_private.include_router(dashboard.router)
_private.include_router(analytics.router)
_private.include_router(system.router)
api_router.include_router(_private)
