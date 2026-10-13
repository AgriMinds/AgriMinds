"""What each kind of stakeholder pays, and when that price was in force.

Two decisions are load-bearing.

**Money is stored as an integer count of minor units** (santim for ETB, cents for USD). A float cannot hold 0.30 exactly, and a price
list that drifts by a hundredth under addition is not a price list. Every amount here is minor
units of ``currency``; the API converts at the edge and nothing in between does arithmetic on a
float.

**A price change writes a new row rather than editing the old one.** A tier's rate is referenced
by subscriptions and, later, by invoices that have already been sent. Editing it in place would
silently restate what somebody was charged last year. Each row therefore carries the window it
was in force for, and exactly one row per stakeholder may be open-ended at a time.
"""

from __future__ import annotations

import datetime as dt
import enum

from sqlalchemy import BigInteger, CheckConstraint, Date, Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class StakeholderType(enum.StrEnum):
    """Who is being billed. One entry per row of the commercial model."""

    FARMER_PREMIUM = "farmer_premium"
    COOPERATIVE = "cooperative"
    #: Agricultural offices and extension agents, priced per woreda.
    DEVELOPMENT_AGENT = "development_agent"
    #: Insurers, microfinance and agricultural lenders: risk analytics rather than advisories.
    INSURER_LENDER = "insurer_lender"
    FEDERAL_MINISTRY = "federal_ministry"
    RESEARCH = "research"
    #: Government agencies, NGOs and development partners.
    INTERNATIONAL_PARTNER = "international_partner"
    #: Retired by the agreed model. Kept so existing records stay readable; no price in force.
    REGIONAL_GOVERNMENT = "regional_government"
    PRIVATE_SECTOR = "private_sector"


stakeholder_type_enum = Enum(
    StakeholderType, name="stakeholder_type", values_callable=lambda e: [m.value for m in e]
)


class PricingTier(UUIDPrimaryKey, Timestamps, Base):
    """One stakeholder's rate card, valid over ``[effective_from, effective_to)``."""

    __tablename__ = "pricing_tiers"
    __table_args__ = (
        CheckConstraint("one_time_cents >= 0", name="ck_pricing_tier_one_time_non_negative"),
        CheckConstraint("annual_cents >= 0", name="ck_pricing_tier_annual_non_negative"),
        CheckConstraint("monthly_cents >= 0", name="ck_pricing_tier_monthly_non_negative"),
        CheckConstraint("daily_cents >= 0", name="ck_pricing_tier_daily_non_negative"),
        CheckConstraint("api_quota_monthly >= 0", name="ck_pricing_tier_quota_non_negative"),
        CheckConstraint(
            "effective_to IS NULL OR effective_to > effective_from",
            name="ck_pricing_tier_window_ordered",
        ),
        # At most one open-ended row per stakeholder: the current price must be unambiguous.
        # A partial index rather than a plain unique constraint, so superseded rows may share a
        # stakeholder freely.
        Index(
            "uq_pricing_tier_current",
            "stakeholder",
            unique=True,
            postgresql_where=Text("effective_to IS NULL"),
        ),
    )

    stakeholder: Mapped[StakeholderType] = mapped_column(stakeholder_type_enum, index=True)
    label: Mapped[str] = mapped_column(String(128))
    #: What one subscription of this tier covers — "per woreda", "per organisation", "per farmer".
    #: Development agents are priced per woreda, so the unit is part of the price, not a footnote.
    unit: Mapped[str] = mapped_column(String(64), default="per organisation")
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    one_time_cents: Mapped[int] = mapped_column(BigInteger, default=0)
    annual_cents: Mapped[int] = mapped_column(BigInteger, default=0)
    monthly_cents: Mapped[int] = mapped_column(BigInteger, default=0)
    daily_cents: Mapped[int] = mapped_column(BigInteger, default=0)

    effective_from: Mapped[dt.date] = mapped_column(Date, index=True)
    #: NULL means "still in force". A superseding row closes it.
    effective_to: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    #: Requests per calendar month a subscriber of this tier may make against the metered API.
    #: Zero means the tier carries no API access at all, which is the case for farmers.
    api_quota_monthly: Mapped[int] = mapped_column(BigInteger, default=0)

    #: How this segment is sold to, and the argument that justifies the price to the buyer.
    #: Kept beside the price so a quote and its justification cannot drift apart.
    strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def is_current(self) -> bool:
        return self.effective_to is None
