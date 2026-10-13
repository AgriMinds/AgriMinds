"""Organizations, their API credentials, and what they have spent."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from agriminds_api.schemas.billing import StakeholderName


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    stakeholder: StakeholderName
    contact_email: EmailStr | None = None
    woreda_id: str | None = Field(None, description="Where they operate; omit for national bodies")


class OrganizationOut(BaseModel):
    id: str
    name: str
    stakeholder: StakeholderName
    contact_email: str | None
    woreda_id: str | None
    is_active: bool
    created_at: dt.datetime
    #: Resolved from the tier in force for this organization's stakeholder type.
    api_quota_monthly: int = Field(description="Requests per calendar month; 0 means no API access")
    api_requests_this_month: int
    active_keys: int
    #: How many people can sign in for this account. Zero means the organisation exists and
    #: nobody can reach it -- a state that is otherwise only discovered by somebody asking.
    members: int = 0
    #: Invitations issued and not yet accepted. A member who has never signed in is not a
    #: member yet, and the difference matters when an administrator is chasing an account.
    pending_invitations: int = 0


class MemberOut(BaseModel):
    """Somebody who can sign in for this account."""

    id: str
    full_name: str
    email: str | None
    role: str
    is_active: bool
    #: False until they have accepted an invitation and chosen a password.
    has_signed_in: bool
    #: True while an unaccepted invitation is outstanding for them.
    invitation_pending: bool


class InviteMember(BaseModel):
    """Invite a person to an account that already exists.

    No password field, deliberately. An administrator who could set somebody's password could
    then sign in as them, and nothing downstream could tell the two apart.
    """

    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr = Field(description="What they will sign in with")
    role: Literal["agent", "minister"] = Field(
        "agent", description="`minister` sees the whole watershed; `agent` their own woreda"
    )


class ApiKeyOut(BaseModel):
    id: str
    label: str
    last_four: str = Field(description="So a customer can tell two keys apart")
    created_at: dt.datetime
    last_used_at: dt.datetime | None
    revoked_at: dt.datetime | None
    is_active: bool


class ApiKeyIssued(ApiKeyOut):
    """The one and only response that carries the key itself."""

    key: str = Field(description="Shown once. The platform stores only a hash and cannot show it again.")


class ApiKeyCreate(BaseModel):
    label: str = Field(
        min_length=2, max_length=80, description="What this key is for, e.g. 'EIAR research pipeline'"
    )


class UsageDay(BaseModel):
    day: dt.date
    requests: int


class OrganizationUsage(BaseModel):
    organization_id: str
    name: str
    month: str = Field(description="YYYY-MM the quota applies to")
    quota_monthly: int
    used_this_month: int
    remaining: int
    over_quota: bool
    daily: list[UsageDay] = Field(description="Oldest first, for the current month")
