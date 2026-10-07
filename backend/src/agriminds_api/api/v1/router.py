from fastapi import APIRouter, Depends

from agriminds_api.api.v1 import advisory, drought, enso, health
from agriminds_api.core.security import require_api_key
from agriminds_api.schemas.common import ErrorResponse

api_router = APIRouter()
api_router.include_router(health.router)

_protected = APIRouter(
    dependencies=[Depends(require_api_key)],
    responses={
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse, "description": "Model unavailable"},
    },
)
_protected.include_router(drought.router)
_protected.include_router(advisory.router)
_protected.include_router(enso.router)
api_router.include_router(_protected)
