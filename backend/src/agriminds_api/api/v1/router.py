from fastapi import APIRouter, Depends

from agriminds_api.api.deps import require_metered_principal
from agriminds_api.api.v1 import (
    access_requests,
    advisory,
    analytics,
    auth,
    billing,
    crop_yield,
    dashboard,
    drought,
    enso,
    farms,
    geo,
    health,
    horizon,
    messaging,
    metrics,
    organizations,
    plans,
    subscriptions,
    system,
)
from agriminds_api.schemas.common import ErrorResponse

api_router = APIRouter()

# Public: liveness/readiness, sign-in, and map geometry (which carries no readings — a BI tool
# fetching a choropleth's polygons cannot present a credential).
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(geo.router)
# A sales enquiry from somebody who has never signed in. The only unauthenticated write.
api_router.include_router(access_requests.public_router)

# Forecast data: a signed-in person or a trusted service (X-API-Key).
_forecast = APIRouter(
    dependencies=[Depends(require_metered_principal)],
    responses={
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse, "description": "Monthly API quota spent"},
        503: {"model": ErrorResponse, "description": "Model unavailable"},
    },
)
_forecast.include_router(drought.router)
_forecast.include_router(horizon.router)
_forecast.include_router(advisory.router)
_forecast.include_router(enso.router)
_forecast.include_router(crop_yield.router)
_forecast.include_router(metrics.router)
api_router.include_router(_forecast)

# Per-person data: a signed-in user only; each router enforces its own role.
_private = APIRouter(
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse, "description": "Role not allowed"},
    },
)
_private.include_router(farms.router)
_private.include_router(access_requests.farmer_router)
_private.include_router(access_requests.admin_router)
_private.include_router(dashboard.router)
_private.include_router(analytics.router)
_private.include_router(system.router)
_private.include_router(billing.router)
_private.include_router(organizations.router)
_private.include_router(subscriptions.router)
_private.include_router(plans.router)
_private.include_router(plans.admin_router)
_private.include_router(messaging.router)
api_router.include_router(_private)
