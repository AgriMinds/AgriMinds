"""Receiving enquiries and turning the good ones into accounts.

The public form is the only unauthenticated write in the platform, so it is deliberately narrow:
it creates one row, returns almost nothing, and cannot be used to discover whether an organisation
is already a customer. Confirming that would turn a sales form into a directory of who pays.

Approval is where a lead becomes an account. That step is an administrator's: the enquirer's own
guess at their segment is recorded but not binding, because the price follows from the segment and
a cooperative that calls itself a ministry would otherwise price itself.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ConflictError, NotFoundError, ValidationError
from agriminds_api.core.security import (
    PasswordPolicyError,
    hash_password,
    normalise_phone,
    unusable_password_hash,
    validate_password_strength,
)
from agriminds_api.db.models import (
    AccessRequest,
    ApprovalStatus,
    Organization,
    RequestKind,
    RequestStatus,
    StakeholderType,
    User,
    UserRole,
)
from agriminds_api.schemas.access_request import (
    AccessRequestOut,
    DecisionResult,
    FarmerUpgradeRequest,
    OrganizationEnquiry,
    RequestDecision,
)
from agriminds_api.services.invitation import issue as issue_invitation

log = logging.getLogger(__name__)


def _out(row: AccessRequest) -> AccessRequestOut:
    return AccessRequestOut(
        id=str(row.id),
        kind=row.kind.value,
        status=row.status.value,
        organization_name=row.organization_name,
        contact_name=row.contact_name,
        contact_email=row.contact_email,
        contact_phone=row.contact_phone,
        stakeholder=row.stakeholder.value if row.stakeholder else None,
        message=row.message,
        created_at=row.created_at,
        decided_at=row.decided_at,
        decision_note=row.decision_note,
        organization_id=str(row.organization_id) if row.organization_id else None,
    )


class AccessRequestService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def enquire(self, req: OrganizationEnquiry) -> AccessRequest:
        """Record the enquiry and create the contact's account, held pending.

        The account is created now, with the password they chose, and is unusable until an
        administrator approves. That is the farmer sign-up shape applied here: the person who
        filled the form is the person who knows the password, and nobody has to read a credential
        down a telephone.

        An identifier already in use is acknowledged exactly like a fresh one and nothing is
        written for it, because this form is public and a different answer would make it a way to
        discover who is already a customer.
        """
        email = str(req.contact_email).strip().lower() if req.contact_email else None
        phone = normalise_phone(req.contact_phone) if req.contact_phone else None

        row = AccessRequest(
            kind=RequestKind.ORGANIZATION,
            status=RequestStatus.NEW,
            organization_name=req.organization_name,
            contact_name=req.contact_name,
            stakeholder=StakeholderType(req.stakeholder) if req.stakeholder else None,
            contact_email=email,
            contact_phone=phone,
            message=req.message,
        )
        self._session.add(row)
        await self._session.flush()

        try:
            validate_password_strength(req.password, self._settings.password_min_length)
        except PasswordPolicyError as exc:
            raise ValidationError(str(exc)) from exc

        clause = User.email == email if email else User.phone == phone
        if await self._session.scalar(select(User).where(clause)):
            # Same acknowledgement, no account written. The enquiry itself is still recorded:
            # somebody asking again is a sales signal, not a reason to drop the lead.
            log.info("enquiry from %s reused an existing identifier", req.organization_name)
            return row

        user = User(
            email=email,
            phone=phone,
            full_name=req.contact_name,
            hashed_password=hash_password(req.password),
            # Institutional staff, not an operator of the platform. The organisation is attached
            # on approval, because until then there is no organisation to attach.
            role=UserRole.AGENT,
            approval_status=ApprovalStatus.PENDING,
            is_active=True,
        )
        self._session.add(user)
        await self._session.flush()
        row.user_id = user.id
        log.info(
            "enquiry from %s (%s); account %s held pending",
            req.organization_name,
            req.stakeholder or "segment unstated",
            user.id,
        )
        return row

    async def request_upgrade(self, user: User, req: FarmerUpgradeRequest) -> AccessRequestOut:
        existing = await self._session.scalar(
            select(AccessRequest).where(
                AccessRequest.user_id == user.id,
                AccessRequest.kind == RequestKind.FARMER_PREMIUM,
                AccessRequest.status.in_([RequestStatus.NEW, RequestStatus.CONTACTED]),
            )
        )
        if existing is not None:
            # Asking twice should not create a second row for the same person to be called about.
            raise ConflictError("You have already asked about premium. We will be in touch.")

        row = AccessRequest(
            kind=RequestKind.FARMER_PREMIUM,
            status=RequestStatus.NEW,
            user_id=user.id,
            stakeholder=StakeholderType.FARMER_PREMIUM,
            contact_name=user.full_name,
            contact_email=user.email,
            contact_phone=normalise_phone(req.contact_phone) if req.contact_phone else user.phone,
            woreda_id=user.woreda_id,
            message=req.message,
        )
        self._session.add(row)
        await self._session.flush()
        return _out(row)

    async def mine(self, user: User) -> AccessRequestOut | None:
        row = await self._session.scalar(
            select(AccessRequest)
            .where(AccessRequest.user_id == user.id, AccessRequest.kind == RequestKind.FARMER_PREMIUM)
            .order_by(AccessRequest.created_at.desc())
        )
        return _out(row) if row else None

    async def inbox(self, *, open_only: bool = False) -> list[AccessRequestOut]:
        stmt = select(AccessRequest).order_by(AccessRequest.created_at.desc())
        if open_only:
            stmt = stmt.where(AccessRequest.status.in_([RequestStatus.NEW, RequestStatus.CONTACTED]))
        return [_out(r) for r in (await self._session.scalars(stmt)).all()]

    async def decide(
        self,
        request_id: uuid.UUID,
        decision: RequestDecision,
        *,
        decided_by: uuid.UUID | None = None,
    ) -> DecisionResult:
        row = await self._session.get(AccessRequest, request_id)
        if row is None:
            raise NotFoundError("No such request.")
        if row.status in {RequestStatus.APPROVED, RequestStatus.DECLINED}:
            raise ConflictError("That request has already been decided.")

        status = RequestStatus(decision.status)
        invitation: dict[str, object | None] = {
            "invited_email": None,
            "invitation_token": None,
            "invitation_expires_at": None,
        }
        if status is RequestStatus.APPROVED and row.kind is RequestKind.ORGANIZATION:
            segment = decision.stakeholder or (row.stakeholder.value if row.stakeholder else None)
            if segment is None:
                raise ValidationError("Choose a segment before approving: the price follows from it.")
            name = row.organization_name or row.contact_name
            clash = await self._session.scalar(select(Organization).where(Organization.name == name))
            if clash is not None:
                raise ConflictError(f"An organization called {name!r} already exists.")
            org = Organization(
                name=name,
                stakeholder=StakeholderType(segment),
                contact_email=row.contact_email,
            )
            self._session.add(org)
            await self._session.flush()
            row.organization_id = org.id
            log.info("approved %s -> organization %s", name, org.id)
            invitation = await self._activate_contact(row, org, decided_by=decided_by)

        if status is RequestStatus.DECLINED and row.user_id is not None:
            # The account was created when they enquired. Declining has to close it, or a refused
            # organisation keeps a sign-in that is only waiting for somebody to approve it later.
            declined = await self._session.get(User, row.user_id)
            if declined is not None and declined.approval_status is ApprovalStatus.PENDING:
                declined.approval_status = ApprovalStatus.REJECTED
                declined.approved_by_id = decided_by
                declined.approved_at = dt.datetime.now(dt.UTC)

        row.status = status
        row.decision_note = decision.note
        if status in {RequestStatus.APPROVED, RequestStatus.DECLINED}:
            row.decided_at = dt.datetime.now(dt.UTC)
        await self._session.flush()
        return DecisionResult(request=_out(row), **invitation)

    async def _activate_contact(
        self, row: AccessRequest, org: Organization, *, decided_by: uuid.UUID | None
    ) -> dict[str, object | None]:
        """Turn the account created at enquiry time into one they can sign in to.

        The contact already chose their password on the form, so approval is the only thing that
        was missing. Nothing is generated, nothing is relayed and nothing is read down a phone --
        the person who filled the form signs in with what they typed.

        An enquiry that arrived before this flow existed has no account behind it. One is created
        here, with an unusable password and an invitation to set one, so an old lead is not
        stranded by the change.
        """
        if row.user_id is not None:
            user = await self._session.get(User, row.user_id)
            if user is not None:
                user.organization_id = org.id
                user.approval_status = ApprovalStatus.APPROVED
                user.approved_by_id = decided_by
                user.approved_at = dt.datetime.now(dt.UTC)
                log.info("activated contact %s for organization %s", user.id, org.id)
                return {
                    "invited_email": user.email or user.phone,
                    "invitation_token": None,
                    "invitation_expires_at": None,
                }

        if not row.contact_email:
            log.info("organization %s approved without a contact email: no account created", org.id)
            return {"invited_email": None, "invitation_token": None, "invitation_expires_at": None}

        email = row.contact_email.strip().lower()
        existing = await self._session.scalar(select(User).where(User.email == email))
        if existing is not None:
            # Someone already signs in with this address: attach them rather than refusing the
            # approval over it, and leave their password alone.
            existing.organization_id = org.id
            log.info("linked existing user %s to organization %s", existing.id, org.id)
            return {"invited_email": email, "invitation_token": None, "invitation_expires_at": None}

        user = User(
            email=email,
            full_name=row.contact_name,
            hashed_password=unusable_password_hash(),
            role=UserRole.AGENT,
            organization_id=org.id,
            approval_status=ApprovalStatus.APPROVED,
            is_active=True,
        )
        self._session.add(user)
        await self._session.flush()
        raw, expires_at = await issue_invitation(
            self._session, user, invited_by=decided_by, reason="legacy enquiry approved"
        )
        return {
            "invited_email": email,
            "invitation_token": raw,
            "invitation_expires_at": expires_at,
        }
