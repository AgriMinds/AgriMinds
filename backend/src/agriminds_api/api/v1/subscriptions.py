"""Signed agreements and what they earn. Administrators only."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import SessionDep, require_admin
from agriminds_api.schemas.subscription import RevenueSummary, SubscriptionCreate, SubscriptionOut
from agriminds_api.services.subscription import SubscriptionService

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"], dependencies=[Depends(require_admin)])


@router.get(
    "",
    response_model=list[SubscriptionOut],
    summary="Institutional agreements on record",
    description=(
        "Individual farmer premiums are left out unless asked for: there is one per farmer, and a "
        "list that mixes them in with institutional licences stops being a list of accounts. They "
        "are counted in `/subscriptions/revenue` either way."
    ),
)
async def list_subscriptions(
    session: SessionDep,
    organization_id: uuid.UUID | None = Query(None, description="Limit to one account"),
    individuals: bool = Query(False, description="Include farmers who bought premium themselves"),
) -> list[SubscriptionOut]:
    return await SubscriptionService(session).list(organization_id=organization_id, individuals=individuals)


@router.post(
    "",
    response_model=SubscriptionOut,
    status_code=201,
    summary="Record that an account agreed to a rate",
    description=(
        "The rate is taken from the tier in force for the account's stakeholder type and **copied "
        "onto the agreement**, together with the tier version it came from. Repricing the "
        "catalogue afterwards therefore changes what new customers pay and leaves this one alone."
        "\n\nSupply `unit_price_cents` only for a negotiated price; leaving it out is the normal "
        "case and takes the list rate."
    ),
)
async def create_subscription(req: SubscriptionCreate, session: SessionDep) -> SubscriptionOut:
    return await SubscriptionService(session).create(req)


@router.delete(
    "/{subscription_id}",
    response_model=SubscriptionOut,
    summary="End an agreement",
    description="The row is kept: it is what the account was charged for the term it ran.",
)
async def end_subscription(
    subscription_id: uuid.UUID,
    session: SessionDep,
    on: dt.date | None = Query(None, description="Defaults to today"),
) -> SubscriptionOut:
    return await SubscriptionService(session).end(subscription_id, on or dt.date.today())


@router.get(
    "/revenue",
    response_model=RevenueSummary,
    summary="What the platform actually earns",
    description=(
        "Counted from agreements that are live on the day asked about — not from the price list. "
        "The catalogue total on the pricing page is what one of everything would fetch if it all "
        "sold; this is what is owed.\n\n"
        "A perpetual licence contributes **nothing** to ARR, because it recurs never. Its one-off "
        "value is reported separately so it cannot be mistaken for recurring revenue."
    ),
)
async def revenue(
    session: SessionDep,
    as_of: dt.date | None = Query(None, description="Defaults to today"),
) -> RevenueSummary:
    return await SubscriptionService(session).revenue(as_of=as_of)
