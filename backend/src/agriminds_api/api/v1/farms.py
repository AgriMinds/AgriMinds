"""A farmer's own plots."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Response, status

from agriminds_api.api.deps import DashboardServiceDep, FarmerUser, FarmServiceDep
from agriminds_api.schemas.advisory import AdvisoryRequest
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.farm import FarmAdvisoryOut, FarmCreate, FarmOut, FarmUpdate

router = APIRouter(prefix="/farms", tags=["Farms"])

LeadMonth = Query(1, ge=1, le=3, description="Forecast lead time used for the attached risk")


@router.get("", response_model=list[FarmOut], summary="List your plots with their current risk")
async def list_farms(user: FarmerUser, service: FarmServiceDep, lead_month: int = LeadMonth) -> list[FarmOut]:
    return await service.list_for_owner(user, lead_month)


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED, summary="Register a plot")
async def create_farm(
    payload: FarmCreate, user: FarmerUser, service: FarmServiceDep, lead_month: int = LeadMonth
) -> FarmOut:
    return await service.create(user, payload, lead_month)


@router.get(
    "/{farm_id}",
    response_model=FarmOut,
    responses={404: {"model": ErrorResponse}},
    summary="One of your plots",
)
async def get_farm(
    farm_id: uuid.UUID, user: FarmerUser, service: FarmServiceDep, lead_month: int = LeadMonth
) -> FarmOut:
    farm = await service.get_owned(user, farm_id)
    return service.to_out(farm, service._cube(), lead_month)  # noqa: SLF001 - same module boundary


@router.patch(
    "/{farm_id}",
    response_model=FarmOut,
    responses={404: {"model": ErrorResponse}},
    summary="Update a plot",
)
async def update_farm(
    farm_id: uuid.UUID,
    payload: FarmUpdate,
    user: FarmerUser,
    service: FarmServiceDep,
    lead_month: int = LeadMonth,
) -> FarmOut:
    return await service.update(user, farm_id, payload, lead_month)


@router.delete(
    "/{farm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
    summary="Remove a plot",
)
async def delete_farm(farm_id: uuid.UUID, user: FarmerUser, service: FarmServiceDep) -> Response:
    await service.delete(user, farm_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{farm_id}/advisory",
    response_model=FarmAdvisoryOut,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Crop advisory for one plot (recorded for delivery reporting)",
)
async def farm_advisory(
    farm_id: uuid.UUID,
    user: FarmerUser,
    farms: FarmServiceDep,
    dashboard: DashboardServiceDep,
    lead_month: int = LeadMonth,
    crop: str | None = Query(None, description="Defaults to the plot's primary crop"),
) -> FarmAdvisoryOut:
    farm = await farms.get_owned(user, farm_id)
    advisory = dashboard._advisory.evaluate(  # noqa: SLF001 - request-scoped composition
        AdvisoryRequest(
            crop=crop or farm.primary_crop.value,
            lead_month=lead_month,
            row=farm.grid_row,
            col=farm.grid_col,
        )
    )
    record = await dashboard.record_advisory(user, farm.id, advisory)
    return FarmAdvisoryOut(
        **advisory.model_dump(), record_id=record.id, acknowledged_at=record.acknowledged_at
    )
