"""Crop-yield outlook. Handlers are plain `def`: FastAPI runs them in a threadpool."""

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import get_crop_yield
from agriminds_api.schemas.crop_yield import (
    CropYieldModelCard,
    CropYieldOutlook,
    CropYieldScenario,
    CropYieldScenarioRequest,
)
from agriminds_api.services.crop_yield import CropYieldService

router = APIRouter(prefix="/crop-yield", tags=["Crop Yield"])


@router.get(
    "/outlook",
    response_model=CropYieldOutlook,
    summary="Predicted yield for every crop and altitude belt",
    description=(
        "Yield in quintals per hectare for tef, wheat and maize across the Kolla, Woina Dega and "
        "Dega belts, conditioned on Niño 3.4 and on the last observed season.\n\n"
        "Each cell also carries the same prediction with the ENSO anomaly removed, because the "
        "model leans overwhelmingly on last year's yield: the two numbers side by side are the "
        "whole of its climate response. Pass `lead_month` to condition on the platform's own "
        "ENSO forecast instead of the last observed month.\n\n"
        "`year` defaults to the season after the crop record. The year is itself a fitted feature, "
        "so a year beyond the record adds no information — a gradient-boosted tree can only treat "
        "it as the last year it was trained on."
    ),
)
def outlook(
    year: int | None = Query(None, ge=1990, le=2100, description="Season to predict"),
    lead_month: int | None = Query(
        None, ge=1, le=12, description="Use the ENSO forecast at this lead instead of the last observation"
    ),
    service: CropYieldService = Depends(get_crop_yield),
) -> CropYieldOutlook:
    return service.outlook(year=year, lead_month=lead_month)


@router.post(
    "/simulate",
    response_model=CropYieldScenario,
    summary="What-if: one crop and belt under named climate inputs",
    description=(
        "Anything left out falls back to the last observed season. The lag features are always "
        "the observed ones: this is a scenario over climate, not over history."
    ),
)
def simulate(
    req: CropYieldScenarioRequest, service: CropYieldService = Depends(get_crop_yield)
) -> CropYieldScenario:
    return service.simulate(req)


@router.get(
    "/model",
    response_model=CropYieldModelCard,
    summary="Scores for all five candidates, what the model leans on, and its limits",
)
def model_card(service: CropYieldService = Depends(get_crop_yield)) -> CropYieldModelCard:
    return service.model_card()
