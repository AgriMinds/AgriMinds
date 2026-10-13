"""Signing yourself up, and the queue of people waiting for a development agent."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from agriminds_api.api.deps import CurrentUser, SessionDep, SettingsDep, require_staff
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.schemas.signup import (
    ApprovalDecision,
    CredentialLink,
    PendingUser,
    RegisterFarmer,
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
    "/register",
    response_model=CredentialLink,
    status_code=status.HTTP_201_CREATED,
    summary="Register a farmer who is standing in front of you",
    description=(
        "For the farmer who walks into the office or meets the agent in the field — the case the "
        "hotline points at when it tells an unregistered caller to ask their development "
        "agent.\n\n"
        "Approved immediately, because the check the queue performs has just been done in "
        "person. **No password is set here**: the response carries a one-time link and the farmer "
        "chooses their own, so no staff member ends up holding a credential that signs in as a "
        "farmer."
    ),
)
async def register_farmer(
    req: RegisterFarmer, session: SessionDep, settings: SettingsDep, staff: CurrentUser
) -> CredentialLink:
    return await SignupService(session, settings).register_farmer(req, registered_by=staff.id)


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


@staff_router.post(
    "/{user_id}/reset-password",
    response_model=CredentialLink,
    summary="Issue a password reset link",
    description=(
        "There is no email and no SMS carrier to send a reset to, so the channel is the person "
        "who can already identify the farmer: their development agent.\n\n"
        "The link is shown once and only its hash is stored, so it cannot be looked up again — a "
        "lost link is replaced, not recovered. Issuing one also spends any link the account "
        "already held, so this revokes whatever was outstanding."
    ),
)
async def reset_password(
    user_id: uuid.UUID, session: SessionDep, settings: SettingsDep, staff: CurrentUser
) -> CredentialLink:
    return await SignupService(session, settings).reset_password(user_id, issued_by=staff.id)
