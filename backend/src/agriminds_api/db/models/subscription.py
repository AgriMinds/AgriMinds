"""Who is actually paying, on what terms, from when.

The tier table says what a stakeholder type costs. This says that *this* organisation agreed to
*that* rate on *that* date — which is a different fact, and the one an invoice is computed from.

**The rate is snapshotted at signing.** `unit_price_cents` is copied from the tier in force when
the subscription starts, and `pricing_tier_id` records which version that was. Repricing a tier
therefore changes what new customers pay and leaves existing agreements alone, which is what the
versioned tier table exists to make possible. Reading the price through the relation instead would
quietly restate every signed contract the next time somebody edited the catalogue.

**A perpetual licence contributes nothing recurring.** It is counted once, in the year it was
sold, and never again — so it must not inflate ARR. That is exactly why it is a poor deal for the
platform and why the figure is reported separately rather than mixed in.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import BigInteger, CheckConstraint, Date, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.commerce import Organization


class BillingPeriod(enum.StrEnum):
    ANNUAL = "annual"
    MONTHLY = "monthly"
    DAILY = "daily"
    PERPETUAL = "perpetual"


class SubscriptionStatus(enum.StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ENDED = "ended"


billing_period_enum = Enum(
    BillingPeriod, name="billing_period", values_callable=lambda e: [m.value for m in e]
)
subscription_status_enum = Enum(
    SubscriptionStatus, name="subscription_status", values_callable=lambda e: [m.value for m in e]
)

#: How many times a period is charged in a year. Perpetual is absent on purpose: it recurs never,
#: and a dictionary lookup that returned 0 would read as "free" rather than "not recurring".
PERIODS_PER_YEAR: dict[BillingPeriod, int] = {
    BillingPeriod.ANNUAL: 1,
    BillingPeriod.MONTHLY: 12,
    BillingPeriod.DAILY: 365,
}


class Subscription(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("unit_price_cents >= 0", name="ck_subscription_price_non_negative"),
        CheckConstraint("quantity > 0", name="ck_subscription_quantity_positive"),
        CheckConstraint("ends_on IS NULL OR ends_on >= started_on", name="ck_subscription_window_ordered"),
        Index("ix_subscriptions_status_ends", "status", "ends_on"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    #: Which version of the rate card this was signed against.
    pricing_tier_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pricing_tiers.id", ondelete="SET NULL"), nullable=True
    )
    billing_period: Mapped[BillingPeriod] = mapped_column(billing_period_enum, index=True)
    #: The agreed rate, in minor units, frozen at signing.
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="ETB")
    #: Woredas covered, agent seats, member cooperatives — whatever the tier's `unit` counts.
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    started_on: Mapped[dt.date] = mapped_column(Date, index=True)
    #: NULL means open-ended: a perpetual licence, or a rolling agreement with no end date agreed.
    ends_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SubscriptionStatus] = mapped_column(
        subscription_status_enum, default=SubscriptionStatus.ACTIVE, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization: Mapped[Organization] = relationship()

    @property
    def annualised_cents(self) -> int:
        """What this agreement is worth in a year. A perpetual licence is worth nothing recurring."""
        per_year = PERIODS_PER_YEAR.get(self.billing_period)
        if per_year is None:
            return 0
        return self.unit_price_cents * self.quantity * per_year

    @property
    def contract_value_cents(self) -> int:
        """What was billed for the term — including a perpetual licence's one-off."""
        if self.billing_period is BillingPeriod.PERPETUAL:
            return self.unit_price_cents * self.quantity
        return self.annualised_cents

    def is_live(self, on: dt.date) -> bool:
        if self.status is not SubscriptionStatus.ACTIVE:
            return False
        return self.started_on <= on and (self.ends_on is None or self.ends_on >= on)
