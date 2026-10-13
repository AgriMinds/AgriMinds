"""Advisory delivery credits. Administrators only."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import SessionDep, require_admin
from agriminds_api.schemas.messaging import (
    BundleOut,
    BundlePurchase,
    CreditBalance,
    DeliveryOut,
    DeliveryRequest,
)
from agriminds_api.services.messaging import MessagingService

router = APIRouter(prefix="/messaging", tags=["Messaging"], dependencies=[Depends(require_admin)])


@router.post(
    "/bundles",
    response_model=BundleOut,
    status_code=201,
    summary="Sell an account a bundle of advisory messages",
    description=(
        "Credits are priced per message and the rate is frozen on the bundle, so a later price "
        "change cannot restate a sale that already happened."
    ),
)
async def purchase(req: BundlePurchase, session: SessionDep) -> BundleOut:
    return await MessagingService(session).purchase(req)


@router.get(
    "/{organization_id}/balance",
    response_model=CreditBalance,
    summary="Credits bought, spent and left",
    description=(
        "Derived on every read from the bundles and the deliveries, never stored, so the figure "
        "cannot drift from the rows that justify it. A failed message is not charged for.\n\n"
        "`deliverable` is false while no aggregator is configured: messages are recorded and "
        "queued, and nothing is actually sent."
    ),
)
async def balance(organization_id: uuid.UUID, session: SessionDep) -> CreditBalance:
    return await MessagingService(session).balance(organization_id)


@router.post(
    "/deliveries",
    response_model=DeliveryOut,
    status_code=201,
    summary="Queue one advisory for delivery",
    description="Refused with 409 when the account has no credits left.",
)
async def queue(req: DeliveryRequest, session: SessionDep) -> DeliveryOut:
    return await MessagingService(session).queue(req)


@router.get(
    "/{organization_id}/deliveries",
    response_model=list[DeliveryOut],
    summary="What has been queued or sent for this account",
)
async def deliveries(
    organization_id: uuid.UUID, session: SessionDep, limit: int = Query(50, ge=1, le=500)
) -> list[DeliveryOut]:
    return await MessagingService(session).deliveries(organization_id, limit)
