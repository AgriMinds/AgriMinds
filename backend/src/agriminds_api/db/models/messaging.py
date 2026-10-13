"""Advisory delivery to farmers who have no smartphone, and the credits that pay for it.

Most smallholders in the watershed reach the platform through a development agent or not at all.
An advisory that exists only in a dashboard has not reached the person whose field it is about, so
delivery is the product as much as the forecast is — and it costs money per message, which makes
it the one channel that bills by use rather than by seat.

Two tables, because credits bought and credits spent are different facts: a bundle is what an
organisation paid for, a delivery is what was done with it. The balance is the difference, and it
is derived rather than stored so it cannot drift from the rows that justify it.

**Nothing is sent until an aggregator is configured.** There is no Ethio Telecom contract wired in
here, so a delivery is recorded as `queued` and stays there. That is deliberate: a queue that
visibly never drains is honest, where a `sent` status nobody delivered would not be.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.commerce import Organization


class DeliveryChannel(enum.StrEnum):
    SMS = "sms"
    USSD = "ussd"


class DeliveryStatus(enum.StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"


delivery_channel_enum = Enum(
    DeliveryChannel, name="delivery_channel", values_callable=lambda e: [m.value for m in e]
)
delivery_status_enum = Enum(
    DeliveryStatus, name="delivery_status", values_callable=lambda e: [m.value for m in e]
)


class MessageBundle(UUIDPrimaryKey, Timestamps, Base):
    """Credits an organisation bought, at the price they bought them at."""

    __tablename__ = "message_bundles"
    __table_args__ = (
        CheckConstraint("messages > 0", name="ck_bundle_messages_positive"),
        CheckConstraint("unit_price_cents >= 0", name="ck_bundle_price_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    messages: Mapped[int] = mapped_column(BigInteger)
    #: Per message, in minor units. Frozen here so a later price change cannot restate a sale.
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="ETB")
    purchased_on: Mapped[dt.date] = mapped_column(Date, index=True)
    #: Credits that lapse. NULL means they do not.
    expires_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization: Mapped[Organization] = relationship()

    @property
    def value_cents(self) -> int:
        return self.messages * self.unit_price_cents


class MessageDelivery(UUIDPrimaryKey, Timestamps, Base):
    """One advisory sent to one person. A credit spent."""

    __tablename__ = "message_deliveries"
    __table_args__ = (Index("ix_deliveries_org_status", "organization_id", "status"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[DeliveryChannel] = mapped_column(delivery_channel_enum, default=DeliveryChannel.SMS)
    #: Stored as given. Normalised at the edge, like every other phone number here.
    recipient: Mapped[str] = mapped_column(String(32), index=True)
    #: The advisory text as it was sent, in the recipient's own language.
    body: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(2), default="am")
    status: Mapped[DeliveryStatus] = mapped_column(
        delivery_status_enum, default=DeliveryStatus.QUEUED, index=True
    )
    #: The aggregator's identifier, once there is an aggregator.
    provider_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship()

    @property
    def consumed_credit(self) -> bool:
        """A failed message is not charged for: the farmer did not get their advisory."""
        return self.status is not DeliveryStatus.FAILED
