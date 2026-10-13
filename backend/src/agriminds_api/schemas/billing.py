"""Pricing tiers over the wire.

Money crosses the boundary twice: as the integer cents the database holds, and as a decimal
string for display. Both are sent. A client that does arithmetic uses the integer; a client that
renders a price uses the string and never has to divide by 100 itself — which is where rounding
bugs in money get in.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

StakeholderName = Literal[
    "farmer_premium",
    "cooperative",
    "development_agent",
    "insurer_lender",
    "federal_ministry",
    "research",
    "international_partner",
    # Retired by the agreed model; kept so existing records stay readable.
    "regional_government",
    "private_sector",
]

BillingPeriod = Literal["one_time", "annual", "monthly", "daily"]


def _as_amount(cents: int) -> str:
    return str((Decimal(cents) / 100).quantize(Decimal("0.01")))


class TierRates(BaseModel):
    """The four rates, in cents and rendered."""

    one_time_cents: int = Field(ge=0)
    annual_cents: int = Field(ge=0)
    monthly_cents: int = Field(ge=0)
    daily_cents: int = Field(ge=0)

    one_time: str = Field(description="Decimal string, e.g. '2400.00'")
    annual: str
    monthly: str
    daily: str

    @classmethod
    def of(cls, one_time: int, annual: int, monthly: int, daily: int) -> TierRates:
        return cls(
            one_time_cents=one_time,
            annual_cents=annual,
            monthly_cents=monthly,
            daily_cents=daily,
            one_time=_as_amount(one_time),
            annual=_as_amount(annual),
            monthly=_as_amount(monthly),
            daily=_as_amount(daily),
        )


class PricingTierOut(BaseModel):
    id: str
    stakeholder: StakeholderName
    label: str
    unit: str = Field(description="What one subscription covers, e.g. 'per woreda'")
    currency: str
    rates: TierRates
    api_quota_monthly: int = Field(
        description="Requests per calendar month this tier includes; 0 means no API access"
    )
    strategy: str | None = Field(None, description="How this segment is sold to")
    value_note: str | None = Field(None, description="The argument that justifies the price to this buyer")
    effective_from: dt.date
    effective_to: dt.date | None = Field(
        None, description="NULL while the price is in force; set when a later version supersedes it"
    )
    is_current: bool
    notes: str | None = None


class ProductOut(BaseModel):
    """A package the rate card prices. Keeps a price connected to what is delivered for it."""

    code: str
    name: str
    summary: str
    stakeholders: list[str]


class PricingCatalogue(BaseModel):
    """Every stakeholder's price, current unless history was asked for."""

    currency: str
    as_of: dt.date
    tiers: list[PricingTierOut]
    #: Annualised value of one subscription of every tier, so the catalogue states its own total
    #: rather than leaving a reader to add eight numbers up by hand.
    annual_total_cents: int
    annual_total: str
    products: list[ProductOut] = Field(default_factory=list)


class PricingTierChange(BaseModel):
    """A new version of one stakeholder's price.

    Supplying an ``effective_from`` in the future schedules the change; the current row stays in
    force until then. Amounts are cents, because that is what the ledger stores.
    """

    label: str | None = Field(None, max_length=128)
    unit: str | None = Field(None, max_length=64)
    one_time_cents: int = Field(ge=0)
    annual_cents: int = Field(ge=0)
    monthly_cents: int = Field(ge=0)
    daily_cents: int = Field(ge=0)
    api_quota_monthly: int = Field(0, ge=0, description="Requests per calendar month to include")
    strategy: str | None = Field(None, max_length=2000)
    value_note: str | None = Field(None, max_length=2000)
    effective_from: dt.date
    notes: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _at_least_one_rate(self) -> PricingTierChange:
        if not any((self.one_time_cents, self.annual_cents, self.monthly_cents, self.daily_cents)):
            raise ValueError("a tier must carry at least one non-zero rate")
        return self
