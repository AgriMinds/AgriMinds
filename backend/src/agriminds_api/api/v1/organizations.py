"""Paying accounts and the API credentials they call with. Administrators only."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request

from agriminds_api.api.deps import SessionDep, require_admin
from agriminds_api.db.models import StakeholderType
from agriminds_api.schemas.commerce import (
    ApiKeyCreate,
    ApiKeyIssued,
    ApiKeyOut,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUsage,
    UsageDay,
)
from agriminds_api.services.commerce import CommerceService

router = APIRouter(prefix="/organizations", tags=["Organizations"], dependencies=[Depends(require_admin)])


def _service(session, request: Request) -> CommerceService:
    return CommerceService(session, getattr(request.app.state, "cache", None))


async def _out(service: CommerceService, org) -> OrganizationOut:
    return OrganizationOut(
        id=str(org.id),
        name=org.name,
        stakeholder=org.stakeholder.value,
        contact_email=org.contact_email,
        woreda_id=str(org.woreda_id) if org.woreda_id else None,
        is_active=org.is_active,
        created_at=org.created_at,
        api_quota_monthly=await service.quota_for(org.stakeholder),
        api_requests_this_month=await service.month_to_date(org.id),
        active_keys=await service.active_key_count(org.id),
    )


def _key_out(key) -> ApiKeyOut:
    return ApiKeyOut(
        id=str(key.id),
        label=key.label,
        last_four=key.last_four,
        created_at=key.created_at,
        last_used_at=key.last_used_at,
        revoked_at=key.revoked_at,
        is_active=key.revoked_at is None,
    )


@router.get("", response_model=list[OrganizationOut], summary="Every paying account")
async def list_organizations(session: SessionDep, request: Request) -> list[OrganizationOut]:
    service = _service(session, request)
    return [await _out(service, org) for org in await service.organizations()]


@router.post("", response_model=OrganizationOut, status_code=201, summary="Register an account")
async def create_organization(
    req: OrganizationCreate, session: SessionDep, request: Request
) -> OrganizationOut:
    service = _service(session, request)
    org = await service.create_organization(
        name=req.name,
        stakeholder=StakeholderType(req.stakeholder),
        contact_email=req.contact_email,
        woreda_id=uuid.UUID(req.woreda_id) if req.woreda_id else None,
    )
    return await _out(service, org)


@router.get("/{organization_id}/keys", response_model=list[ApiKeyOut], summary="Credentials issued")
async def list_keys(organization_id: uuid.UUID, session: SessionDep, request: Request) -> list[ApiKeyOut]:
    return [_key_out(k) for k in await _service(session, request).keys_for(organization_id)]


@router.post(
    "/{organization_id}/keys",
    response_model=ApiKeyIssued,
    status_code=201,
    summary="Issue an API key",
    description=(
        "The response carries the key itself, once. The platform stores only a SHA-256 hash and "
        "the last four characters, so it cannot show the key again and a stolen database does "
        "not hand anybody a working credential. Give it to the customer now or revoke and reissue."
    ),
)
async def issue_key(
    organization_id: uuid.UUID, req: ApiKeyCreate, session: SessionDep, request: Request
) -> ApiKeyIssued:
    key, plaintext = await _service(session, request).issue_key(organization_id, req.label)
    return ApiKeyIssued(**_key_out(key).model_dump(), key=plaintext)


@router.delete(
    "/{organization_id}/keys/{key_id}",
    response_model=ApiKeyOut,
    summary="Revoke a key",
    description="The row is kept: it is the record of what was issued and what it spent.",
)
async def revoke_key(
    organization_id: uuid.UUID, key_id: uuid.UUID, session: SessionDep, request: Request
) -> ApiKeyOut:
    return _key_out(await _service(session, request).revoke_key(organization_id, key_id))


@router.get(
    "/{organization_id}/usage",
    response_model=OrganizationUsage,
    summary="What this account has spent this month",
)
async def usage(organization_id: uuid.UUID, session: SessionDep, request: Request) -> OrganizationUsage:
    import datetime as dt

    service = _service(session, request)
    org = await service.organization(organization_id)
    quota = await service.quota_for(org.stakeholder)
    used = await service.month_to_date(org.id)
    rows = await service.daily_usage(org.id)
    return OrganizationUsage(
        organization_id=str(org.id),
        name=org.name,
        month=f"{dt.date.today():%Y-%m}",
        quota_monthly=quota,
        used_this_month=used,
        remaining=max(quota - used, 0),
        over_quota=used >= quota > 0,
        daily=[UsageDay(day=r.day, requests=r.requests) for r in rows],
    )
