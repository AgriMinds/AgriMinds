"""What the platform is built from."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from agriminds_api.api.deps import StaffUser, get_app_settings, get_inference
from agriminds_api.core.config import Settings
from agriminds_api.schemas.provenance import DataInventory
from agriminds_api.services.inference import InferenceService
from agriminds_api.services.provenance import ProvenanceService

router = APIRouter(prefix="/system", tags=["System"])


@router.get(
    "/data-sources",
    response_model=DataInventory,
    summary="Which inputs are actually supplying this deployment",
    description=(
        "Derived from the files and model metadata present, not from a fixed list, so a source "
        "cannot be reported as connected once it has been removed."
    ),
)
def data_sources(
    request: Request,
    user: StaffUser,
    settings: Settings = Depends(get_app_settings),
    inference: InferenceService = Depends(get_inference),
) -> DataInventory:
    return ProvenanceService(settings, inference).inventory()
