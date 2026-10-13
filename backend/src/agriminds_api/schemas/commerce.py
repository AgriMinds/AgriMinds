"""Organizations, their API credentials, and what they have spent."""

from __future__ import annotations

import datetime as dt

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
