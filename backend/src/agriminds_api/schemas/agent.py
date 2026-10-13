"""What the farmer agent is asked and what it answers, over chat, voice or the hotline."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from agriminds_api.schemas.common import LocaleCode

ChannelName = Literal["sms", "ussd", "voice", "chat"]


class AgentQuestion(BaseModel):
    text: str = Field(max_length=480, description="What the farmer asked, or a menu digit")
    locale: LocaleCode = "en"
    lead_month: int = Field(1, ge=1, le=3)
    farm_id: str | None = Field(None, description="Ask about one plot; defaults to the worst")


class AgentAnswer(BaseModel):
    intent: str = Field(description="What the agent decided the question was")
    text: str
    locale: LocaleCode
    farm_id: str | None = None
    #: Which plot, rule version and lead the answer came from. An extension officer checking a
    #: complaint needs to know what the farmer was actually told to act on.
    sources: list[str] = Field(default_factory=list)
    followups: list[str] = Field(default_factory=list)
    #: What this answer would cost to send as SMS, so the cost of the free hotline is visible
    #: before a carrier is connected rather than discovered on the first invoice.
    sms_segments: int = 1


class HotlineInbound(BaseModel):
    """The shape an SMS/USSD aggregator posts. Field names follow the common vendor convention."""

    caller: str = Field(description="The farmer's number, any Ethiopian format")
    text: str = Field("", max_length=480)
    channel: ChannelName = "sms"
    locale: LocaleCode | None = Field(None, description="Defaults to the farmer's own setting")
    session_id: str | None = Field(None, max_length=64, description="Ties a USSD session together")
    lead_month: int = Field(1, ge=1, le=3)


class HotlineTurn(BaseModel):
    id: str
    caller: str
    channel: ChannelName
    locale: str
    intent: str
    reply: str
    farm_id: str | None = None
    registered: bool = Field(description="Whether the number belongs to a registered farmer")
    short_code: str
    provider: str
    #: False whenever no carrier took the message. Never set true to make a figure look better.
    delivered: bool
    note: str | None = Field(None, description="Why it was not delivered, when it was not")
    at: dt.datetime | None = None
