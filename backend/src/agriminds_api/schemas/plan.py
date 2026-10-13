"""Plans a customer can choose, and the bills that follow."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from agriminds_api.schemas.billing import StakeholderName
from agriminds_api.schemas.subscription import BillingPeriodName, SubscriptionOut

InvoiceStatusName = Literal["issued", "paid", "void"]
PaymentMethodName = Literal["bank_transfer", "telebirr", "cheque", "cash", "other"]


class PlanOption(BaseModel):
    """One billing period of the caller's own tier, priced."""

    period: BillingPeriodName
    unit_price_cents: int
    unit_price: str
    #: What a year on this period costs, so periods can be compared on one scale. A card that
    #: charges the same per year whichever period you pick is saying commitment earns nothing,
    #: and the customer should be able to see that rather than work it out.
    annualised_cents: int
    annualised: str
    saving_vs_shortest_pct: float = Field(
        description="How much cheaper a year on this period is than the shortest one offered"
    )


class InvoiceOut(BaseModel):
    id: str
    reference: str = Field(description="Quote this on the transfer")
    organization_id: str | None
    #: Who the bill is addressed to. An administrator confirming a payment needs the name, and it
    #: is the only thing that distinguishes one farmer's ETB 465 from another's.
    payer_name: str
    subscription_id: str | None
    amount_cents: int
    amount: str
    currency: str
    description: str
    issued_on: dt.date
    due_on: dt.date
    status: InvoiceStatusName
    paid_on: dt.date | None
    method: PaymentMethodName | None
    payment_reference: str | None
    overdue: bool


class PlanSet(BaseModel):
    stakeholder: StakeholderName
    label: str
    unit: str
    currency: str
    strategy: str | None
    value_note: str | None
    api_quota_monthly: int
    options: list[PlanOption]
    current: SubscriptionOut | None = Field(None, description="What this account is already on")
    #: Where to send the money. Carried here as well as on the checkout result, so a customer who
    #: closes the page and comes back to an unpaid bill can still see what to pay into.
    pay_to: str
    #: The unpaid bill for `current`, if there is one. Same reason: the reference has to survive a
    #: reload, or the only copy of it was on a screen the customer has already left.
    outstanding: InvoiceOut | None = None


class PlanChoice(BaseModel):
    period: BillingPeriodName
    quantity: int = Field(1, ge=1, le=10_000, description="Woredas, seats or members covered")
    starts_on: dt.date | None = Field(None, description="Defaults to today")


class CheckoutResult(BaseModel):
    """What choosing a plan produces. No payment is taken here; a bill is issued."""

    subscription: SubscriptionOut
    invoice: InvoiceOut
    #: Where to send the money. Read from configuration so it is not hard-coded in a page.
    pay_to: str
    instructions: str


class PaymentConfirmation(BaseModel):
    method: PaymentMethodName
    payment_reference: str | None = Field(None, max_length=128, description="Bank slip or telebirr id")
    paid_on: dt.date | None = None
    note: str | None = Field(None, max_length=2000)
