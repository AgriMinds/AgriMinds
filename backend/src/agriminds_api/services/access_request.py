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

from agriminds_api.core.exceptions import ConflictError, NotFoundError, ValidationError
from agriminds_api.core.security import normalise_phone
from agriminds_api.db.models import (
    AccessRequest,
    Organization,
    RequestKind,
    RequestStatus,
    StakeholderType,
    User,
)
from agriminds_api.schemas.access_request import (
    AccessRequestOut,
    FarmerUpgradeRequest,
    OrganizationEnquiry,
    RequestDecision,
)

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
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def enquire(self, req: OrganizationEnquiry) -> AccessRequest:
        row = AccessRequest(
            kind=RequestKind.ORGANIZATION,
            status=RequestStatus.NEW,
            organization_name=req.organization_name,
            contact_name=req.contact_name,
            stakeholder=StakeholderType(req.stakeholder) if req.stakeholder else None,
            contact_email=str(req.contact_email) if req.contact_email else None,
            contact_phone=normalise_phone(req.contact_phone) if req.contact_phone else None,
            message=req.message,
        )
        self._session.add(row)
        await self._session.flush()
        log.info("enquiry from %s (%s)", req.organization_name, req.stakeholder or "segment unstated")
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

    async def decide(self, request_id: uuid.UUID, decision: RequestDecision) -> AccessRequestOut:
        row = await self._session.get(AccessRequest, request_id)
        if row is None:
            raise NotFoundError("No such request.")
        if row.status in {RequestStatus.APPROVED, RequestStatus.DECLINED}:
            raise ConflictError("That request has already been decided.")

        status = RequestStatus(decision.status)
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

        row.status = status
        row.decision_note = decision.note
        if status in {RequestStatus.APPROVED, RequestStatus.DECLINED}:
            row.decided_at = dt.datetime.now(dt.UTC)
        await self._session.flush()
        return _out(row)
