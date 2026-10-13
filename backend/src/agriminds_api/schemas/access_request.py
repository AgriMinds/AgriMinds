"""Enquiries: who is asking, and what an administrator does about it."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

from agriminds_api.schemas.billing import StakeholderName

RequestKindName = Literal["farmer_premium", "organization"]
RequestStatusName = Literal["new", "contacted", "approved", "declined"]


class OrganizationEnquiry(BaseModel):
    """The public form. No account exists yet, so everything is self-reported."""

    organization_name: str = Field(min_length=2, max_length=160)
    contact_name: str = Field(min_length=2, max_length=120)
    stakeholder: StakeholderName | None = Field(
        None, description="Which segment they believe they are; an administrator may decide otherwise"
    )
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(None, max_length=32)
    message: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _reachable(self) -> OrganizationEnquiry:
        # A lead nobody can reply to is not a lead.
        if not self.contact_email and not self.contact_phone:
            raise ValueError("give an email address or a phone number so we can reply")
        return self


class FarmerUpgradeRequest(BaseModel):
    """A signed-in farmer asking to leave the free tier. Their identity comes from the token."""

    contact_phone: str | None = Field(None, max_length=32, description="If different from the account")
    message: str | None = Field(None, max_length=2000)


class AccessRequestOut(BaseModel):
    id: str
    kind: RequestKindName
    status: RequestStatusName
    organization_name: str | None
    contact_name: str
    contact_email: str | None
    contact_phone: str | None
    stakeholder: StakeholderName | None
    message: str | None
    created_at: dt.datetime
    decided_at: dt.datetime | None
    decision_note: str | None
    organization_id: str | None = Field(None, description="The account this became, once approved")


class RequestDecision(BaseModel):
    """Approving an organisation enquiry creates the account; declining records why."""

    status: Literal["contacted", "approved", "declined"]
    #: Which segment to place them in. Required on approval of an organisation enquiry, because
    #: the price follows from it and the enquirer's own guess is not binding.
    stakeholder: StakeholderName | None = None
    note: str | None = Field(None, max_length=2000)


class EnquiryAccepted(BaseModel):
    """What the public form gets back. Deliberately thin: it must not confirm what we hold."""

    id: str
    status: RequestStatusName
    message: str
