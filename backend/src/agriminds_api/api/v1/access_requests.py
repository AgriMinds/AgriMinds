"""The front door: enquiries in, decisions out."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from agriminds_api.api.deps import CurrentUser, FarmerUser, SessionDep, require_admin
from agriminds_api.schemas.access_request import (
    AccessRequestOut,
    DecisionResult,
    EnquiryAccepted,
    FarmerUpgradeRequest,
    OrganizationEnquiry,
    RequestDecision,
)
from agriminds_api.services.access_request import AccessRequestService

#: Public: an institution that has never signed in can ask for access.
public_router = APIRouter(prefix="/access-requests", tags=["Access requests"])

#: A signed-in farmer asking to leave the free tier.
farmer_router = APIRouter(prefix="/access-requests", tags=["Access requests"])

#: The inbox an administrator works through.
admin_router = APIRouter(
    prefix="/admin/access-requests",
    tags=["Access requests"],
    dependencies=[Depends(require_admin)],
)


@public_router.post(
    "",
    response_model=EnquiryAccepted,
    status_code=202,
    summary="Ask for access (cooperative, office, insurer, ministry, NGO, university)",
    description=(
        "The one unauthenticated write in the platform, and deliberately narrow. It records an "
        "enquiry and returns an acknowledgement — never whether the organisation is already a "
        "customer, because confirming that would turn a sales form into a directory of who pays."
        "\n\nAn email address or a phone number is required: a lead nobody can reply to is not a "
        "lead. The segment is recorded as the enquirer's own description and is not binding; an "
        "administrator decides it on approval, because the price follows from it."
    ),
)
async def enquire(req: OrganizationEnquiry, session: SessionDep) -> EnquiryAccepted:
    row = await AccessRequestService(session).enquire(req)
    return EnquiryAccepted(
        id=str(row.id),
        status=row.status.value,
        message="Thank you. We have your request and will be in touch.",
    )


@farmer_router.post(
    "/premium",
    response_model=AccessRequestOut,
    status_code=201,
    summary="Ask to move off the free tier",
    description="Identity comes from the token, so a farmer only supplies what we do not know.",
)
async def request_premium(
    req: FarmerUpgradeRequest, user: FarmerUser, session: SessionDep
) -> AccessRequestOut:
    return await AccessRequestService(session).request_upgrade(user, req)


@farmer_router.get(
    "/premium",
    response_model=AccessRequestOut | None,
    summary="Whether this farmer has already asked, and what happened",
)
async def my_premium_request(user: FarmerUser, session: SessionDep) -> AccessRequestOut | None:
    return await AccessRequestService(session).mine(user)


@admin_router.get("", response_model=list[AccessRequestOut], summary="Everyone who has asked")
async def inbox(
    session: SessionDep,
    open_only: bool = Query(False, description="Only requests still waiting on a decision"),
) -> list[AccessRequestOut]:
    return await AccessRequestService(session).inbox(open_only=open_only)


@admin_router.post(
    "/{request_id}",
    response_model=DecisionResult,
    summary="Decide a request",
    description=(
        "Approving an organisation enquiry **creates the account and an account for its contact**, "
        "in the segment named here rather than the one the enquirer guessed. The link back is "
        "kept, so an account can always be traced to the enquiry it came from.\n\n"
        "The response carries a single-use invitation token. There is no mail server here, so it "
        "is shown once and relayed to the contact by whoever approves -- it is not stored in "
        "readable form and re-reading the request will not return it."
    ),
)
async def decide(
    request_id: uuid.UUID, decision: RequestDecision, session: SessionDep, user: CurrentUser
) -> DecisionResult:
    return await AccessRequestService(session).decide(request_id, decision, decided_by=user.id)
