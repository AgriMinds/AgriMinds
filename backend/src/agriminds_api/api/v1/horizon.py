"""How far ahead the forecast is trustworthy, lead by lead."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from agriminds_api.api.deps import get_horizon
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.horizon import HorizonResponse
from agriminds_api.services.horizon import HorizonService

router = APIRouter(prefix="/drought", tags=["Drought"])


@router.get(
    "/horizon",
    response_model=HorizonResponse,
    responses={503: {"model": ErrorResponse, "description": "No trained model is loaded"}},
    summary="The full forecast horizon, and what each lead is worth",
    description=(
        "Every lead the model was trained for, each marked `forecast` or `outlook`. A forecast "
        "carries a probability and is published only where it was measured to beat climatology "
        "on held-out data; an outlook carries a direction and never a number. The measured "
        "skill travels with each lead so a client can show it rather than imply it."
    ),
)
def horizon(service: HorizonService = Depends(get_horizon)) -> HorizonResponse:
    return service.horizon()
