"""People asking to buy, before anybody has sold to them.

The platform could price seven segments, issue credentials and meter calls, and had no way for a
cooperative or a farmer to say "we want this". Every account had to be created by an administrator
who already knew about the customer, which is a back office with no front door.

A request is a *lead*, not an account. It is deliberately not an `Organization`: most enquiries
never become customers, and mixing the two would put unqualified rows into the table revenue is
counted from. Approving a request is what creates the organisation, and the link is kept so an
account can always be traced back to how it arrived.

Two kinds share one table because they are the same question asked by different people — a farmer
upgrading from the free tier, and an institution asking for a quote. Keeping them together means
one inbox to work through rather than two.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.billing import StakeholderType, stakeholder_type_enum


class RequestKind(enum.StrEnum):
    #: A signed-in farmer asking to move off the free tier.
    FARMER_PREMIUM = "farmer_premium"
    #: An institution asking for access. Arrives from the public form, so it has no account yet.
    ORGANIZATION = "organization"


class RequestStatus(enum.StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    APPROVED = "approved"
    DECLINED = "declined"


request_kind_enum = Enum(RequestKind, name="request_kind", values_callable=lambda e: [m.value for m in e])
request_status_enum = Enum(
    RequestStatus, name="request_status", values_callable=lambda e: [m.value for m in e]
)


class AccessRequest(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "access_requests"
    __table_args__ = (Index("ix_access_requests_status_created", "status", "created_at"),)

    kind: Mapped[RequestKind] = mapped_column(request_kind_enum, index=True)
    status: Mapped[RequestStatus] = mapped_column(request_status_enum, default=RequestStatus.NEW, index=True)

    #: Set when a signed-in farmer asks. Null for a public enquiry, which has no account yet.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: What the enquirer says they are. Their own guess, not a decision — an administrator may
    #: place them in a different segment when approving.
    stakeholder: Mapped[StakeholderType | None] = mapped_column(stakeholder_type_enum, nullable=True)

    organization_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(120))
    contact_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    woreda_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("woredas.id", ondelete="SET NULL"), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: The account this became, once approved. Kept so revenue can be traced to its origin.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization = relationship("Organization")

    @property
    def is_open(self) -> bool:
        return self.status in {RequestStatus.NEW, RequestStatus.CONTACTED}
