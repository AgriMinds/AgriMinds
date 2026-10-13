"""Who buys the platform, what they may call, and what they actually called.

An ``Organization`` is the thing that pays. The price list is written per *stakeholder type*, but
a cooperative with forty member farmers signs one agreement, not forty, so the subscription and
the API credentials hang here rather than on a user account.

Three decisions are load-bearing.

**An API key is stored only as a hash.** The plaintext is shown once, at issue, and never again —
the same stance taken with passwords. A leaked database must not hand somebody a working key, and
``last_four`` exists so a customer can tell two keys apart without the platform keeping either.

**Usage is recorded in PostgreSQL, not only in Redis.** Redis holds the hot counter that answers
"is this request over quota" in microseconds, but a counter that evaporates when a cache restarts
is not something to invoice from. The durable row is the billing record; Redis is the accelerator.

**A revoked key is kept, not deleted.** It is evidence of what was issued and what it spent.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.billing import StakeholderType, stakeholder_type_enum


class Organization(UUIDPrimaryKey, Timestamps, Base):
    """A paying account: a ministry, a bureau, a cooperative, an NGO, a company."""

    __tablename__ = "organizations"
    __table_args__ = (UniqueConstraint("name", name="uq_organization_name"),)

    name: Mapped[str] = mapped_column(String(160), index=True)
    stakeholder: Mapped[StakeholderType] = mapped_column(stakeholder_type_enum, index=True)
    #: Where they operate. Null for national and international bodies.
    woreda_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("woredas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    contact_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    api_keys: Mapped[list[ApiKey]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class ApiKey(UUIDPrimaryKey, Timestamps, Base):
    """A credential a machine client presents as ``X-API-Key``.

    Scoped to one organization, so a request can be metered and charged to somebody. The static
    keys in configuration remain for internal services and are not billed.
    """

    __tablename__ = "api_keys"
    __table_args__ = (
        # Lookup is by hash on every metered request, so it has to be indexed and unique.
        UniqueConstraint("key_hash", name="uq_api_key_hash"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(80))
    #: SHA-256 of the presented key. The plaintext is shown once and never stored.
    key_hash: Mapped[str] = mapped_column(String(64), index=True)
    #: Last four characters, so a customer can identify a key without the platform holding it.
    last_four: Mapped[str] = mapped_column(String(4))
    last_used_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="api_keys")

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class ApiUsageDaily(UUIDPrimaryKey, Timestamps, Base):
    """One row per organization per day. The thing an invoice is actually computed from."""

    __tablename__ = "api_usage_daily"
    __table_args__ = (
        UniqueConstraint("organization_id", "day", name="uq_api_usage_org_day"),
        CheckConstraint("requests >= 0", name="ck_api_usage_requests_non_negative"),
        Index("ix_api_usage_day", "day"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    day: Mapped[dt.date] = mapped_column(Date)
    requests: Mapped[int] = mapped_column(BigInteger, default=0)
