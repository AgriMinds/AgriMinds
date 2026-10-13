"""The commercial rate card. Administrators only — it is what the platform charges, not science."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import SessionDep, require_admin
from agriminds_api.db.models import StakeholderType
from agriminds_api.schemas.billing import PricingCatalogue, PricingTierChange, PricingTierOut
from agriminds_api.services.billing import BillingService

router = APIRouter(prefix="/billing", tags=["Billing"], dependencies=[Depends(require_admin)])


@router.get(
    "/pricing",
    response_model=PricingCatalogue,
    summary="What every stakeholder pays",
    description=(
        "The price in force for each of the eight stakeholder types, with every rate given both "
        "as integer cents and as a rendered decimal so a client never divides money itself.\n\n"
        "Pass `include_history=true` to get superseded versions alongside the current ones. A "
        "price is never edited in place: changing one closes its window and opens a new row, so "
        "a subscription signed last year still resolves to the rate it was signed at."
    ),
)
async def pricing(
    session: SessionDep,
    include_history: bool = Query(False, description="Include superseded versions"),
) -> PricingCatalogue:
    return await BillingService(session).catalogue(include_history=include_history)


@router.get(
    "/pricing/{stakeholder}",
    response_model=list[PricingTierOut],
    summary="Every price this stakeholder has ever been charged, newest first",
)
async def pricing_history(stakeholder: StakeholderType, session: SessionDep) -> list[PricingTierOut]:
    return await BillingService(session).history(stakeholder)


@router.post(
    "/pricing/{stakeholder}",
    response_model=PricingTierOut,
    status_code=201,
    summary="Reprice a stakeholder from a given date",
    description=(
        "Writes a new version rather than editing the current one. `effective_from` must fall "
        "after the date the price in force started; set it in the future to schedule a change."
    ),
)
async def reprice(
    stakeholder: StakeholderType, req: PricingTierChange, session: SessionDep
) -> PricingTierOut:
    return await BillingService(session).change(stakeholder, req)
