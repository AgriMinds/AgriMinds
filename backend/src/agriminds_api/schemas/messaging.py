"""Message credits and the advisories they deliver."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

ChannelName = Literal["sms", "ussd"]
DeliveryStatusName = Literal["queued", "sent", "failed"]


class BundlePurchase(BaseModel):
    organization_id: str
    messages: int = Field(ge=1, le=10_000_000)
    unit_price_cents: int = Field(ge=0, description="Per message, in minor units")
    purchased_on: dt.date | None = None
    expires_on: dt.date | None = None
    notes: str | None = Field(None, max_length=2000)


class BundleOut(BaseModel):
    id: str
    messages: int
    unit_price_cents: int
    unit_price: str
    value_cents: int
    value: str
    currency: str
    purchased_on: dt.date
    expires_on: dt.date | None
    expired: bool


class DeliveryRequest(BaseModel):
    organization_id: str
    recipient: str = Field(min_length=7, max_length=32)
    body: str = Field(min_length=1, max_length=640, description="The advisory, in the farmer's language")
    locale: Literal["en", "am", "or"] = "am"
    channel: ChannelName = "sms"


class DeliveryOut(BaseModel):
    id: str
    recipient: str
    locale: str
    channel: ChannelName
    status: DeliveryStatusName
    body: str
    created_at: dt.datetime
    sent_at: dt.datetime | None
    failure_reason: str | None


class CreditBalance(BaseModel):
    """What an organisation has left, derived from bundles bought minus messages charged."""

    organization_id: str
    organization_name: str
    currency: str
    purchased: int = Field(description="Credits bought and not expired")
    used: int = Field(description="Messages queued or sent; a failure is not charged for")
    remaining: int
    bundles: list[BundleOut]
    #: Stated rather than implied: no aggregator is wired in, so nothing has actually been sent.
    provider: str = Field(description="Which aggregator is configured, or 'none'")
    deliverable: bool = Field(description="False while no aggregator is configured")
