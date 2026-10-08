"""Role dashboards: one for the farmer, one for ministry staff."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import select

from agriminds_api.api.deps import DashboardServiceDep, FarmerUser, SessionDep, StaffUser
from agriminds_api.core.exceptions import NotFoundError
from agriminds_api.db.models import AdvisoryRecord, Farm
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.dashboard import FarmerDashboard, MinistryDashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboards"])

LeadMonth = Query(1, ge=1, le=3, description="Forecast lead time in months")


@router.get(
    "/farmer",
    response_model=FarmerDashboard,
    summary="Your plots, their risk and the advisory that needs attention first",
)
async def farmer_dashboard(
    user: FarmerUser, service: DashboardServiceDep, lead_month: int = LeadMonth
) -> FarmerDashboard:
    return await service.farmer(user, lead_month)


@router.get(
    "/ministry",
    response_model=MinistryDashboard,
    summary="Coverage, risk exposure and advisory delivery across the watershed",
    description=(
        "Every count comes from registered rows. A development agent sees only the woreda they "
        "are posted to; ministers and administrators see the whole watershed."
    ),
)
async def ministry_dashboard(
    user: StaffUser, service: DashboardServiceDep, lead_month: int = LeadMonth
) -> MinistryDashboard:
    return await service.ministry(user, lead_month)


@router.post(
    "/farmer/advisories/{advisory_id}/acknowledge",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorResponse}},
    summary="Confirm you have read an advisory (feeds the delivery figures)",
)
async def acknowledge(advisory_id: uuid.UUID, user: FarmerUser, session: SessionDep) -> Response:
    record = await session.scalar(
        select(AdvisoryRecord)
        .join(Farm, Farm.id == AdvisoryRecord.farm_id)
        .where(AdvisoryRecord.id == advisory_id, Farm.owner_id == user.id)
    )
    if record is None:
        raise NotFoundError("That advisory does not exist.")
    if record.acknowledged_at is None:
        record.acknowledged_at = datetime.now(UTC)
        await session.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
