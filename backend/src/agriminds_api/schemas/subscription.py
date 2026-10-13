"""Subscriptions and what they are worth."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from agriminds_api.schemas.billing import StakeholderName

BillingPeriodName = Literal["annual", "monthly", "daily", "perpetual"]
SubscriptionStatusName = Literal["active", "suspended", "ended"]


class SubscriptionCreate(BaseModel):
    organization_id: str
    billing_period: BillingPeriodName
    started_on: dt.date
    ends_on: dt.date | None = None
    quantity: int = Field(1, ge=1, description="Woredas, seats or members the agreement covers")
    #: Omit to take the rate in force for the organisation's stakeholder type. Supply it only for
    #: a negotiated price, which is why the override is explicit rather than a silent default.
    unit_price_cents: int | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _window_ordered(self) -> SubscriptionCreate:
        if self.ends_on and self.ends_on < self.started_on:
            raise ValueError("a subscription cannot end before it starts")
        return self


class SubscriptionOut(BaseModel):
    id: str
    organization_id: str
    organization_name: str
    stakeholder: StakeholderName
    billing_period: BillingPeriodName
    status: SubscriptionStatusName
    currency: str
    quantity: int
    unit_price_cents: int
    unit_price: str
    #: What it is worth in a year. Zero for a perpetual licence, which recurs never.
    annualised_cents: int
    annualised: str
    started_on: dt.date
    ends_on: dt.date | None
    days_to_renewal: int | None = Field(
        None, description="Days until `ends_on`; negative when it has already lapsed"
    )
    notes: str | None = None


class RevenueByStakeholder(BaseModel):
    stakeholder: StakeholderName
    label: str
    subscriptions: int
    annualised_cents: int
    annualised: str


class RevenueSummary(BaseModel):
    """What the platform actually earns, counted from signed agreements.

    Separate from the pricing catalogue's total, which is what one of everything would be worth
    if it all sold. Only agreements that are live on `as_of` are counted.
    """

    as_of: dt.date
    currency: str
    active_subscriptions: int
    arr_cents: int
    arr: str
    mrr_cents: int
    mrr: str
    #: One-off licence revenue is reported on its own so it cannot be mistaken for recurring.
    perpetual_cents: int
    perpetual: str
    by_stakeholder: list[RevenueByStakeholder]
    renewals_due: list[SubscriptionOut] = Field(description="Live agreements ending within 90 days")
    lapsed: list[SubscriptionOut] = Field(description="Still marked active but past their end date")
