"""Signing yourself up, and the queue of people waiting for a development agent."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from agriminds_api.api.deps import CurrentUser, SessionDep, SettingsDep, require_staff
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.signup import (
    ApprovalDecision,
    PendingUser,
    SignupAccepted,
    SignupRequest,
)
from agriminds_api.services.signup import SignupService

public_router = APIRouter(prefix="/signup", tags=["Sign-up"])
staff_router = APIRouter(prefix="/staff/signups", tags=["Sign-up"], dependencies=[Depends(require_staff)])


@public_router.post(
    "",
    response_model=SignupAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={422: {"model": ErrorResponse, "description": "Unusable number or weak password"}},
    summary="Open a farmer account",
    description=(
        "Creates the account as **pending**. A farmer's advisory is tied to a real holding in a "
        "real kebele and a form cannot prove either, so a development agent confirms it before "
        "the account can be signed into.\n\n"
        "The acknowledgement is identical whether or not the number already has an account: "
        "saying otherwise would turn this form into a way to discover who is registered, one "
        "number at a time."
    ),
)
async def signup(req: SignupRequest, session: SessionDep, settings: SettingsDep) -> SignupAccepted:
    return await SignupService(session, settings).register(req)


@staff_router.get(
    "",
    response_model=list[PendingUser],
    summary="Who is waiting to be confirmed",
    description="Oldest first: somebody who signed up a week ago is the one being kept waiting.",
)
async def pending(session: SessionDep, settings: SettingsDep) -> list[PendingUser]:
    return await SignupService(session, settings).pending()


@staff_router.post(
    "/{user_id}",
    response_model=PendingUser,
    summary="Confirm or refuse a sign-up",
    description=(
        "Open to any staff member, not only an administrator: the person who can actually say "
        "whether a holding exists is the development agent for that woreda. Who decided and when "
        "is recorded on the account."
    ),
)
async def decide(
    user_id: uuid.UUID,
    decision: ApprovalDecision,
    session: SessionDep,
    settings: SettingsDep,
    staff: CurrentUser,
) -> PendingUser:
    return await SignupService(session, settings).decide(user_id, decision, decided_by=staff.id)
