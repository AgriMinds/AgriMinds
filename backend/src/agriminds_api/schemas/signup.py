"""Signing yourself up, and the queue of people waiting to be confirmed."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from agriminds_api.schemas.common import LocaleCode

ApprovalStatusName = Literal["pending", "approved", "rejected"]


class SignupRequest(BaseModel):
    """What a farmer gives to open an account for themselves.

    A phone number, because that is what a smallholder has and what a development agent will call
    to confirm them. No email: requiring one would exclude most of the people this is for.
    """

    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=9, max_length=20, description="09xxxxxxxx or +2519xxxxxxxx")
    password: str = Field(min_length=1, max_length=256)
    locale: LocaleCode = "en"
    woreda_id: str | None = Field(None, description="Where the holding is, if known")
    note: str | None = Field(
        None, max_length=2000, description="Kebele, number of plots, who can vouch for you"
    )


class SignupAccepted(BaseModel):
    """Deliberately thin. It must not reveal whether a number already has an account."""

    status: ApprovalStatusName
    message: str


class PendingUser(BaseModel):
    id: str
    full_name: str
    phone: str | None
    locale: str
    woreda_name: str | None = None
    note: str | None = None
    signed_up_at: dt.datetime


class ApprovalDecision(BaseModel):
    approve: bool
    #: Why, when the answer is no. Kept so a rejected applicant can be told something true.
    note: str | None = Field(None, max_length=2000)


class RegisterFarmer(BaseModel):
    """A development agent opening an account for a farmer standing in front of them.

    No password field: the agent must not choose, know or type the farmer's password. They issue a
    link and the farmer sets their own, which is the only version where the agent cannot sign in
    as the farmer afterwards.
    """

    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=9, max_length=20)
    locale: LocaleCode = "en"
    woreda_id: str | None = None
    note: str | None = Field(None, max_length=2000)


class CredentialLink(BaseModel):
    """A one-time link, shown once to the staff member who has to relay it.

    There is no mail server and no SMS carrier, so the relay is a person. The token is stored only
    as a hash, so asking again will not produce it -- a lost link is replaced, not recovered.
    """

    user_id: str
    full_name: str
    phone: str | None
    token: str
    expires_at: dt.datetime
    #: What the staff member should actually do with it.
    instruction: str
