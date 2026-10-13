"""Self-serve: a customer picks a plan and gets a bill for it."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from agriminds_api.api.deps import CurrentUser, SessionDep, SettingsDep, require_admin
from agriminds_api.core.exceptions import ForbiddenError
from agriminds_api.db.models import Organization
from agriminds_api.schemas.plan import (
    CheckoutResult,
    InvoiceOut,
    PaymentConfirmation,
    PlanChoice,
    PlanSet,
)
from agriminds_api.services.plan import PlanService

router = APIRouter(prefix="/plans", tags=["Plans"])
admin_router = APIRouter(prefix="/admin/invoices", tags=["Plans"], dependencies=[Depends(require_admin)])


async def _my_organization(user: CurrentUser, session: SessionDep) -> Organization:
    """The account this person buys for. A user with no organisation has nothing to subscribe."""
    if user.organization_id is None:
        raise ForbiddenError(
            "Your account is not linked to an organisation, so there is nothing to subscribe. "
            "Ask an administrator to connect you, or request access for your organisation."
        )
    org = await session.get(Organization, user.organization_id)
    if org is None:
        raise ForbiddenError("Your organisation is no longer active.")
    return org


@router.get(
    "",
    response_model=PlanSet,
    summary="The plans this account can choose from",
    description=(
        "Only the caller's own segment, because the price follows from it and a cooperative "
        "cannot buy at a research rate. Periods the tier does not sell are left out rather than "
        "shown as free, and each option carries what a year on it costs so the terms can be "
        "compared on one scale."
    ),
)
async def plans(user: CurrentUser, session: SessionDep, settings: SettingsDep) -> PlanSet:
    org = await _my_organization(user, session)
    return await PlanService(session, settings).plans(org)


@router.post(
    "",
    response_model=CheckoutResult,
    status_code=201,
    summary="Choose a plan",
    description=(
        "Creates the subscription as **pending payment** and issues an invoice against a "
        "reference to quote on a bank transfer. No money moves through this platform: the plan "
        "starts when an administrator confirms the payment, not when this call returns.\n\n"
        "The price is frozen at the moment of choosing, so a catalogue change between choosing "
        "and paying cannot restate the bill."
    ),
)
async def choose(
    choice: PlanChoice, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> CheckoutResult:
    org = await _my_organization(user, session)
    return await PlanService(session, settings).choose(org, choice)


@router.get("/invoices", response_model=list[InvoiceOut], summary="This account's bills")
async def my_invoices(user: CurrentUser, session: SessionDep, settings: SettingsDep) -> list[InvoiceOut]:
    org = await _my_organization(user, session)
    return await PlanService(session, settings).invoices(org.id)


@admin_router.get(
    "",
    response_model=list[InvoiceOut],
    summary="Everything still unpaid, soonest due first",
)
async def outstanding(session: SessionDep, settings: SettingsDep) -> list[InvoiceOut]:
    return await PlanService(session, settings).outstanding()


@admin_router.post(
    "/{invoice_id}/paid",
    response_model=InvoiceOut,
    summary="Confirm a payment arrived",
    description="Settles the bill and starts the subscription it paid for.",
)
async def confirm(
    invoice_id: uuid.UUID,
    confirmation: PaymentConfirmation,
    session: SessionDep,
    settings: SettingsDep,
) -> InvoiceOut:
    return await PlanService(session, settings).confirm_payment(invoice_id, confirmation)
